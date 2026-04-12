import json
import os
import time
import signal
import subprocess
import threading
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any, Union, List
import mod as m


class Mod:
    """
    Claude module — programmable AI developer interface.

    Operates in two modes:
      - Server mode: delegates to Rust job server (port 8820) + Next.js app (8821)
      - Standalone mode: runs Claude CLI directly, local bg jobs, IPFS versioning

    All code-writing operations require owner permission when an owner is set.
    Read-only operations (analyze, debug, modules, health) are always open.
    """

    description = "Claude AI interface — jobs, code ops, IPFS versioning, and module management."
    endpoints = [
        'forward', 'ask', 'submit', 'jobs', 'job', 'cancel', 'tail',
        'create_module', 'edit_module', 'analyze_code', 'generate_code',
        'refactor', 'debug', 'edit_file', 'run_task', 'batch_process',
        'bg', 'bg_status', 'bg_list', 'snapshot', 'changelog',
        'get_version', 'restore_version', 'health', 'modules',
        'set_owner', 'get_owner', 'is_owner', 'serve',
        'kill', 'kill_port',
    ]

    def __init__(self, api_url: str = None, app_url: str = None,
                 key=None, default_path: str = None,
                 idle_timeout: int = None, **kwargs):
        self.key = m.key(key)
        self.auth = m.mod('auth.base')()
        cfg = self._load_config()
        servers = cfg.get('servers', {})
        name = cfg.get('name', 'claude')
        self.api_url = api_url or servers.get(f'{name}-api', 'http://localhost:8820')
        self.app_url = app_url or servers.get(f'{name}-app', 'http://localhost:8821')
        self.config = cfg
        self.default_path = default_path or cfg.get('default_path', os.path.expanduser('~/mod'))
        self._owner = cfg.get('owner') or self.key.address.lower()
        self._history_dir = Path(self._module_dir()) / '.history'
        # dynamic API lifecycle
        self._idle_timeout = idle_timeout or cfg.get('idle_timeout', 300)  # seconds
        self._last_activity = 0.0
        self._api_managed = False  # True if we started the API ourselves
        self._idle_lock = threading.Lock()
        self._idle_thread = None

    # ── config ────────────────────────────────────────────────────

    def _module_dir(self) -> str:
        return str(Path(__file__).parent.parent)

    def _load_config(self) -> dict:
        config_path = os.path.join(Path(__file__).parent.parent, 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}

    def _save_config(self, cfg: dict):
        config_path = os.path.join(self._module_dir(), 'config.json')
        with open(config_path, 'w') as f:
            json.dump(cfg, f, indent=2)
        self.config = cfg

    # ── permissions ───────────────────────────────────────────────

    def get_owner(self) -> Optional[str]:
        """Get the owner address, or None if unset."""
        return self._owner

    def set_owner(self, address: str):
        """Set the owner address. Persists to config.json."""
        addr = address.lower() if address else None
        self._owner = addr
        cfg = self._load_config()
        cfg['owner'] = addr
        self._save_config(cfg)

    def _resolve_address(self, key=None) -> str:
        """Resolve a key/address/token to a verified address string.

        Accepts:
          - None           → uses self.key (the owner by default)
          - Key object     → extracts .address
          - str (0x...)    → used directly
          - str (token)    → decoded & verified via auth, returns token's key address
        """
        if key is None:
            return self.key.address
        if hasattr(key, 'address'):
            return key.address
        key_str = str(key)
        # Looks like a hex address
        if key_str.startswith('0x') and len(key_str) in (42, 66):
            return key_str
        # Otherwise treat as a signed token — verify it
        try:
            verified = self.auth.verify(key_str)
            return verified['key']
        except Exception:
            return key_str

    def token(self, data: dict = None, key=None) -> str:
        """Generate a signed auth token for the given key (default: owner)."""
        key = key or self.key
        return self.auth.token(data=data or {}, key=key)

    def verify(self, token: str) -> dict:
        """Verify a signed auth token. Returns decoded headers with 'key' address."""
        return self.auth.verify(token)

    def is_owner(self, key=None) -> bool:
        """Check if key/address/token belongs to the owner."""
        if not self._owner:
            return True
        addr = self._resolve_address(key)
        if not addr:
            return False
        return addr.lower() == self._owner.lower()

    def _format_address(self, address) -> str:
        """Extract a clean hex address from a string, Key object, or repr."""
        addr = str(address)
        if hasattr(address, 'address'):
            addr = str(address.address)
        elif addr.startswith('Key('):
            inner = addr[4:].rstrip(')')
            addr = inner.split(',')[0].strip()
        return addr[:10] + '...' + addr[-4:] if len(addr) > 16 else addr

    def require_owner(self, key=None, operation: str = "this operation"):
        """Raise PermissionError if key/address/token is not the owner.

        Accepts None (defaults to self.key), Key objects, hex addresses, or signed tokens.
        """
        if not self.is_owner(key):
            caller = self._format_address(self._resolve_address(key))
            owner = self._format_address(self._owner) if self._owner else 'none'
            raise PermissionError(
                f"Permission denied: '{operation}' is owner-only.\n"
                f"  caller: {caller}\n"
                f"  owner:  {owner}"
            )

    # ── HTTP helpers ──────────────────────────────────────────────

    def _request(self, method: str, path: str, data: dict = None, timeout: int = 30) -> dict:
        """Make a request to the API server. Auto-starts API if needed."""
        self._ensure_api()
        url = f"{self.api_url}{path}"
        body = json.dumps(data).encode() if data else None
        headers = {'Content-Type': 'application/json'} if data else {}
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                self._touch_activity()
                return json.loads(resp.read().decode())
        except urllib.error.URLError as e:
            raise ConnectionError(
                f"API server not reachable at {self.api_url} — "
                f"start it with: cd mod/orbit/claude/api && cargo run\n{e}"
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

    def _server_available(self) -> bool:
        """Check if the API server is reachable."""
        try:
            url = f"{self.api_url}/health"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=2) as resp:
                json.loads(resp.read().decode())
            return True
        except Exception:
            return False

    # ── dynamic API lifecycle ─────────────────────────────────────

    def _api_port(self) -> int:
        """Extract port from api_url."""
        try:
            return int(self.api_url.rsplit(':', 1)[-1].rstrip('/'))
        except (ValueError, IndexError):
            return 8820

    def _start_api(self) -> bool:
        """Start the Rust API server. Returns True if started successfully."""
        api_dir = os.path.join(self._module_dir(), 'api')
        binary = os.path.join(api_dir, 'target', 'release', 'claude-jobs')
        if not os.path.exists(binary):
            start_sh = os.path.join(api_dir, 'start.sh')
            if os.path.exists(start_sh):
                subprocess.Popen(
                    ['bash', start_sh, str(self._api_port())],
                    cwd=api_dir, stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL, start_new_session=True
                )
            else:
                return False
        else:
            port = self._api_port()
            env = os.environ.copy()
            env['CLAUDE_JOBS_LOCAL'] = '1'
            subprocess.Popen(
                [binary, str(port)], cwd=api_dir, env=env,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=True
            )
        # wait for it to come up
        for _ in range(30):
            time.sleep(0.5)
            if self._server_available():
                self._api_managed = True
                self._touch_activity()
                self._start_idle_monitor()
                return True
        return False

    def _stop_api(self):
        """Stop the API server if we started it."""
        port = self._api_port()
        try:
            result = subprocess.run(
                ['lsof', '-ti', f':{port}'],
                capture_output=True, text=True
            )
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid.strip():
                    try:
                        os.kill(int(pid.strip()), signal.SIGTERM)
                    except (ProcessLookupError, ValueError):
                        pass
        except Exception:
            pass
        self._api_managed = False

    def _touch_activity(self):
        """Record the current time as last API activity."""
        with self._idle_lock:
            self._last_activity = time.time()

    def _start_idle_monitor(self):
        """Start a daemon thread that shuts down the API after idle_timeout."""
        if self._idle_thread and self._idle_thread.is_alive():
            return
        def _monitor():
            while self._api_managed:
                time.sleep(10)
                with self._idle_lock:
                    idle = time.time() - self._last_activity
                if idle >= self._idle_timeout:
                    print(f"[claude] API idle for {int(idle)}s — shutting down")
                    self._stop_api()
                    return
        self._idle_thread = threading.Thread(target=_monitor, daemon=True)
        self._idle_thread.start()

    def _ensure_api(self):
        """Ensure the API server is running. Auto-starts if needed."""
        self._touch_activity()
        if self._server_available():
            return True
        print("[claude] API not running — starting automatically...")
        if self._start_api():
            print(f"[claude] API started on port {self._api_port()} (idle timeout: {self._idle_timeout}s)")
            return True
        raise ConnectionError(
            f"Failed to auto-start API on port {self._api_port()}. "
            f"Start manually: cd {self._module_dir()}/api && bash start.sh"
        )

    # ── core: forward ─────────────────────────────────────────────

    def forward(self, query: str, *extra_query, path: str = None, mod: str = None,
                model: str = "sonnet", background: bool = True,
                stream: bool = False, key: str = None, **kwargs) -> Dict[str, Any]:
        """
        Run a Claude task.

        background=True  → submit to Rust job server, return immediately
        background=False → run Claude CLI directly, block until done

        Write operations (edit/modify/fix/add/remove) require owner when set.

        Args:
            query:      prompt / task description
            path:       working directory (resolves from mod if given)
            mod:        orbit module name — auto-resolves path via m.dp()
            model:      sonnet | opus | haiku (passed to claude CLI --model)
            background: if True submit to job server (default)
            stream:     if True and background, auto-tail the job
            key:        caller address for permission check
        """
        # permission check for write operations
        query = query + " " + " ".join(extra_query)
        write_keywords = ('edit', 'modify', 'update', 'fix', 'add', 'remove',
                          'delete', 'create', 'write', 'refactor', 'change')
        if any(kw in query.lower() for kw in write_keywords):
            self.require_owner(key, f"forward({query[:40]}...)")

        if mod is not None:
            path = m.dp(mod)

        if background:
            data = {"prompt": query, "model": model}
            if path:
                data["work_dir"] = path
            data["user_address"] = self._resolve_address(key)
            for k in ('module_name', 'creation_mode', 'github_url', 'anchor_dir', 'images'):
                if k in kwargs:
                    data[k] = kwargs[k]
            result = self._request("POST", "/jobs", data)
            if stream and result.get('id'):
                self.tail(result['id'])
            return result
        else:
            return self._run_cli(query, path=path, model=model, **kwargs)

    # ── CLI (no server needed) ────────────────────────────────────

    def _find_claude(self) -> str:
        result = subprocess.run(["which", "claude"], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("claude CLI not found — install with: npm install -g @anthropic-ai/claude-code")
        return result.stdout.strip()

    def _run_cli(self, query: str, path: str = None, model: str = "sonnet",
                 output_format: str = "json", stream_output: bool = True, **kwargs) -> Union[str, Dict]:
        """Run Claude CLI directly (blocking). Used when background=False."""
        claude = self._find_claude()
        work_dir = path or self.default_path
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

    # ── code operations ───────────────────────────────────────────

    def analyze_code(self, path: str = None, query: str = None,
                     focus: str = None, model: str = "sonnet", **kwargs) -> str:
        """Analyze code at a path. Read-only, no owner required."""
        work_dir = path or self.default_path
        prompt = query or f"Analyze the code in this directory. Focus on: {focus or 'overall quality and structure'}"
        return self._run_cli(prompt, path=work_dir, model=model,
                             output_format="text", stream_output=False)

    def generate_code(self, description: str, language: str = "python",
                      path: str = None, model: str = "sonnet",
                      key: str = None, **kwargs) -> str:
        """Generate code from description. Write operation, requires owner."""
        self.require_owner(key, "generate_code")
        work_dir = path or self.default_path
        prompt = f"Generate {language} code: {description}"
        return self._run_cli(prompt, path=work_dir, model=model,
                             output_format="text", stream_output=False)

    def refactor(self, path: str, instructions: str = None,
                 model: str = "sonnet", key: str = None, **kwargs) -> str:
        """Refactor code at path. Write operation, requires owner."""
        self.require_owner(key, "refactor")
        prompt = f"Refactor the code. {instructions or 'Improve structure and readability.'}"
        return self._run_cli(prompt, path=path, model=model,
                             output_format="text", stream_output=False)

    def debug(self, path: str, error: str = None,
              model: str = "sonnet", **kwargs) -> str:
        """Debug code at path. Read-only, no owner required."""
        prompt = f"Debug the code in this directory."
        if error:
            prompt += f" The error is: {error}"
        return self._run_cli(prompt, path=path, model=model,
                             output_format="text", stream_output=False)

    def edit_file(self, file_path: str, instructions: str,
                  path: str = None, model: str = "sonnet",
                  key: str = None, **kwargs) -> str:
        """Edit a file with instructions. Write operation, requires owner."""
        self.require_owner(key, "edit_file")
        work_dir = path or self.default_path
        prompt = f"Edit the file {file_path}: {instructions}"
        return self._run_cli(prompt, path=work_dir, model=model,
                             output_format="text", stream_output=False)

    def run_task(self, task: str, path: str = None,
                 model: str = "sonnet", **kwargs) -> str:
        """Run an arbitrary task with Claude CLI."""
        work_dir = path or self.default_path
        return self._run_cli(task, path=work_dir, model=model,
                             output_format="text", stream_output=False)

    def batch_process(self, items: List[str], instruction: str,
                      model: str = "sonnet", **kwargs) -> List[Dict]:
        """Process a batch of items with the same instruction."""
        results = []
        for item in items:
            prompt = f"{instruction}\n\nItem: {item}"
            try:
                out = self._run_cli(prompt, model=model,
                                    output_format="text", stream_output=False)
                results.append({"item": item, "result": out, "status": "ok"})
            except Exception as e:
                results.append({"item": item, "error": str(e), "status": "error"})
        return results

    # ── job management (server) ───────────────────────────────────

    def submit(self, prompt: str, model: str = "sonnet", work_dir: str = None,
               module_name: str = None, creation_mode: str = None,
               github_url: str = None, anchor_dir: str = None,
               key: str = None, **kwargs) -> dict:
        """Submit a background job to the Rust server."""
        data = {"prompt": prompt, "model": model}
        data["user_address"] = self._resolve_address(key)
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

    def kill(self, pid: int = None, port: int = None, sig: str = "SIGKILL") -> dict:
        """Kill a process by PID, port, or both claude services (API+App) if no args given. Owner-only."""
        self.require_owner(operation="kill")

        # No args → kill both claude services (API on 8820 + App on 8821)
        if pid is None and port is None:
            killed = {}
            name = self.config.get('name', 'claude')
            pm2 = None
            try:
                pm2 = m.mod('pm.pm2')()
            except Exception:
                pass

            for svc, svc_port in [('api', self._api_port()), ('app', int(self.app_url.rsplit(':', 1)[-1].rstrip('/')))]:
                svc_name = f'{name}-{svc}'
                # Try pm2 first
                if pm2:
                    try:
                        if pm2.exists(svc_name):
                            pm2.kill(svc_name)
                            killed[svc] = f'pm2 stopped {svc_name}'
                            continue
                    except Exception:
                        pass
                # Fallback: kill by port
                try:
                    result = subprocess.run(
                        ['lsof', '-ti', f':{svc_port}'],
                        capture_output=True, text=True
                    )
                    pids = [p.strip() for p in result.stdout.strip().split('\n') if p.strip()]
                    for p in pids:
                        try:
                            os.kill(int(p), signal.SIGKILL)
                        except (ProcessLookupError, ValueError):
                            pass
                    killed[svc] = f'killed {len(pids)} process(es) on port {svc_port}' if pids else f'nothing on port {svc_port}'
                except Exception as e:
                    killed[svc] = f'error: {e}'

            self._api_managed = False
            return {'status': 'killed', 'services': killed}

        # Specific PID or port → delegate to API server
        data = {"signal": sig}
        if pid is not None:
            data["pid"] = pid
        elif port is not None:
            data["port"] = port
        return self._request("POST", "/kill", data)

    def kill_port(self, port: int, sig: str = "SIGKILL") -> dict:
        """Kill all processes on a port. Owner-only."""
        return self.kill(port=port, sig=sig)

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

    # ── local background jobs (no server) ─────────────────────────

    def bg(self, prompt: str, path: str = None, mod: str = None,
           model: str = "sonnet", log_dir: str = None, **kwargs) -> dict:
        """Run a background job locally with nohup. Returns {pid, log_file}."""
        claude = self._find_claude()
        work_dir = path or (m.dp(mod) if mod else self.default_path)
        log_dir = log_dir or os.path.join(self._module_dir(), '.logs')
        os.makedirs(log_dir, exist_ok=True)

        ts = int(time.time())
        log_file = os.path.join(log_dir, f"job_{ts}.log")
        cmd = [claude, "--print", "--model", model, "--output-format", "text",
               "--dangerously-skip-permissions", prompt]

        with open(log_file, 'w') as lf:
            proc = subprocess.Popen(
                cmd, cwd=work_dir, stdout=lf, stderr=lf,
                env=os.environ.copy(), start_new_session=True
            )

        return {"pid": proc.pid, "log_file": log_file, "model": model, "prompt": prompt[:80]}

    def bg_status(self, pid: int) -> str:
        """Check if a background process is still running."""
        try:
            os.kill(pid, 0)
            return "running"
        except OSError:
            return "completed"

    def bg_list(self, log_dir: str = None) -> list:
        """List local background job logs."""
        log_dir = log_dir or os.path.join(self._module_dir(), '.logs')
        if not os.path.isdir(log_dir):
            return []
        logs = []
        for f in sorted(Path(log_dir).glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True):
            logs.append({
                "file": str(f),
                "name": f.name,
                "size": f.stat().st_size,
                "modified": time.ctime(f.stat().st_mtime),
            })
        return logs

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
        """List orbit/core modules. Falls back to m.mods() if server is down."""
        try:
            q = f"?q={search}" if search else ""
            return self._request("GET", f"/modules{q}").get("modules", [])
        except ConnectionError:
            all_mods = m.mods(search)
            return all_mods if isinstance(all_mods, list) else list(all_mods)

    def repos(self, search: str = None) -> list:
        q = f"?q={search}" if search else ""
        return self._request("GET", f"/repos{q}").get("repos", [])

    def files(self, path: str = "~/mod", depth: int = 3) -> list:
        return self._request("GET", f"/files/tree?path={path}&depth={depth}").get("tree", [])

    def owner(self) -> dict:
        """Get owner info. Works offline too."""
        return {"owner": self._owner, "has_owner": bool(self._owner)}

    # ── IPFS versioning ──────────────────────────────────────────

    def _history_path(self) -> Path:
        return self._history_dir / 'cid_history.json'

    def _load_history(self) -> list:
        hp = self._history_path()
        if hp.exists():
            with open(hp, 'r') as f:
                return json.load(f)
        return []

    def _save_history(self, history: list):
        self._history_dir.mkdir(parents=True, exist_ok=True)
        with open(self._history_path(), 'w') as f:
            json.dump(history, f, indent=2)

    def _add_to_history(self, cid: str, description: str, version: str = None):
        history = self._load_history()
        entry = {
            "cid": cid,
            "description": description,
            "timestamp": time.time(),
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        if version:
            entry["version"] = version
        history.append(entry)
        self._save_history(history)

    def get_history(self, limit: int = None) -> list:
        """Get version history, newest first."""
        history = self._load_history()
        history.reverse()
        if limit:
            history = history[:limit]
        return history

    def get_latest_cid(self) -> Optional[str]:
        """Get the most recent CID from history."""
        history = self._load_history()
        return history[-1]["cid"] if history else None

    def snapshot(self, description: str = None, version: str = None, **kwargs) -> dict:
        """Take an IPFS snapshot of the module's source files."""
        try:
            ipfs = m.mod('ipfs')()
        except Exception as e:
            return {"error": f"IPFS not available: {e}"}

        # collect source files
        mod_dir = self._module_dir()
        content = {}
        for ext in ('py', 'json', 'toml', 'rs', 'ts', 'tsx', 'js', 'css'):
            for fp in Path(mod_dir).rglob(f"*.{ext}"):
                rel = str(fp.relative_to(mod_dir))
                if 'node_modules' in rel or 'target' in rel or '.history' in rel:
                    continue
                try:
                    content[rel] = fp.read_text()
                except Exception:
                    pass

        cid = ipfs.put(json.dumps(content))
        desc = description or f"Snapshot {version or time.strftime('%Y%m%d-%H%M%S')}"
        self._add_to_history(cid, desc, version=version)

        return {
            "cid": cid,
            "version": version,
            "description": desc,
            "files": len(content),
            "gateway": f"https://ipfs.io/ipfs/{cid}",
        }

    def changelog(self, limit: int = None) -> list:
        """Get the version changelog (newest first)."""
        return self.get_history(limit=limit)

    def show_changelog(self, limit: int = 20):
        """Display changelog in terminal."""
        history = self.get_history(limit=limit)
        if not history:
            print("No history entries found.")
            return
        print(f"\n{'='*60}")
        print(f"  IPFS CID HISTORY  ({len(history)} entries)")
        print(f"{'='*60}")
        for i, entry in enumerate(history):
            ver = entry.get('version', '')
            ver_str = f"  [{ver}]" if ver else ""
            print(f"\n  {i+1}. {entry['cid'][:16]}...{ver_str}")
            print(f"     {entry.get('date', 'unknown date')}")
            print(f"     {entry.get('description', '')}")
        print(f"\n{'='*60}\n")

    def get_version(self, version: str = None, cid: str = None) -> Optional[dict]:
        """Retrieve a version entry by version label or CID."""
        history = self._load_history()
        for entry in reversed(history):
            if version and entry.get('version') == version:
                return entry
            if cid and entry.get('cid') == cid:
                return entry
        return None

    def restore_version(self, version: str = None, cid: str = None,
                        dry_run: bool = True) -> dict:
        """Restore the module to a previous version from IPFS."""
        entry = self.get_version(version=version, cid=cid)
        if not entry:
            return {"error": f"Version not found: {version or cid}"}

        try:
            ipfs = m.mod('ipfs')()
            data = json.loads(ipfs.get(entry['cid']))
        except Exception as e:
            return {"error": f"Failed to fetch from IPFS: {e}"}

        if dry_run:
            return {
                "dry_run": True,
                "cid": entry['cid'],
                "files": list(data.keys()) if isinstance(data, dict) else [],
                "description": entry.get('description'),
            }

        mod_dir = self._module_dir()
        restored = []
        for rel_path, content in data.items():
            fp = Path(mod_dir) / rel_path
            fp.parent.mkdir(parents=True, exist_ok=True)
            fp.write_text(content)
            restored.append(rel_path)

        return {
            "restored": restored,
            "cid": entry['cid'],
            "count": len(restored),
        }

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

    def serve(self, port=8821, prod=False, api_port=8820, **kwargs):
        """Start the claude API server (pm2) and Next.js app (pm2)."""
        pm2 = m.mod('pm.pm2')()
        module_dir = self._module_dir()
        name = self.config.get('name', 'claude')
        api_url = f'http://localhost:{api_port}'
        app_url = f'http://localhost:{port}'
        api_result = None
        app_result = None

        # ── API (Rust job server) ──
        api_cwd = os.path.join(module_dir, 'api')
        if not os.path.isdir(api_cwd):
            api_cwd = os.path.join(module_dir, 'src', 'api')
        api_script = os.path.join(api_cwd, 'start.sh')
        api_name = f'{name}-api'
        if os.path.isfile(api_script):
            if pm2.exists(api_name):
                pm2.kill(api_name, remove_script=False)
            api_result = pm2.start_script(
                name=api_name,
                script_path=api_script,
                cwd=api_cwd,
                interpreter='bash'
            )

        # ── App (Next.js) ──
        app_cwd = os.path.join(module_dir, 'app')
        if not os.path.isdir(app_cwd):
            app_cwd = os.path.join(module_dir, 'src', 'app')
        app_pkg = os.path.join(app_cwd, 'package.json')
        app_name = f'{name}-app'
        if os.path.isfile(app_pkg):
            cmd = f'npm run build && npm run start' if prod else f'npm run dev -- -p {port}'
            app_script = os.path.join(app_cwd, '_serve_app.sh')
            with open(app_script, 'w') as f:
                f.write(f'#!/bin/bash\ncd {app_cwd}\nexport NEXT_PUBLIC_API_URL="{api_url}"\n{cmd}\n')
            os.chmod(app_script, 0o755)
            if pm2.exists(app_name):
                pm2.kill(app_name, remove_script=False)
            app_result = pm2.start_script(
                name=app_name,
                script_path=app_script,
                cwd=app_cwd,
                interpreter='bash'
            )

        # ── Update config.json with URLs ──
        try:
            cfg = self._load_config()
            if 'urls' not in cfg:
                cfg['urls'] = {}
            cfg['urls']['api'] = api_url
            cfg['urls']['app'] = app_url
            cfg['api_url'] = api_url
            cfg['app_url'] = app_url
            self._save_config(cfg)
        except Exception:
            pass

        result = {'status': 'started', 'urls': {}}
        if api_result:
            result['api'] = api_result
            result['urls']['api'] = api_url
        if app_result:
            result['app'] = app_result
            result['urls']['app'] = app_url
        if not api_result and not app_result:
            return {'status': 'error', 'message': 'No api/ or app/ directory found to serve'}
        result['message'] = f"Started: {', '.join(result['urls'].values())}"
        return result

    def logs(self, service='both', lines=100, follow=False):
        """View logs for API and/or app servers.

        Args:
            service: 'api', 'app', or 'both' (default)
            lines: Number of lines to show (default 100)
            follow: Follow logs in real-time (default False)
        """
        pm2 = m.mod('pm.pm2')()
        name = self.config.get('name', 'claude')

        if service in ('api', 'both'):
            api_name = f'{name}-api'
            print(f"\n{'='*60}")
            print(f"API LOGS ({api_name})")
            print(f"{'='*60}")
            print(pm2.logs(api_name, lines=lines, follow=False))

        if service in ('app', 'both'):
            app_name = f'{name}-app'
            print(f"\n{'='*60}")
            print(f"APP LOGS ({app_name})")
            print(f"{'='*60}")
            print(pm2.logs(app_name, lines=lines, follow=False))

        if follow:
            # Follow logs in real-time
            target = f'{name}-api' if service == 'api' else f'{name}-app' if service == 'app' else name
            print(f"\n🔄 Following logs for {target}... (Ctrl+C to stop)")
            return pm2.logs(target, follow=True, blocking=True)

    # ── test ──────────────────────────────────────────────────────

    def _run_test(self, results, name, fn):
        """Run a single test, append to results."""
        try:
            fn()
            results["passed"] += 1
            results["tests"].append({"name": name, "status": "ok"})
        except Exception as e:
            results["failed"] += 1
            results["tests"].append({"name": name, "status": "fail", "error": str(e)})

    def test(self) -> dict:
        """Run self-tests. Returns {passed, failed, total}."""
        results = {"passed": 0, "failed": 0, "tests": []}

        # 1: init
        def t_init():
            assert self.config is not None
            assert self.default_path is not None
            assert self.default_path.rstrip('/').endswith('/mod'), \
                f"default_path should end with /mod, got {self.default_path}"
        self._run_test(results, "init", t_init)

        # 2: owner + token auth
        def t_auth():
            assert self._owner is not None, "owner should always be set"
            tok = self.token()
            assert isinstance(tok, str) and len(tok) > 0
            verified = self.verify(tok)
            assert verified['key'] == self.key.address
        self._run_test(results, "owner_auth", t_auth)

        # 3: history
        def t_history():
            h = self.get_history()
            assert isinstance(h, list)
        self._run_test(results, "history", t_history)

        # 4: modules fallback
        def t_modules():
            mods = self.modules()
            assert isinstance(mods, list)
        self._run_test(results, "modules", t_modules)

        # 5: bg_list
        def t_bg_list():
            bl = self.bg_list()
            assert isinstance(bl, list)
        self._run_test(results, "bg_list", t_bg_list)

        # 6: API auto-start (ensure_api)
        def t_ensure_api():
            self._ensure_api()
            assert self._server_available(), "API should be reachable after _ensure_api"
        self._run_test(results, "ensure_api", t_ensure_api)

        # 7: health endpoint
        def t_health():
            h = self.health()
            assert isinstance(h, dict), "health should return a dict"
        self._run_test(results, "health", t_health)

        # 8: submit + fetch job (real integration test)
        def t_job_lifecycle():
            job = self.submit(
                prompt="echo hello from test — respond with just 'test_ok'",
                model="haiku",
                work_dir=os.path.expanduser('~/mod')
            )
            assert 'id' in job, f"submit should return job id, got {job}"
            job_id = job['id']
            # fetch it back
            detail = self.job(job_id)
            assert detail.get('id') == job_id, "job fetch should return same id"
            assert detail.get('status') in ('pending', 'running', 'completed', 'failed')
            # list jobs should include it
            all_jobs = self.jobs()
            ids = [j['id'] for j in all_jobs]
            assert job_id in ids, f"job {job_id} should appear in jobs list"
            # clean up — cancel then delete
            if detail.get('status') in ('pending', 'running'):
                self.cancel(job_id)
            self.delete_job(job_id)
        self._run_test(results, "job_lifecycle", t_job_lifecycle)

        # 9: idle timeout config
        def t_idle_timeout():
            assert self._idle_timeout > 0, "idle_timeout should be positive"
            assert self._last_activity > 0, "last_activity should be set after API use"
        self._run_test(results, "idle_timeout", t_idle_timeout)

        results["total"] = results["passed"] + results["failed"]
        return results

    def __repr__(self):
        server = "connected" if self._server_available() else "offline"
        return f"<Claude api={self.api_url} server={server} owner={self._owner or 'none'}>"
