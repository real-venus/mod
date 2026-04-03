"""UnBit Agent — 1-bit quantized local LLM agents for tokenomics reasoning."""

import json
import os
import random
import subprocess
import urllib.request
import urllib.error
from typing import Optional

from .models import MODELS, DEFAULT_MODEL, MODELS_DIR, get_model_path


class UnBitAgent:
    """1-bit quantized local LLM agent for tokenomics reasoning.

    Supports llama.cpp, Ollama, or any OpenAI-compatible local endpoint.
    Falls back to random generation when no LLM server is available.
    """

    def __init__(
        self,
        backend: str = "llama_cpp",
        base_url: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.9,
    ):
        self.backend = backend
        self.model_key = model
        self.temperature = temperature

        if base_url:
            self.base_url = base_url
        elif backend == "ollama":
            self.base_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        else:
            self.base_url = os.environ.get("LLAMA_CPP_URL", "http://localhost:8421")

        self._server_process = None

    # --- Model management ---

    def download_model(self, model_key: str = None) -> "Path":
        """Download a GGUF model if not already present."""
        key = model_key or self.model_key
        cfg = MODELS.get(key)
        if not cfg:
            raise ValueError(f"Unknown model: {key}. Available: {list(MODELS.keys())}")

        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        model_path = MODELS_DIR / cfg["filename"]

        if model_path.exists():
            return model_path

        print(f"Downloading {key} ({cfg['filename']})...")
        urllib.request.urlretrieve(cfg["url"], str(model_path))
        print(f"Saved to {model_path}")
        return model_path

    def start_server(self, model_key: str = None, port: int = 8421) -> None:
        """Start a llama.cpp server with the specified model."""
        model_path = self.download_model(model_key)
        cfg = MODELS.get(model_key or self.model_key, {})
        ctx = cfg.get("ctx", 2048)

        cmd = [
            "llama-server",
            "-m", str(model_path),
            "--port", str(port),
            "-c", str(ctx),
            "-ngl", "0",
            "--threads", str(min(4, os.cpu_count() or 2)),
        ]

        self._server_process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        self.base_url = f"http://localhost:{port}"

    def stop_server(self) -> None:
        """Stop the local llama.cpp server."""
        if self._server_process:
            self._server_process.terminate()
            self._server_process = None

    # --- LLM calls ---

    def _call(self, prompt: str, max_tokens: int = 512) -> str:
        """Call the local LLM backend. Returns raw string response."""
        try:
            if self.backend == "ollama":
                return self._call_ollama(prompt, max_tokens)
            else:
                return self._call_openai_compat(prompt, max_tokens)
        except Exception as e:
            return "{}"

    def _call_openai_compat(self, prompt: str, max_tokens: int) -> str:
        data = json.dumps({
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }).encode()

        req = urllib.request.Request(
            f"{self.base_url}/v1/chat/completions",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            return result["choices"][0]["message"]["content"]

    def _call_ollama(self, prompt: str, max_tokens: int) -> str:
        data = json.dumps({
            "model": self.model_key,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": max_tokens,
            },
        }).encode()

        req = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            return result.get("response", "{}")

    # --- Agent actions ---

    def propose_token(self, survivors: list = None, generation: int = 0) -> dict:
        """Propose a new token with unique tokenomics via LLM."""
        survivor_info = ""
        if survivors:
            survivor_info = "Previous winners: " + ", ".join(
                f"{s.get('symbol','?')}(curve={s.get('curve_type',0)},fee={s.get('buy_fee',100)})"
                for s in survivors
            )

        prompt = f"""Gen {generation}. Design a token. {survivor_info}
Return JSON: {{"name":"X","symbol":"XX","curve_type":N,"curve_param":"N","buy_fee":N,"sell_fee":N}}
curve_type: 0=linear 1=exp 2=sigmoid 3=fixed. Fees in basis points (100=1%). curve_param ~1e15.
JSON only:"""

        response = self._call(prompt, max_tokens=200)
        return self._parse_token(response)

    def evaluate_tokens(self, proposals: list, budget: int = 10000) -> dict:
        """Evaluate tokens and allocate budget. Returns {symbol: amount}."""
        tokens_str = " ".join(
            f"{p.get('symbol','?')}:curve={p.get('curve_type',0)},buy={p.get('buy_fee',100)},sell={p.get('sell_fee',100)}"
            for p in proposals
        )

        prompt = f"""You have {budget} to invest across these tokens: {tokens_str}
Return JSON mapping symbol to amount. Allocate all {budget}. JSON only:"""

        response = self._call(prompt, max_tokens=200)
        return self._parse_allocations(response, proposals, budget)

    # --- Parsing ---

    def _parse_token(self, response: str) -> dict:
        """Parse a token proposal from LLM response."""
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                raw = json.loads(response[start:end])
                return self._validate_token(raw)
        except Exception:
            pass
        return self._random_token()

    def _validate_token(self, raw: dict) -> dict:
        """Validate and normalize a raw token dict."""
        return {
            "name": str(raw.get("name", "UnBitToken")),
            "symbol": str(raw.get("symbol", "UBT")),
            "curve_type": int(raw.get("curve_type", 0)) % 4,
            "curve_param": str(raw.get("curve_param", "1000000000000000")),
            "buy_fee": min(1000, max(0, int(raw.get("buy_fee", 100)))),
            "sell_fee": min(1000, max(0, int(raw.get("sell_fee", 100)))),
            "burn_bps": min(10000, max(0, int(raw.get("burn_bps", 5000)))),
            "metadata": json.dumps({"source": "unbit", "model": self.model_key}),
        }

    def _parse_allocations(self, response: str, proposals: list, budget: int) -> dict:
        """Parse investment allocations from LLM response."""
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                raw = json.loads(response[start:end])
                alloc = {}
                total = 0
                for k, v in raw.items():
                    amt = max(0, int(float(v)))
                    alloc[str(k)] = amt
                    total += amt
                if total > 0:
                    return {k: int(v * budget / total) for k, v in alloc.items()}
        except Exception:
            pass
        return self._random_allocations(proposals, budget)

    def _random_allocations(self, proposals: list, budget: int) -> dict:
        """Fallback: random allocation across proposals."""
        symbols = [p.get("symbol", "?") for p in proposals]
        alloc = {}
        remaining = budget
        for s in symbols[:-1]:
            amt = random.randint(0, remaining // max(1, len(symbols)))
            alloc[s] = amt
            remaining -= amt
        if symbols:
            alloc[symbols[-1]] = max(0, remaining)
        return alloc

    def _random_token(self) -> dict:
        """Fallback: generate a random token proposal."""
        ct = random.choice([0, 1, 2, 3])
        return {
            "name": f"Rnd{random.randint(1,999)}",
            "symbol": f"R{random.randint(1,99)}",
            "curve_type": ct,
            "curve_param": str(random.randint(100000000000000, 10000000000000000)),
            "buy_fee": random.randint(0, 500),
            "sell_fee": random.randint(0, 500),
            "burn_bps": random.randint(0, 10000),
            "metadata": json.dumps({"source": "random"}),
        }


class UnBitCreatorAgent(UnBitAgent):
    """Specialized agent for creating token proposals."""

    def forward(self, survivors=None, generation=0, count=3, **kw):
        proposals = []
        for _ in range(int(count)):
            p = self.propose_token(survivors=survivors or [], generation=int(generation))
            proposals.append(p)
        return proposals


class UnBitInvestorAgent(UnBitAgent):
    """Specialized agent for evaluating and investing in tokens."""

    def forward(self, proposals=None, budget=10000, **kw):
        if not proposals:
            return {"error": "no proposals provided"}
        return self.evaluate_tokens(proposals, int(budget))
