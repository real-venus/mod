import json
import os
import time
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any, Union, List
import mod as m


class Mod:
    """
    Claude module — thin API client that delegates to the Rust job server
    (port 8820) and Next.js app (port 8821).

    All operations go through the API. Background tasks run via forward().
    """

    description = "Claude AI interface — delegates to API server for jobs, streaming, and module ops."

    def __init__(self, api_url: str = None, app_url: str = None, key=None, **kwargs):
        self.key = m.key(key)
        cfg = self._load_config()
        self.api_url = api_url or cfg.get('urls', {}).get('api', 'http://localhost:8820')
        self.app_url = app_url or cfg.get('urls', {}).get('app', 'http://localhost:8821')
        self.config = cfg

    # ── config ────────────────────────────────────────────────────

    def _load_config(self) -> dict:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}

    # ── HTTP helpers ──────────────────────────────────────────────

    def _request(self, method: str, path: str, data: dict = None, timeout: int = 30) -> dict:
        """Make a request to the API server."""
        url = f"{self.api_url}{path}"
        body = json.dumps(data).encode() if data else None
        headers = {'Content-Type': 'application/json'} if data else {}
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"API server not reachable at {self.api_url} — start it with: "
                f"cd mod/orbit/claude/api && cargo run\n{e}"
            )

    def _stream(self, path: str) -> None:
        """Stream SSE from the API server, printing lines as they arrive."""
        url = f"{self.api_url}{path}"
        req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                for raw in resp:
                    line = raw.decode("utf-8", errors="replace").rstrip()
                    if line.startswith("data:"):
                        text = line[5:]
                        if text.strip() == "[DONE]":
                            break
                        print(text, end="", flush=True)
        except KeyboardInterrupt:
            print("\n--- detached (job still running) ---")

    # ── core: forward ─────────────────────────────────────────────

    def forward(self, query: str, path: str = None, mod: str = None,
                model: str = "sonnet", background: bool = True,
                stream: bool = False, **kwargs) -> Dict[str, Any]:
        """
        Run a Claude task.

        When background=True (default), submits to the Rust job server and
        returns immediately with {id, status, prompt, ...}.
        Use tail(id) or job(id) to watch / poll.

        When background=False, runs the Claude CLI directly and blocks
        until completion.

        Args:
            query:      prompt / task description
            path:       working directory (resolves from mod if given)
            mod:        orbit module name — auto-resolves path via m.dp()
            model:      sonnet | opus | haiku
            background: if True submit to job server (default)
            stream:     if True and background, auto-tail the job
        """
        if mod is not None:
            path = m.dp(mod)

        if background:
            data = {"prompt": query, "model": model}
            if path:
                data["work_dir"] = path
            for k in ('module_name', 'creation_mode', 'github_url', 'anchor_dir', 'images'):
                if k in kwargs:
                    data[k] = kwargs[k]
            result = self._request("POST", "/jobs", data)
            if stream and result.get('id'):
                self.tail(result['id'])
            return result
        else:
            return self._run_cli(query, path=path, model=model, **kwargs)

    # ── CLI fallback (no server needed) ───────────────────────────

    def _find_claude(self) -> str:
        result = subprocess.run(["which", "claude"], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("claude CLI not found — brew install anthropics/claude/claude")
        return result.stdout.strip()

    def _run_cli(self, query: str, path: str = None, model: str = "sonnet",
                 output_format: str = "json", stream_output: bool = True, **kwargs) -> Union[str, Dict]:
        """Run Claude CLI directly (blocking). Used when background=False."""
        claude = self._find_claude()
        work_dir = path or os.path.expanduser("~/mod")
        cmd = [claude, "--print", "--model", model, "--output-format", output_format,
               "--dangerously-skip-permissions", query]
        env = os.environ.copy()

        if stream_output:
            proc = subprocess.Popen(cmd, cwd=work_dir, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, text=True, env=env, bufsize=1)
            lines = []
            while True:
                retcode = proc.poll()
                if proc.stdout:
                    line = proc.stdout.readline()
                    if line:
                        print(line, end='', flush=True)
                        lines.append(line)
                if retcode is not None:
                    rest = proc.stdout.read() if proc.stdout else ''
                    if rest:
                        print(rest, end='', flush=True)
                        lines.append(rest)
                    break
                time.sleep(0.01)
            stdout = ''.join(lines)
            if retcode != 0:
                err = proc.stderr.read() if proc.stderr else ''
                raise RuntimeError(f"Claude CLI error: {err}")
        else:
            r = subprocess.run(cmd, cwd=work_dir, capture_output=True, text=True, env=env, timeout=300)
            if r.returncode != 0:
                raise RuntimeError(f"Claude CLI error: {r.stderr}")
            stdout = r.stdout

        if output_format == "json":
            try:
                return json.loads(stdout)
            except json.JSONDecodeError:
                return {"raw_output": stdout}
        return stdout

    # ── job management ────────────────────────────────────────────

    def submit(self, prompt: str, model: str = "sonnet", work_dir: str = None,
               module_name: str = None, creation_mode: str = None,
               github_url: str = None, anchor_dir: str = None, **kwargs) -> dict:
        """Submit a background job to the Rust server."""
        data = {"prompt": prompt, "model": model}
        if work_dir:
            data["work_dir"] = work_dir
        if module_name:
            data["module_name"] = module_name
        if creation_mode:
            data["creation_mode"] = creation_mode
        if github_url:
            data["github_url"] = github_url
        if anchor_dir:
            data["anchor_dir"] = anchor_dir
        return self._request("POST", "/jobs", data)

    def jobs(self) -> list:
        """List all background jobs."""
        return self._request("GET", "/jobs").get("jobs", [])

    def job(self, job_id: str) -> dict:
        """Get job details."""
        return self._request("GET", f"/jobs/{job_id}")

    def cancel(self, job_id: str) -> dict:
        """Cancel a running job."""
        return self._request("POST", f"/jobs/{job_id}/cancel")

    def delete_job(self, job_id: str) -> dict:
        """Delete a job."""
        return self._request("DELETE", f"/jobs/{job_id}")

    def logs(self, job_id: str) -> str:
        """Get job output text."""
        return self._request("GET", f"/jobs/{job_id}").get("output", "")

    def tail(self, job_id: str) -> None:
        """Live-stream job output via SSE. Ctrl-C to detach."""
        print(f"Streaming job {job_id[:8]}...")
        self._stream(f"/jobs/{job_id}/stream")

    # ── module ops ────────────────────────────────────────────────

    def create_module(self, module_name: str, prompt: str,
                      model: str = "sonnet", anchor_dir: str = None) -> dict:
        """Create a new orbit module via background job."""
        return self.submit(prompt=prompt, model=model, module_name=module_name,
                           creation_mode="new", anchor_dir=anchor_dir)

    def edit_module(self, module_name: str, prompt: str,
                    model: str = "sonnet") -> dict:
        """Edit an existing module via background job."""
        return self.submit(prompt=prompt, model=model, module_name=module_name,
                           creation_mode="edit")

    # ── read-only helpers (API endpoints) ─────────────────────────

    def health(self) -> dict:
        return self._request("GET", "/health")

    def modules(self, search: str = None) -> list:
        """List orbit/core modules."""
        q = f"?q={search}" if search else ""
        return self._request("GET", f"/modules{q}").get("modules", [])

    def repos(self, search: str = None) -> list:
        q = f"?q={search}" if search else ""
        return self._request("GET", f"/repos{q}").get("repos", [])

    def files(self, path: str = "~/mod", depth: int = 3) -> list:
        return self._request("GET", f"/files/tree?path={path}&depth={depth}").get("tree", [])

    def changelog(self, limit: int = None) -> list:
        q = f"?limit={limit}" if limit else ""
        return self._request("GET", f"/changelog{q}").get("changelog", [])

    def version(self, ver: str) -> dict:
        return self._request("GET", f"/versions/{ver}")

    def owner(self) -> dict:
        return self._request("GET", "/owner")

    # ── conversational (OpenRouter) ───────────────────────────────

    def ask(self, message: str, model: str = 'anthropic/claude-opus-4',
            stream: bool = False, **kwargs) -> str:
        """Send a message via OpenRouter API."""
        router = m.mod('model.openrouter')()
        return router.forward(message, model=model, stream=stream, **kwargs)

    def models(self, search: str = 'claude') -> list:
        """List models available via OpenRouter."""
        router = m.mod('model.openrouter')()
        return router.models(search=search)

    # ── serve ─────────────────────────────────────────────────────

    def serve_api(self, port: int = 8820) -> None:
        """Start the Rust API server."""
        api_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'api')
        subprocess.Popen(["cargo", "run", "--release", "--", str(port)],
                         cwd=api_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"API server starting on port {port}")

    def serve_app(self, port: int = 8821) -> None:
        """Start the Next.js app."""
        app_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app')
        subprocess.Popen(["npm", "run", "dev", "--", "-p", str(port)],
                         cwd=app_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"App starting on port {port}")
