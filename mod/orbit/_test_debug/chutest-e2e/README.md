# chutest-e2e

End-to-end encrypted AI inference with post-quantum cryptography via [Chutes](https://chutes.ai).

Uses **ML-KEM-768** (Kyber) + **ChaCha20-Poly1305** + **HKDF-SHA256** through Intel TDX TEE instances. The Chutes API only sees opaque ciphertext — prompts and responses are decrypted exclusively inside hardware-isolated enclaves.

## Structure

```
chutest-e2e/
├── chutest-e2e/
│   └── mod.py
└── README.md
```

## Setup

```bash
# Required for E2EE transport
pip install chutes-e2ee-transport httpx openai

# Set API key
export CHUTES_API_KEY="cpk_..."
```

Or use the Docker proxy (no SDK needed):

```bash
docker run -p 8443:443 parachutes/e2ee-proxy:latest
```

## Usage

```python
import mod as m

e2e = m.mod('chutest-e2e')(api_key="cpk_...")

# E2E encrypted chat
result = e2e.forward("What is quantum computing?")
print(result["response"])

# Streaming
result = e2e.stream("Explain ML-KEM-768")

# Full message history
result = e2e.chat([
    {"role": "system", "content": "You are a security expert."},
    {"role": "user", "content": "Explain post-quantum cryptography."},
])

# Verify TEE attestation
attestation = e2e.verify_attestation(chute_id="...")

# Crypto stack info
print(e2e.crypto_info())

# Docker proxy config
print(e2e.proxy_config())
```

```bash
# CLI
m chutest-e2e forward prompt="Hello from E2EE"
m chutest-e2e chat messages='[{"role":"user","content":"Hi"}]'
m chutest-e2e models
m chutest-e2e crypto_info
m chutest-e2e proxy_config
```

## Cryptographic Stack

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Key Encapsulation | ML-KEM-768 (Kyber) | Post-quantum key exchange (NIST FIPS 203) |
| Key Derivation | HKDF-SHA256 | Domain-separated symmetric key derivation |
| Encryption | ChaCha20-Poly1305 | Authenticated encryption (AEAD) |
| Compression | gzip | Pre-encryption bandwidth reduction |
| TEE | Intel TDX + NVIDIA CC | Hardware memory isolation + encrypted VRAM |

## Security Properties

- **Post-quantum safe**: ML-KEM-768 resists both classical and quantum attacks (MLWE hardness)
- **Forward secrecy**: Ephemeral keypairs per request — no long-lived key compromise
- **Zero-knowledge API**: Chutes API routes ciphertext, cannot decrypt payloads
- **Hardware attestation**: Intel DCAP + NVIDIA SDK verify genuine TEE execution
- **Replay protection**: Single-use nonces with atomic Redis enforcement (75s TTL)
- **Harvest-now-decrypt-later defense**: Lattice-based crypto immune to Shor's algorithm

## Links

- [Chutes E2EE Docs](https://docs.chutes.ai)
- [E2EE Transport (PyPI)](https://pypi.org/project/chutes-e2ee-transport/)
- [E2EE Proxy (Docker)](https://hub.docker.com/r/parachutes/e2ee-proxy)
- [Source (GitHub)](https://github.com/chutesai)
- [TEE Verification](https://docs.chutes.ai/tee-verification)
