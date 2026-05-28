"""
agent_base.py — class template for adding new agent backends to mod/dev.

Every agent module (claude, codex, cursor, …) should subclass `AgentBase`,
declare its CLI binary and a small set of provider-specific bits, and the
dev console will route to it automatically:

    from agent_base import AgentBase

    class Mod(AgentBase):
        NAME    = "cursor"
        ICON    = "▶"
        COLOR   = "#7c3aed"
        BINARY  = "cursor-agent"
        DEFAULT_MODEL = "claude-3.5-sonnet"
        ENV_KEY = "CURSOR_API_KEY"           # encrypted via wallet sig

        def build_args(self, prompt: str, model: str, work_dir: str) -> list[str]:
            return ["--print", "--model", model, prompt]

That's all that's strictly required. Optionally override `health()`,
`parse_stream()`, `bearer_token_format()`, etc. to handle CLI quirks.

The default `forward()`, `submit()`, `jobs()`, etc. all delegate to the
Rust job server (Cargo bin `<NAME>-jobs`) running on `self.port`. If your
agent doesn't have a Rust server yet, drop the binary in
`src/api/target/release/<name>-jobs` (or copy claude's and rebuild) — the
template doesn't care which binary, just that the convention is followed.
"""

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import mod as m


class AgentBase:
    # ── Override these in your subclass ──────────────────────────────
    NAME: str = ""               # module name, must match orbit dir
    ICON: str = ""               # 1-char or emoji shown in dev sidebar avatar
    COLOR: str = "#888888"       # hex color for sidebar avatar gradient
    BINARY: str = ""             # CLI binary the Rust server spawns
    DEFAULT_MODEL: str = ""      # model arg passed when caller omits one
    ENV_KEY: str = ""            # env var name for the provider's API key
    DESCRIPTION: str = "agent module (override DESCRIPTION in subclass)"

    # ── Optional overrides for CLI-specific behavior ─────────────────
    DANGEROUS_FLAG: Optional[str] = None  # e.g. "--dangerously-skip-permissions"

    def __init__(self):
        self._path = self._discover_path()
        self._cfg = self._load_config()

    # ── Subclass hook: build the argv for one prompt ─────────────────
    def build_args(self, prompt: str, model: str, work_dir: str) -> List[str]:
        """Return the CLI argv (excluding the binary itself) for a single
        prompt invocation. Default mirrors claude/codex shape; override if
        your CLI takes different flags.
        """
        args = []
        if self.DEFAULT_MODEL:
            args += ["--model", model or self.DEFAULT_MODEL]
        if self.DANGEROUS_FLAG:
            args.append(self.DANGEROUS_FLAG)
        args.append(prompt)
        return args

    # ── Defaults that work for any CLI agent — usually no override ───
    def _discover_path(self) -> str:
        here = Path(__file__).resolve().parent
        # Walk up looking for an orbit dir matching NAME
        for d in (here, *here.parents):
            p = d.parent / self.NAME
            if (p / "config.json").exists():
                return str(p)
        return str(here.parent.parent / self.NAME)

    def _load_config(self) -> dict:
        cp = Path(self._path) / "config.json"
        return json.loads(cp.read_text()) if cp.exists() else {}

    def forward(self, **kwargs):
        return self.info()

    def info(self) -> dict:
        return {
            "name": self.NAME,
            "icon": self.ICON,
            "color": self.COLOR,
            "binary": self.BINARY,
            "description": self.DESCRIPTION,
            "owner": self._cfg.get("owner"),
            "port": self._cfg.get("port"),
            "model": self.DEFAULT_MODEL,
            "env_key": self.ENV_KEY,
        }

    def health(self) -> dict:
        """Light liveness — overrides should hit the Rust API's /health."""
        port = self._cfg.get("port")
        if not port:
            return {"service": self.NAME, "status": "no port configured"}
        try:
            import urllib.request as r
            with r.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as resp:
                return json.loads(resp.read())
        except Exception as e:
            return {"service": self.NAME, "status": "down", "error": str(e)}

    def cli_path(self) -> Optional[str]:
        """Resolve the absolute path to the agent's CLI binary, or None."""
        if not self.BINARY:
            return None
        result = subprocess.run(["which", self.BINARY], capture_output=True, text=True)
        return result.stdout.strip() or None

    def submit(self, prompt: str, model: Optional[str] = None,
               work_dir: Optional[str] = None, key=None) -> dict:
        """Queue a job via the Rust job server, returning {job_id, …}.

        The Rust server reads provider info from this module's config.json
        and spawns BINARY with build_args(). Subclasses don't usually need
        to override this — just BINARY + build_args().
        """
        port = self._cfg.get("port")
        if not port:
            raise RuntimeError(f"{self.NAME}: no port in config.json")
        import urllib.request as r
        body = json.dumps({
            "prompt": prompt,
            "model": model or self.DEFAULT_MODEL,
            "work_dir": work_dir or os.getcwd(),
        }).encode()
        req = r.Request(f"http://127.0.0.1:{port}/jobs", method="POST", data=body,
                        headers={"Content-Type": "application/json"})
        if key:
            req.add_header("Authorization", f"Bearer {key}")
        try:
            with r.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except Exception as e:
            return {"error": str(e)}

    def jobs(self) -> List[dict]:
        """List recent jobs from the Rust job server."""
        port = self._cfg.get("port")
        if not port:
            return []
        import urllib.request as r
        try:
            with r.urlopen(f"http://127.0.0.1:{port}/jobs", timeout=5) as resp:
                return json.loads(resp.read())
        except Exception:
            return []

    # ── Registry integration ─────────────────────────────────────────
    def cid(self) -> str:
        """Content CID for this module's tree, used by dev.merkle()."""
        try:
            return m.cid(self.NAME)
        except Exception:
            return ""

    def register(self, fund_eth: float = 0.0005, key=None) -> dict:
        """Register this agent on the mod protocol registry using its own
        deterministic key, with gas paid by the funded relayer.
        """
        dev = m.mod("dev")()
        return dev.register_per_key(modules=[self.NAME], fund_eth=fund_eth, key=key)
