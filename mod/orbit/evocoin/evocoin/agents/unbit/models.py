"""Model registry for 1-bit / ultra-low quantized GGUF models."""

from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent.parent.parent / "models"

MODELS = {
    "llama-1b-q1": {
        "url": "https://huggingface.co/afrideva/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct.Q2_K.gguf",
        "filename": "llama-1b-q2k.gguf",
        "ctx": 2048,
        "size_mb": 460,
        "description": "Llama 3.2 1B — Q2_K quantization, good balance of speed and quality",
    },
    "smollm-135m": {
        "url": "https://huggingface.co/afrideva/SmolLM-135M-Instruct-GGUF/resolve/main/SmolLM-135M-Instruct.Q2_K.gguf",
        "filename": "smollm-135m-q2k.gguf",
        "ctx": 1024,
        "size_mb": 75,
        "description": "SmolLM 135M — fastest, lowest memory, good for simple JSON tasks",
    },
    "qwen-0.5b-q2": {
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf",
        "filename": "qwen-0.5b-q2k.gguf",
        "ctx": 2048,
        "size_mb": 230,
        "description": "Qwen 2.5 0.5B — best JSON output quality at small size",
    },
}

DEFAULT_MODEL = "qwen-0.5b-q2"


def list_models() -> list:
    """List all available models with download status."""
    result = []
    for key, cfg in MODELS.items():
        path = MODELS_DIR / cfg["filename"]
        result.append({
            "key": key,
            "filename": cfg["filename"],
            "size_mb": cfg["size_mb"],
            "ctx": cfg["ctx"],
            "downloaded": path.exists(),
            "description": cfg["description"],
        })
    return result


def get_model_path(model_key: str) -> Path:
    """Get path for a model, raise if not in registry."""
    cfg = MODELS.get(model_key)
    if not cfg:
        raise ValueError(f"Unknown model: {model_key}. Available: {list(MODELS.keys())}")
    return MODELS_DIR / cfg["filename"]
