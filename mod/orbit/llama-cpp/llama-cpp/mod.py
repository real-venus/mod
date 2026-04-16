import os
import json
import platform
import subprocess
import sys


class Mod:
    description = """
    Local LLM inference via llama.cpp.
    Supports CPU and Metal (Apple Silicon GPU/ANE) backends.
    Downloads and manages GGUF models, runs completions and chat locally.
    """

    def __init__(self):
        self.model = None
        self._llama = None
        self._model_dir = os.path.expanduser("~/.cache/llama-cpp/models")
        os.makedirs(self._model_dir, exist_ok=True)

    def _ensure_installed(self):
        """Install llama-cpp-python with appropriate backend."""
        try:
            import llama_cpp
            return llama_cpp
        except ImportError:
            print("llama-cpp-python not found. Installing...")
            self._install()
            import llama_cpp
            return llama_cpp

    def _install(self):
        """Install llama-cpp-python with Metal support on Apple Silicon, else CPU."""
        machine = platform.machine().lower()
        system = platform.system().lower()

        if system == "darwin" and machine in ("arm64", "aarch64"):
            # Apple Silicon — build with Metal for GPU/ANE acceleration
            print("Detected Apple Silicon — installing with Metal backend...")
            env = {**os.environ, "CMAKE_ARGS": "-DGGML_METAL=on"}
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "llama-cpp-python", "--force-reinstall", "--no-cache-dir"],
                env=env,
            )
        else:
            # CPU fallback
            print("Installing with CPU backend...")
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "llama-cpp-python"],
            )

    def _detect_backend(self):
        """Detect available acceleration backend."""
        machine = platform.machine().lower()
        system = platform.system().lower()
        if system == "darwin" and machine in ("arm64", "aarch64"):
            return "metal"
        return "cpu"

    def _default_model_url(self):
        """Default small model for quick start."""
        return "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"

    def _model_path(self, name):
        return os.path.join(self._model_dir, name)

    def download(self, url=None, name=None):
        """Download a GGUF model.

        Args:
            url: HuggingFace URL to a .gguf file (default: Llama-3.2-1B-Instruct Q4)
            name: Local filename to save as
        """
        url = url or self._default_model_url()
        name = name or url.split("/")[-1]
        path = self._model_path(name)
        if os.path.exists(path):
            print(f"Model already exists: {path}")
            return path

        print(f"Downloading {name}...")
        import urllib.request
        urllib.request.urlretrieve(url, path)
        print(f"Saved to {path}")
        return path

    def models(self):
        """List downloaded models."""
        files = [f for f in os.listdir(self._model_dir) if f.endswith(".gguf")]
        if not files:
            print("No models found. Use `download` to fetch one.")
        for f in files:
            size_mb = os.path.getsize(self._model_path(f)) / (1024 * 1024)
            print(f"  {f}  ({size_mb:.0f} MB)")
        return files

    def load(self, model=None, n_ctx=2048, n_gpu_layers=-1, backend=None):
        """Load a GGUF model for inference.

        Args:
            model: Model filename or path. Downloads default if None.
            n_ctx: Context window size (default 2048)
            n_gpu_layers: GPU layers to offload. -1=all (Metal), 0=CPU only.
            backend: Force 'cpu' or 'metal'. Auto-detects if None.
        """
        llama_cpp = self._ensure_installed()

        # Resolve model path
        if model is None:
            path = self.download()
        elif os.path.exists(model):
            path = model
        elif os.path.exists(self._model_path(model)):
            path = self._model_path(model)
        else:
            path = self.download(url=model)

        # Determine GPU layers based on backend
        detected = backend or self._detect_backend()
        if detected == "cpu" or backend == "cpu":
            n_gpu_layers = 0
            print(f"Loading {os.path.basename(path)} on CPU...")
        else:
            if n_gpu_layers == -1:
                n_gpu_layers = -1  # offload all layers to Metal
            print(f"Loading {os.path.basename(path)} on Metal (GPU layers: {n_gpu_layers})...")

        self._llama = llama_cpp.Llama(
            model_path=path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )
        self.model = os.path.basename(path)
        print(f"Model loaded: {self.model} | backend={detected} | ctx={n_ctx}")
        return self

    def forward(self, prompt="Hello", max_tokens=256, temperature=0.7, **kwargs):
        """Run text completion.

        Args:
            prompt: Input text prompt
            max_tokens: Max tokens to generate (default 256)
            temperature: Sampling temperature (default 0.7)
        """
        if self._llama is None:
            self.load()

        result = self._llama(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs,
        )
        text = result["choices"][0]["text"]
        print(text)
        return text

    def chat(self, message="Hello", system=None, max_tokens=512, temperature=0.7, history=None):
        """Run chat completion.

        Args:
            message: User message
            system: System prompt (optional)
            max_tokens: Max tokens to generate
            temperature: Sampling temperature
            history: List of prior {"role": ..., "content": ...} messages
        """
        if self._llama is None:
            self.load()

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": message})

        result = self._llama.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        text = result["choices"][0]["message"]["content"]
        print(text)
        return text

    def bench(self, prompt="The meaning of life is", n_tokens=128, backend=None):
        """Benchmark inference speed on CPU vs Metal.

        Args:
            prompt: Prompt to bench with
            n_tokens: Tokens to generate
            backend: 'cpu', 'metal', or None (runs both)
        """
        import time
        results = {}
        backends = [backend] if backend else (["cpu", "metal"] if self._detect_backend() == "metal" else ["cpu"])

        for b in backends:
            print(f"\nBenchmarking {b.upper()}...")
            self.load(n_gpu_layers=0 if b == "cpu" else -1, backend=b)

            start = time.time()
            self._llama(prompt, max_tokens=n_tokens)
            elapsed = time.time() - start

            tok_per_sec = n_tokens / elapsed
            results[b] = {"tokens": n_tokens, "seconds": round(elapsed, 2), "tok/s": round(tok_per_sec, 1)}
            print(f"  {b}: {tok_per_sec:.1f} tok/s ({elapsed:.2f}s for {n_tokens} tokens)")

        return results

    def info(self):
        """Show system info and detected backend."""
        backend = self._detect_backend()
        data = {
            "platform": platform.system(),
            "arch": platform.machine(),
            "backend": backend,
            "model_dir": self._model_dir,
            "loaded_model": self.model,
            "models_available": [f for f in os.listdir(self._model_dir) if f.endswith(".gguf")],
        }
        print(json.dumps(data, indent=2))
        return data
