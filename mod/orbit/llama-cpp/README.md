# llama-cpp

Local LLM inference via llama.cpp. Runs on CPU or Apple Silicon Metal (GPU/ANE).

## Usage

```python
import mod as m

llm = m.mod('llama-cpp')()

# Auto-downloads default model (Llama-3.2-1B Q4), auto-detects Metal vs CPU
llm.chat("What is the meaning of life?")

# Force CPU-only
llm.load(backend="cpu")
llm.chat("Hello")

# Force Metal (all layers on GPU)
llm.load(backend="metal", n_gpu_layers=-1)

# Text completion
llm.forward("The quick brown fox")

# Benchmark CPU vs Metal
llm.bench()
```

```bash
# CLI
m llama-cpp info                             # system info & backend detection
m llama-cpp download                         # download default model
m llama-cpp models                           # list downloaded models
m llama-cpp forward prompt="Hello world"     # text completion
m llama-cpp chat message="Hi there"          # chat completion
m llama-cpp load backend=cpu                 # force CPU mode
m llama-cpp load backend=metal               # force Metal mode
m llama-cpp bench                            # benchmark CPU vs Metal
```

## Methods

| Method     | Description                              |
|------------|------------------------------------------|
| `forward`  | Text completion                          |
| `chat`     | Chat completion with message history     |
| `load`     | Load a model (auto-downloads if needed)  |
| `download` | Download a GGUF model from HuggingFace  |
| `models`   | List locally cached models               |
| `bench`    | Benchmark CPU vs Metal speed             |
| `info`     | Show system/backend info                 |

## Backends

- **Metal** (default on Apple Silicon): Offloads all layers to GPU/ANE via Metal. Fast.
- **CPU**: Pure CPU inference. Works everywhere. Use `backend="cpu"` or `n_gpu_layers=0`.

## Models

Models are cached in `~/.cache/llama-cpp/models/`. Any GGUF file works:

```python
llm.download("https://huggingface.co/user/repo/resolve/main/model.gguf")
llm.load("model.gguf")
```
