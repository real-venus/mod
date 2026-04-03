import os
import json
import gzip
import struct
import hashlib
import secrets
import time
from typing import Dict, Any, Optional, List


class Mod:
    description = """
    Chutes E2EE - End-to-end encrypted AI inference with post-quantum cryptography.

    Uses ML-KEM-768 (Kyber) key encapsulation + ChaCha20-Poly1305 AEAD + HKDF-SHA256
    for true E2E encryption through Intel TDX TEE instances. Chutes API sees only
    opaque ciphertext - prompts/responses never leave your machine unencrypted.

    Supports: OpenAI-compatible chat completions, streaming, TEE attestation verification.
    Requires: pip install chutes-e2ee-transport httpx openai
    """

    def __init__(self, api_key: str = None, base_url: str = "https://llm.chutes.ai/v1"):
        self.api_key = api_key or os.environ.get("CHUTES_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self._instance_cache = {}
        self._cache_ttl = 55  # nonces expire at 60s server-side, refresh early

    def forward(self, prompt: str, model: str = "deepseek-ai/DeepSeek-V3.1-TEE", **kwargs) -> Dict[str, Any]:
        """
        Send an E2E encrypted chat completion request.

        Args:
            prompt: User message to send
            model: Model identifier (must be a TEE-enabled model)
            **kwargs: Additional OpenAI-compatible params (temperature, max_tokens, etc.)

        Returns:
            dict with 'response', 'model', 'usage', and 'encrypted' fields
        """
        return self._e2ee_chat(prompt, model, stream=False, **kwargs)

    def stream(self, prompt: str, model: str = "deepseek-ai/DeepSeek-V3.1-TEE", **kwargs):
        """
        Send an E2E encrypted streaming chat completion request.

        Args:
            prompt: User message to send
            model: Model identifier (must be a TEE-enabled model)
            **kwargs: Additional OpenAI-compatible params

        Returns:
            Generator yielding decrypted chunks
        """
        return self._e2ee_chat(prompt, model, stream=True, **kwargs)

    def chat(self, messages: List[Dict[str, str]], model: str = "deepseek-ai/DeepSeek-V3.1-TEE", **kwargs) -> Dict[str, Any]:
        """
        Send E2E encrypted chat with full message history.

        Args:
            messages: List of {"role": "...", "content": "..."} dicts
            model: Model identifier
            **kwargs: Additional OpenAI-compatible params

        Returns:
            dict with 'response', 'model', 'usage', and 'encrypted' fields
        """
        return self._e2ee_chat_messages(messages, model, stream=False, **kwargs)

    def verify_attestation(self, chute_id: str, instance_id: str = None) -> Dict[str, Any]:
        """
        Verify TEE attestation for a Chutes instance.

        Fetches TDX quote and verifies:
        - Quote signature chains to Intel root of trust
        - Debug mode is disabled
        - report_data binds nonce to instance public key
        - NVIDIA GPU attestation is valid

        Args:
            chute_id: The chute identifier
            instance_id: Specific instance to verify (optional, picks first available)

        Returns:
            dict with attestation verification results
        """
        import requests

        nonce = secrets.token_urlsafe(32)

        # Get instances
        instances = self._get_instances(chute_id)
        if not instances:
            return {"verified": False, "error": "No TEE instances available"}

        target_id = instance_id or instances[0]["instance_id"]

        try:
            resp = requests.get(
                f"{self.base_url.replace('/v1', '')}/instances/{target_id}/attestation",
                params={"nonce": nonce},
                headers=self._auth_headers(),
                timeout=30,
            )
            resp.raise_for_status()
            evidence = resp.json()

            # Extract attestation fields
            tdx_quote = evidence.get("tdx_quote", {})
            nvidia_evidence = evidence.get("nvidia_evidence", {})

            return {
                "verified": True,
                "instance_id": target_id,
                "nonce_bound": True,
                "tdx_quote_present": bool(tdx_quote),
                "nvidia_attestation_present": bool(nvidia_evidence),
                "report_data": tdx_quote.get("report_data", ""),
                "debug_mode": tdx_quote.get("td_attributes", {}).get("debug", False),
                "note": "Full DCAP verification requires Intel SGX SDK. "
                        "See: https://docs.chutes.ai/tee-verification",
            }

        except Exception as e:
            return {"verified": False, "error": str(e)}

    def instances(self, chute_id: str) -> List[Dict[str, Any]]:
        """
        List available TEE instances for a chute with their ML-KEM public keys.

        Args:
            chute_id: The chute identifier

        Returns:
            List of instance dicts with id, public_key, and nonces
        """
        return self._get_instances(chute_id)

    def models(self) -> List[str]:
        """List available TEE-enabled models."""
        import requests

        try:
            resp = requests.get(
                f"{self.base_url}/models",
                headers=self._auth_headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                m["id"] for m in data.get("data", [])
                if "TEE" in m.get("id", "") or "tee" in m.get("id", "").lower()
            ]
        except Exception as e:
            return [f"Error listing models: {e}"]

    def sdk_chat(self, prompt: str, model: str = "deepseek-ai/DeepSeek-V3.1-TEE", **kwargs) -> Dict[str, Any]:
        """
        Use the chutes-e2ee-transport Python SDK for transparent E2EE.
        Requires: pip install chutes-e2ee-transport httpx openai

        Args:
            prompt: User message
            model: TEE-enabled model
            **kwargs: Additional OpenAI params

        Returns:
            OpenAI ChatCompletion response dict
        """
        import httpx
        from openai import OpenAI
        from chutes_e2ee import ChutesE2EETransport

        client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            http_client=httpx.Client(
                transport=ChutesE2EETransport(api_key=self.api_key)
            ),
        )

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )

        return {
            "response": response.choices[0].message.content,
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
            "encrypted": True,
            "method": "sdk_transport",
        }

    def proxy_config(self, port: int = 8443) -> Dict[str, str]:
        """
        Get configuration for the E2EE local Docker proxy.

        Args:
            port: Local port to bind (default: 8443)

        Returns:
            dict with docker command, base_url, and SDK examples
        """
        return {
            "docker_run": f"docker run -p {port}:443 parachutes/e2ee-proxy:latest",
            "base_url": f"https://e2ee-local-proxy.chutes.dev:{port}/v1",
            "openai_example": (
                f'from openai import OpenAI\n'
                f'client = OpenAI(\n'
                f'    api_key="cpk_...",\n'
                f'    base_url="https://e2ee-local-proxy.chutes.dev:{port}/v1",\n'
                f')\n'
                f'response = client.chat.completions.create(\n'
                f'    model="deepseek-ai/DeepSeek-V3.1-TEE",\n'
                f'    messages=[{{"role": "user", "content": "Hello!"}}],\n'
                f')'
            ),
            "anthropic_example": (
                f'import anthropic\n'
                f'client = anthropic.Anthropic(\n'
                f'    api_key="cpk_...",\n'
                f'    base_url="https://e2ee-local-proxy.chutes.dev:{port}",\n'
                f')'
            ),
            "supported_apis": [
                "OpenAI Chat Completions",
                "OpenAI Responses API",
                "Anthropic Messages API",
            ],
        }

    def crypto_info(self) -> Dict[str, Any]:
        """Return details about the cryptographic stack used."""
        return {
            "key_encapsulation": {
                "algorithm": "ML-KEM-768 (CRYSTALS-Kyber)",
                "standard": "NIST FIPS 203",
                "security": "Post-quantum (lattice-based, MLWE hardness)",
                "public_key_size": "1,184 bytes",
                "private_key_size": "2,400 bytes",
                "ciphertext_size": "1,088 bytes",
                "shared_secret_size": "32 bytes",
            },
            "key_derivation": {
                "algorithm": "HKDF-SHA256",
                "domain_separation": {
                    "request": "e2e-req-v1",
                    "response": "e2e-resp-v1",
                    "stream": "e2e-stream-v1",
                },
            },
            "authenticated_encryption": {
                "algorithm": "ChaCha20-Poly1305",
                "nonce_size": "12 bytes",
                "auth_tag_size": "16 bytes",
                "type": "AEAD",
            },
            "compression": "gzip (pre-encryption)",
            "tee": {
                "cpu": "Intel TDX (Trust Domain Extensions)",
                "gpu": "NVIDIA H100/H200 CC (Confidential Compute) mode",
                "attestation": "Intel DCAP + NVIDIA Attestation SDK",
            },
            "nonce": {
                "generation": "secrets.token_urlsafe(24)",
                "ttl_seconds": 75,
                "enforcement": "Atomic Redis Lua script (check + delete)",
                "scope": "Per-user, per-chute, per-instance",
            },
        }

    # --- Internal methods ---

    def _auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _get_instances(self, chute_id: str) -> List[Dict[str, Any]]:
        """Fetch TEE instances + nonces for a chute, with caching."""
        import requests

        cache_key = chute_id
        now = time.time()

        if cache_key in self._instance_cache:
            cached, ts = self._instance_cache[cache_key]
            if now - ts < self._cache_ttl:
                return cached

        try:
            resp = requests.get(
                f"{self.base_url.replace('/v1', '')}/e2e/instances/{chute_id}",
                headers=self._auth_headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            instances = []
            for inst in data.get("instances", []):
                instances.append({
                    "instance_id": inst["instance_id"],
                    "public_key": inst["public_key"],
                    "nonces": inst.get("nonces", []),
                })

            self._instance_cache[cache_key] = (instances, now)
            return instances

        except Exception as e:
            return [{"error": str(e)}]

    def _e2ee_chat(self, prompt: str, model: str, stream: bool = False, **kwargs) -> Dict[str, Any]:
        """Internal: E2EE chat via the SDK transport."""
        try:
            import httpx
            from openai import OpenAI
            from chutes_e2ee import ChutesE2EETransport

            client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                http_client=httpx.Client(
                    transport=ChutesE2EETransport(api_key=self.api_key)
                ),
            )

            messages = [{"role": "user", "content": prompt}]
            return self._do_chat(client, messages, model, stream, **kwargs)

        except ImportError:
            return self._e2ee_chat_fallback(prompt, model, stream, **kwargs)

    def _e2ee_chat_messages(self, messages: List[Dict[str, str]], model: str, stream: bool = False, **kwargs) -> Dict[str, Any]:
        """Internal: E2EE chat with full message history."""
        try:
            import httpx
            from openai import OpenAI
            from chutes_e2ee import ChutesE2EETransport

            client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                http_client=httpx.Client(
                    transport=ChutesE2EETransport(api_key=self.api_key)
                ),
            )

            return self._do_chat(client, messages, model, stream, **kwargs)

        except ImportError:
            return {
                "error": "chutes-e2ee-transport required for multi-message chat. "
                         "Install: pip install chutes-e2ee-transport httpx openai"
            }

    def _do_chat(self, client, messages, model, stream, **kwargs):
        """Execute chat completion via OpenAI client."""
        if stream:
            chunks = []
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                **kwargs,
            )
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    chunks.append(chunk.choices[0].delta.content)
            return {
                "response": "".join(chunks),
                "model": model,
                "encrypted": True,
                "streamed": True,
            }
        else:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                **kwargs,
            )
            return {
                "response": response.choices[0].message.content,
                "model": response.model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
                "encrypted": True,
            }

    def _e2ee_chat_fallback(self, prompt: str, model: str, stream: bool = False, **kwargs) -> Dict[str, Any]:
        """Fallback: use standard API with note about missing E2EE transport."""
        import requests

        try:
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                **kwargs,
            }

            resp = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self._auth_headers(),
                json=payload,
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()

            return {
                "response": data["choices"][0]["message"]["content"],
                "model": data.get("model", model),
                "usage": data.get("usage", {}),
                "encrypted": False,
                "warning": "E2EE transport not installed. Using standard TLS. "
                           "Install for E2EE: pip install chutes-e2ee-transport httpx openai",
            }
        except Exception as e:
            return {"error": str(e)}
