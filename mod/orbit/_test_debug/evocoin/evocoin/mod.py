"""EvoCoin Protocol — Python wrapper for Rust backend + evolutionary simulation"""

import json
import os
import random
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional


def _load_engine_url():
    config_paths = [
        Path(__file__).parent.parent / "config.json",
        Path(__file__).parent / "config.json",
    ]
    for p in config_paths:
        if p.exists():
            try:
                with open(p) as f:
                    cfg = json.load(f)
                port = cfg.get("engine", {}).get("port", 8420)
                return f"http://localhost:{port}"
            except Exception:
                pass
    return "http://localhost:8420"


ENGINE_URL = os.environ.get("EVOCOIN_ENGINE_URL") or _load_engine_url()
LLM_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
LLM_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
LLM_MODEL = os.environ.get("EVOCOIN_LLM_MODEL", "mistralai/mistral-7b-instruct:free")


class Mod:
    """EvoCoin Protocol — Hub-and-spoke token exchange with evolutionary tokenomics.

    Rust backend (Axum) reads on-chain state. Python mod handles CLI + agent simulation.

    Actions:
      scan       — list all spoke tokens with metrics
      info       — detailed info on a spoke
      price      — spot price of a spoke
      create     — build tx to deploy a spoke token
      buy        — build tx to buy spoke tokens
      sell       — build tx to sell spoke tokens
      health     — engine health check
      simulate   — run N-generation evolutionary simulation with LLM agents
    """

    description = """
    EvoCoin Protocol — Hub-and-spoke bonding curve exchange on Base Sepolia.
    EvoToken is the hub. Agents deploy spoke tokens with custom tokenomics.
    Evolutionary simulation selects winning tokenomics across generations.
    """

    def __init__(self, engine_url: str = ENGINE_URL):
        self.url = engine_url.rstrip("/")

    # --- HTTP helpers ---

    def _get(self, path: str, params: dict = None) -> dict:
        url = f"{self.url}{path}"
        if params:
            qs = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
            url += f"?{qs}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    def _post(self, path: str, data: dict) -> dict:
        url = f"{self.url}{path}"
        body = json.dumps(data).encode()
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    # --- CLI entry point ---

    def forward(self, action="scan", **kwargs) -> Any:
        actions = {
            "scan": self.scan,
            "info": self.info,
            "price": self.price,
            "create": self.create,
            "buy": self.buy,
            "sell": self.sell,
            "health": self.health,
            "simulate": self.simulate,
        }
        if action not in actions:
            return {"error": f"Unknown action: {action}", "available": list(actions.keys())}
        return actions[action](**kwargs)

    # --- Read endpoints ---

    def health(self, **kw) -> dict:
        return self._get("/health")

    def scan(self, offset=0, limit=50, **kw) -> list:
        return self._get("/spokes", {"offset": offset, "limit": limit})

    def info(self, address: str = "", **kw) -> dict:
        if not address:
            return {"error": "address required"}
        return self._get(f"/spokes/{address}")

    def price(self, address: str = "", **kw) -> dict:
        if not address:
            return {"error": "address required"}
        return self._get(f"/price/{address}")

    # --- Write endpoints (return unsigned tx) ---

    def create(self, name="", symbol="", curve_type=0, curve_param="1000000000000000",
               buy_fee=100, sell_fee=100, burn_bps=5000, metadata="{}", **kw) -> dict:
        return self._post("/tx/create", {
            "name": name, "symbol": symbol,
            "curve_type": int(curve_type), "curve_param": str(curve_param),
            "buy_fee_bps": int(buy_fee), "sell_fee_bps": int(sell_fee),
            "burn_bps": int(burn_bps), "metadata": metadata,
        })

    def buy(self, spoke="", evo_amount="0", min_out="0", **kw) -> dict:
        return self._post("/tx/buy", {
            "spoke": spoke, "evo_amount": str(evo_amount),
            "min_tokens_out": str(min_out),
        })

    def sell(self, spoke="", token_amount="0", min_out="0", **kw) -> dict:
        return self._post("/tx/sell", {
            "spoke": spoke, "token_amount": str(token_amount),
            "min_evo_out": str(min_out),
        })

    # --- Evolutionary Simulation ---

    def simulate(self, generations=5, agents_per_gen=6, top_k=2, **kw) -> dict:
        """Run evolutionary token simulation with LLM agents.

        Each generation:
        1. Creator agents propose tokens with unique tokenomics
        2. Investor agents evaluate and allocate virtual capital
        3. Fitness = total investment attracted
        4. Top-K survive, their params mutate into next gen
        """
        generations = int(generations)
        agents_per_gen = int(agents_per_gen)
        top_k = int(top_k)

        results = []
        survivors = []

        for gen in range(generations):
            print(f"\n=== Generation {gen + 1}/{generations} ===")

            # Phase 1: Creator agents propose tokens
            proposals = self._generate_proposals(agents_per_gen, survivors, gen)
            print(f"  {len(proposals)} token proposals generated")

            # Phase 2: Investor agents evaluate
            investments = self._evaluate_proposals(proposals, gen)
            print(f"  Investments allocated")

            # Phase 3: Rank by fitness (total investment)
            for p in proposals:
                p["fitness"] = investments.get(p["symbol"], 0)
            proposals.sort(key=lambda x: x["fitness"], reverse=True)

            # Phase 4: Select survivors
            survivors = proposals[:top_k]
            eliminated = proposals[top_k:]

            gen_result = {
                "generation": gen + 1,
                "survivors": [
                    {"name": s["name"], "symbol": s["symbol"],
                     "curve_type": s["curve_type"], "curve_param": s["curve_param"],
                     "buy_fee": s["buy_fee"], "sell_fee": s["sell_fee"],
                     "fitness": s["fitness"]}
                    for s in survivors
                ],
                "eliminated": [
                    {"name": e["name"], "symbol": e["symbol"], "fitness": e["fitness"]}
                    for e in eliminated
                ],
            }
            results.append(gen_result)

            for s in survivors:
                print(f"  SURVIVED: {s['symbol']} (fitness={s['fitness']:.0f})")
            for e in eliminated:
                print(f"  eliminated: {e['symbol']} (fitness={e['fitness']:.0f})")

        print(f"\n=== Final Winners ===")
        for s in survivors:
            print(f"  {s['symbol']}: {s['name']} | curve={s['curve_type']} param={s['curve_param']} fees={s['buy_fee']}/{s['sell_fee']}bps fitness={s['fitness']:.0f}")

        return {
            "generations": results,
            "winners": survivors,
        }

    def _generate_proposals(self, count: int, survivors: list, gen: int) -> list:
        """Use LLM agents to propose token configurations."""
        proposals = []

        # Mutate survivors into new proposals
        for s in survivors:
            mutated = self._mutate(s)
            proposals.append(mutated)

        # Fill remaining slots with new LLM-generated proposals
        remaining = count - len(proposals)
        if remaining > 0:
            prompt = self._build_creator_prompt(survivors, gen, remaining)
            response = self._call_llm(prompt)
            parsed = self._parse_proposals(response, remaining)
            proposals.extend(parsed)

        # Ensure we have exactly `count` proposals
        while len(proposals) < count:
            proposals.append(self._random_proposal(len(proposals)))

        return proposals[:count]

    def _evaluate_proposals(self, proposals: list, gen: int) -> dict:
        """Use LLM investor agents to allocate capital across proposals."""
        prompt = self._build_investor_prompt(proposals, gen)
        response = self._call_llm(prompt)
        return self._parse_investments(response, proposals)

    def _mutate(self, parent: dict) -> dict:
        """Mutate a surviving token's parameters within bounds."""
        curve_param = int(parent.get("curve_param", 1000000000000000))
        buy_fee = int(parent.get("buy_fee", 100))
        sell_fee = int(parent.get("sell_fee", 100))

        # Random mutation: +/- 20%
        curve_param = max(1, int(curve_param * random.uniform(0.8, 1.2)))
        buy_fee = max(0, min(1000, buy_fee + random.randint(-50, 50)))
        sell_fee = max(0, min(1000, sell_fee + random.randint(-50, 50)))

        return {
            "name": f"{parent['name']}v{random.randint(2,99)}",
            "symbol": f"{parent['symbol']}{random.randint(2,9)}",
            "curve_type": parent.get("curve_type", 0),
            "curve_param": str(curve_param),
            "buy_fee": buy_fee,
            "sell_fee": sell_fee,
            "burn_bps": parent.get("burn_bps", 5000),
            "metadata": json.dumps({"parent": parent.get("symbol", ""), "mutated": True}),
        }

    def _random_proposal(self, idx: int) -> dict:
        """Fallback: generate a random proposal."""
        ct = random.choice([0, 1, 2, 3])
        return {
            "name": f"Token{idx}",
            "symbol": f"T{idx}",
            "curve_type": ct,
            "curve_param": str(random.randint(100000000000000, 10000000000000000)),
            "buy_fee": random.randint(0, 500),
            "sell_fee": random.randint(0, 500),
            "burn_bps": random.randint(0, 10000),
            "metadata": "{}",
        }

    def _build_creator_prompt(self, survivors: list, gen: int, count: int) -> str:
        survivor_info = ""
        if survivors:
            survivor_info = "Previous winners:\n"
            for s in survivors:
                survivor_info += f"  - {s['symbol']}: curve_type={s['curve_type']}, curve_param={s['curve_param']}, buy_fee={s['buy_fee']}bps, sell_fee={s['sell_fee']}bps, fitness={s.get('fitness', 0)}\n"

        return f"""You are a tokenomics designer in generation {gen + 1} of an evolutionary token competition.

{survivor_info}
Design {count} NEW tokens with unique tokenomics. Each token needs:
- name: creative token name
- symbol: 3-5 char ticker
- curve_type: 0=linear, 1=exponential, 2=sigmoid, 3=fixed
- curve_param: price curve parameter (integer, typically 1e14 to 1e17)
- buy_fee: buy fee in basis points (0-1000, where 100=1%)
- sell_fee: sell fee in basis points (0-1000)

Respond ONLY with a JSON array of objects. No explanation.
Example: [{{"name":"GrowthCoin","symbol":"GROW","curve_type":0,"curve_param":"1000000000000000","buy_fee":50,"sell_fee":150}}]"""

    def _build_investor_prompt(self, proposals: list, gen: int) -> str:
        token_list = "\n".join([
            f"  {i+1}. {p['symbol']} ({p['name']}): curve={p['curve_type']}, param={p['curve_param']}, buy_fee={p['buy_fee']}bps, sell_fee={p['sell_fee']}bps"
            for i, p in enumerate(proposals)
        ])

        return f"""You are an investor agent evaluating tokens in generation {gen + 1}.
You have 10000 units of capital to allocate across these tokens:

{token_list}

Evaluate based on: growth potential (curve shape), fee structure, uniqueness.
Allocate your 10000 units. Higher allocation = more confidence.

Respond ONLY with a JSON object mapping symbol to investment amount.
Example: {{"GROW": 4000, "STABLE": 3000, "MOON": 2000, "SAFE": 1000}}"""

    def _call_llm(self, prompt: str) -> str:
        """Call OpenRouter or compatible LLM API."""
        if not LLM_API_KEY:
            # Fallback: return empty so random/mutation logic handles it
            return "{}"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}",
        }
        data = json.dumps({
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.8,
            "max_tokens": 1024,
        }).encode()

        req = urllib.request.Request(
            f"{LLM_BASE_URL}/chat/completions",
            data=data, headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                return result["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"  LLM call failed: {e}")
            return "{}"

    def _parse_proposals(self, response: str, count: int) -> list:
        """Parse LLM response into proposal dicts."""
        try:
            # Find JSON array in response
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                items = json.loads(response[start:end])
                proposals = []
                for item in items[:count]:
                    proposals.append({
                        "name": str(item.get("name", f"Token{len(proposals)}")),
                        "symbol": str(item.get("symbol", f"T{len(proposals)}")),
                        "curve_type": int(item.get("curve_type", 0)),
                        "curve_param": str(item.get("curve_param", "1000000000000000")),
                        "buy_fee": int(item.get("buy_fee", 100)),
                        "sell_fee": int(item.get("sell_fee", 100)),
                        "burn_bps": int(item.get("burn_bps", 5000)),
                        "metadata": json.dumps({"source": "llm"}),
                    })
                return proposals
        except Exception:
            pass
        return []

    def _parse_investments(self, response: str, proposals: list) -> dict:
        """Parse LLM investor response into {symbol: amount} dict."""
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                raw = json.loads(response[start:end])
                return {str(k): float(v) for k, v in raw.items()}
        except Exception:
            pass
        # Fallback: random allocation
        symbols = [p["symbol"] for p in proposals]
        total = 10000
        alloc = {}
        for s in symbols[:-1]:
            amt = random.randint(0, total // len(symbols) * 2)
            alloc[s] = amt
            total -= amt
        if symbols:
            alloc[symbols[-1]] = max(0, total)
        return alloc
