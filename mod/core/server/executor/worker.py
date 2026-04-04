"""
SandboxWorker & WorkerPool - Isolated subprocess execution for module functions.

Spawns Python subprocesses with filesystem and resource restrictions
to compartmentalize risk when executing user module code.

Only ~/.mod, ~/mod, and ~/.localfs directories are accessible to worker processes.

WorkerPool maintains persistent worker processes that auto-scale between
min_workers and max_workers based on queue depth.
"""

import os
import sys
import json
import signal
import subprocess
import threading
import time
import traceback
import queue
from typing import Any, Dict, Optional, List
from concurrent.futures._base import Future


# Directories that worker processes are allowed to access
ALLOWED_DIRS = [
    os.path.realpath(os.path.expanduser('~/.mod')),
    os.path.realpath(os.path.expanduser('~/mod')),
    os.path.realpath(os.path.expanduser('~/.localfs')),
]

# Resource limits for worker processes
DEFAULT_MEMORY_LIMIT = 512 * 1024 * 1024  # 512MB
DEFAULT_CPU_LIMIT = 120  # 120 seconds CPU time
DEFAULT_TIMEOUT = 120  # 120 seconds wall-clock time


class _PersistentWorker:
    """A single persistent sandboxed subprocess that processes tasks in a loop."""

    def __init__(self, worker_id: int):
        self.worker_id = worker_id
        self.proc: Optional[subprocess.Popen] = None
        self.busy = False
        self.current_cid: Optional[str] = None
        self.tasks_completed = 0
        self.started_at = 0.0
        self.last_active = 0.0
        self._lock = threading.Lock()

    def start(self):
        """Spawn the persistent worker subprocess."""
        self.proc = subprocess.Popen(
            [sys.executable, '-u', __file__, '--persistent'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
            env={
                **os.environ,
                'MOD_SANDBOX': '1',
                'MOD_WORKER_ID': str(self.worker_id),
                'MOD_ALLOWED_DIRS': json.dumps(ALLOWED_DIRS),
            },
        )
        self.started_at = time.time()
        self.last_active = time.time()

    @property
    def alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def execute(self, fn_path: str, params: dict, timeout: int = DEFAULT_TIMEOUT,
                cid: str = None) -> Any:
        """Send a task to the persistent worker and wait for the result."""
        if not self.alive:
            self.start()

        with self._lock:
            self.busy = True
            self.current_cid = cid

        task_line = json.dumps({
            'fn': fn_path,
            'params': params,
        }) + '\n'

        try:
            self.proc.stdin.write(task_line.encode('utf-8'))
            self.proc.stdin.flush()

            # Read result line with timeout
            result_line = self._read_line_timeout(timeout)
            if result_line is None:
                raise TimeoutError(f"Worker {self.worker_id} timed out after {timeout}s")

            result_data = json.loads(result_line)
            self.tasks_completed += 1
            self.last_active = time.time()

            if result_data.get('error'):
                raise RuntimeError(result_data['error'])
            return result_data.get('result')

        except (BrokenPipeError, OSError):
            # Worker died, will be restarted on next use
            self._cleanup()
            raise RuntimeError(f"Worker {self.worker_id} process died unexpectedly")

        finally:
            with self._lock:
                self.busy = False
                self.current_cid = None

    def _read_line_timeout(self, timeout: int) -> Optional[str]:
        """Read a line from stdout with a timeout using a thread."""
        result = [None]
        error = [None]

        def _read():
            try:
                line = self.proc.stdout.readline()
                if line:
                    result[0] = line.decode('utf-8').strip()
            except Exception as e:
                error[0] = e

        reader = threading.Thread(target=_read, daemon=True)
        reader.start()
        reader.join(timeout=timeout)

        if reader.is_alive():
            # Timed out - kill and restart worker
            self._cleanup()
            return None

        if error[0]:
            raise error[0]
        return result[0]

    def kill(self):
        """Kill this worker process."""
        self._cleanup()

    def _cleanup(self):
        if self.proc and self.proc.poll() is None:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                pass
            try:
                self.proc.kill()
            except (ProcessLookupError, PermissionError):
                pass
        self.proc = None
        self.busy = False
        self.current_cid = None


class WorkerPool:
    """
    Auto-scaling pool of persistent sandboxed worker processes.

    Maintains between min_workers and max_workers persistent processes.
    Scales up when tasks are queued and all workers are busy.
    Scales down idle workers (above min) after idle_timeout seconds.
    """

    def __init__(self, min_workers: int = 1, max_workers: int = 10, idle_timeout: int = 60):
        self.min_workers = max(1, min_workers)
        self.max_workers = max(self.min_workers, max_workers)
        self.idle_timeout = idle_timeout
        self._workers: List[_PersistentWorker] = []
        self._lock = threading.RLock()  # RLock: status() can be called inside locked sections
        self._task_queue: queue.Queue = queue.Queue()
        self._cid_to_worker: Dict[str, _PersistentWorker] = {}
        self._running = False
        self._scaler_thread: Optional[threading.Thread] = None
        self._dispatch_threads: List[threading.Thread] = []
        self.total_tasks = 0
        self._started = False

    def start(self):
        """Boot the pool with min_workers and start the auto-scaler."""
        if self._started:
            return
        self._running = True
        self._started = True
        # Spawn initial min workers
        for i in range(self.min_workers):
            w = _PersistentWorker(worker_id=i)
            w.start()
            self._workers.append(w)
        # Start auto-scaler
        self._scaler_thread = threading.Thread(target=self._auto_scale_loop, daemon=True)
        self._scaler_thread.start()

    def run(self, fn_path: str, params: dict, timeout: int = DEFAULT_TIMEOUT,
            cid: str = None) -> Any:
        """
        Execute a module function on an available worker.
        Blocks until a worker is available or scales up if possible.
        """
        if not self._started:
            self.start()

        worker = self._acquire_worker()
        if worker is None:
            raise PermissionError(f"No workers available (max={self.max_workers})")

        if cid:
            with self._lock:
                self._cid_to_worker[cid] = worker

        try:
            self.total_tasks += 1
            return worker.execute(fn_path, params, timeout=timeout, cid=cid)
        finally:
            if cid:
                with self._lock:
                    self._cid_to_worker.pop(cid, None)

    def _acquire_worker(self) -> Optional[_PersistentWorker]:
        """Get an idle worker, or scale up if possible. Waits briefly if all busy."""
        with self._lock:
            # Try to find an idle, alive worker
            for w in self._workers:
                if not w.busy and w.alive:
                    return w
            # Try to find an idle, dead worker and restart it
            for w in self._workers:
                if not w.busy:
                    w.start()
                    return w
            # Scale up if under max
            if len(self._workers) < self.max_workers:
                w = _PersistentWorker(worker_id=len(self._workers))
                w.start()
                self._workers.append(w)
                return w

        # All workers busy, wait briefly for one to free up
        for _ in range(100):  # wait up to 10 seconds
            time.sleep(0.1)
            with self._lock:
                for w in self._workers:
                    if not w.busy:
                        if not w.alive:
                            w.start()
                        return w
        return None

    def _auto_scale_loop(self):
        """Background thread that scales down idle workers above min_workers."""
        while self._running:
            time.sleep(5)
            now = time.time()
            with self._lock:
                # Don't scale below min
                if len(self._workers) <= self.min_workers:
                    continue
                # Find idle workers beyond min that have been idle too long
                to_remove = []
                for i in range(len(self._workers) - 1, self.min_workers - 1, -1):
                    w = self._workers[i]
                    if not w.busy and (now - w.last_active) > self.idle_timeout:
                        to_remove.append(i)
                for i in to_remove:
                    w = self._workers.pop(i)
                    w.kill()

    def scale(self, n: int) -> dict:
        """Manually set the target worker count (clamped to min/max)."""
        if not self._started:
            self.start()
        n = max(self.min_workers, min(n, self.max_workers))
        with self._lock:
            current = len(self._workers)
            if n > current:
                # Scale up
                for i in range(current, n):
                    w = _PersistentWorker(worker_id=i)
                    w.start()
                    self._workers.append(w)
            elif n < current:
                # Scale down (remove idle from the end)
                removed = 0
                for i in range(current - 1, -1, -1):
                    if len(self._workers) <= n:
                        break
                    w = self._workers[i]
                    if not w.busy:
                        self._workers.pop(i)
                        w.kill()
                        removed += 1
            return self.status()

    def set_limits(self, min_workers: int = None, max_workers: int = None) -> dict:
        """Update min/max worker limits."""
        if min_workers is not None:
            self.min_workers = max(1, min_workers)
        if max_workers is not None:
            self.max_workers = max(self.min_workers, max_workers)
        # Ensure current count respects new limits
        with self._lock:
            # Scale up to min if needed
            while len(self._workers) < self.min_workers:
                w = _PersistentWorker(worker_id=len(self._workers))
                w.start()
                self._workers.append(w)
            # Scale down to max if needed (remove idle from end)
            while len(self._workers) > self.max_workers:
                for i in range(len(self._workers) - 1, -1, -1):
                    w = self._workers[i]
                    if not w.busy and len(self._workers) > self.max_workers:
                        self._workers.pop(i)
                        w.kill()
                        break
                else:
                    break  # All above max are busy, can't remove yet
        return self.status()

    def kill(self, cid: str) -> bool:
        """Kill the worker running a specific task CID."""
        with self._lock:
            w = self._cid_to_worker.pop(cid, None)
        if w is None:
            return False
        w.kill()
        # Restart it so the slot isn't lost
        w.start()
        return True

    def kill_all(self):
        """Kill all workers."""
        with self._lock:
            for w in self._workers:
                w.kill()
            self._workers.clear()
            self._cid_to_worker.clear()

    def shutdown(self):
        """Stop the pool entirely."""
        self._running = False
        self.kill_all()
        self._started = False

    def status(self) -> dict:
        with self._lock:
            workers = []
            busy_count = 0
            for w in self._workers:
                info = {
                    'id': w.worker_id,
                    'alive': w.alive,
                    'busy': w.busy,
                    'tasks_completed': w.tasks_completed,
                    'current_cid': w.current_cid,
                    'uptime': round(time.time() - w.started_at, 1) if w.started_at else 0,
                    'idle_for': round(time.time() - w.last_active, 1) if w.last_active else 0,
                }
                if w.busy:
                    busy_count += 1
                workers.append(info)
            return {
                'min_workers': self.min_workers,
                'max_workers': self.max_workers,
                'current_workers': len(self._workers),
                'busy_workers': busy_count,
                'idle_workers': len(self._workers) - busy_count,
                'total_tasks': self.total_tasks,
                'idle_timeout': self.idle_timeout,
                'workers': workers,
            }


# Keep SandboxWorker for backwards compat (one-shot subprocess per task)
class SandboxWorker:
    """One-shot sandboxed subprocess per task (legacy). Prefer WorkerPool."""

    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
        self._active: Dict[str, subprocess.Popen] = {}
        self._lock = threading.Lock()

    @property
    def active_count(self) -> int:
        with self._lock:
            dead = [k for k, p in self._active.items() if p.poll() is not None]
            for k in dead:
                del self._active[k]
            return len(self._active)

    def run(self, fn_path: str, params: dict, timeout: int = DEFAULT_TIMEOUT,
            cid: str = None) -> Any:
        if self.active_count >= self.max_workers:
            raise PermissionError(f"Max workers ({self.max_workers}) exceeded")

        task_payload = json.dumps({
            'fn': fn_path,
            'params': params,
            'allowed_dirs': ALLOWED_DIRS,
            'memory_limit': DEFAULT_MEMORY_LIMIT,
            'cpu_limit': DEFAULT_CPU_LIMIT,
        })

        proc = subprocess.Popen(
            [sys.executable, '-u', __file__],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
            env={
                **os.environ,
                'MOD_SANDBOX': '1',
                'MOD_ALLOWED_DIRS': json.dumps(ALLOWED_DIRS),
            },
        )

        if cid:
            with self._lock:
                self._active[cid] = proc

        try:
            stdout_data, stderr_data = proc.communicate(
                input=task_payload.encode('utf-8'),
                timeout=timeout,
            )

            result_str = stdout_data.decode('utf-8').strip()
            stderr_str = stderr_data.decode('utf-8', errors='replace').strip()

            if result_str:
                try:
                    result_data = json.loads(result_str)
                    if result_data.get('error'):
                        raise RuntimeError(result_data['error'])
                    if proc.returncode == 0:
                        return result_data.get('result')
                except json.JSONDecodeError:
                    pass

            if proc.returncode != 0:
                error_msg = stderr_str or result_str or 'Unknown worker error'
                raise RuntimeError(f"Worker failed (exit {proc.returncode}): {error_msg}")

            return None

        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
            proc.kill()
            raise TimeoutError(f"Worker timed out after {timeout}s")

        finally:
            if cid:
                with self._lock:
                    self._active.pop(cid, None)
            if proc.poll() is None:
                try:
                    proc.kill()
                except (ProcessLookupError, PermissionError):
                    pass

    def kill(self, cid: str) -> bool:
        with self._lock:
            proc = self._active.pop(cid, None)
        if proc is None:
            return False
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            proc.kill()
        except (ProcessLookupError, PermissionError):
            pass
        return True

    def kill_all(self):
        with self._lock:
            procs = list(self._active.values())
            self._active.clear()
        for proc in procs:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass

    def status(self) -> dict:
        return {
            'active_workers': self.active_count,
            'max_workers': self.max_workers,
            'active_cids': list(self._active.keys()),
        }


# ============================================================
# Worker child process entry point (runs in subprocess)
# ============================================================

def _apply_sandbox(allowed_dirs: List[str], memory_limit: int, cpu_limit: int):
    """Apply sandbox restrictions in the child process."""
    import builtins
    import resource

    # --- Resource limits ---
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit, cpu_limit))
    except (ValueError, resource.error):
        pass  # May not be supported on all platforms

    try:
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
    except (ValueError, resource.error):
        pass  # macOS may not support RLIMIT_AS

    # Resolve allowed dirs to absolute real paths
    resolved_dirs = [os.path.realpath(d) for d in allowed_dirs]
    # Also allow /tmp for temporary files and Python stdlib paths
    safe_prefixes = resolved_dirs + [
        '/tmp',
        os.path.dirname(os.__file__),  # Python stdlib
        sys.prefix,  # Python installation
    ]
    # Add site-packages
    for p in sys.path:
        if 'site-packages' in p or 'lib/python' in p:
            safe_prefixes.append(os.path.realpath(p))

    # --- Filesystem restriction via monkey-patching open() ---
    _original_open = builtins.open

    def _restricted_open(file, *args, **kwargs):
        # Allow StringIO, BytesIO, file descriptors
        if isinstance(file, int):
            return _original_open(file, *args, **kwargs)
        resolved = os.path.realpath(str(file))
        # Allow reads from Python stdlib and site-packages
        mode = args[0] if args else kwargs.get('mode', 'r')
        is_read = 'r' in str(mode) and 'w' not in str(mode) and 'a' not in str(mode)
        if is_read:
            # Allow reading from anywhere in Python path for imports
            if any(resolved.startswith(p) for p in safe_prefixes):
                return _original_open(file, *args, **kwargs)
        # For writes, strictly enforce allowed dirs
        if any(resolved.startswith(d) for d in resolved_dirs):
            return _original_open(file, *args, **kwargs)
        # Allow reading from safe prefixes even in non-explicit read mode
        if any(resolved.startswith(p) for p in safe_prefixes):
            return _original_open(file, *args, **kwargs)
        raise PermissionError(f"Sandbox: access denied to {file} (resolved: {resolved})")

    builtins.open = _restricted_open

    # --- Restrict os.open ---
    _original_os_open = os.open

    def _restricted_os_open(path, flags, *args, **kwargs):
        resolved = os.path.realpath(str(path))
        if any(resolved.startswith(d) for d in resolved_dirs):
            return _original_os_open(path, flags, *args, **kwargs)
        if any(resolved.startswith(p) for p in safe_prefixes):
            return _original_os_open(path, flags, *args, **kwargs)
        raise PermissionError(f"Sandbox: os.open denied for {path}")

    os.open = _restricted_os_open

    # --- Restrict subprocess ---
    try:
        import subprocess as _sp
        _original_popen = _sp.Popen

        class RestrictedPopen(_original_popen):
            def __init__(self, *args, **kwargs):
                raise PermissionError("Sandbox: subprocess.Popen is not allowed")

        _sp.Popen = RestrictedPopen
    except Exception:
        pass

    # --- Restrict os.system ---
    def _blocked_system(cmd):
        raise PermissionError("Sandbox: os.system is not allowed")
    os.system = _blocked_system

    # --- Restrict os.exec* ---
    for attr in ['execl', 'execle', 'execlp', 'execlpe', 'execv', 'execve', 'execvp', 'execvpe']:
        if hasattr(os, attr):
            setattr(os, attr, lambda *a, **kw: (_ for _ in ()).throw(
                PermissionError(f"Sandbox: os.{attr} is not allowed")))


def worker_main():
    """Entry point for one-shot sandboxed worker subprocess."""
    try:
        # Read task from stdin
        raw = sys.stdin.buffer.read()
        task = json.loads(raw.decode('utf-8'))

        fn_path = task['fn']
        params = task['params']
        allowed_dirs = task.get('allowed_dirs', ALLOWED_DIRS)
        memory_limit = task.get('memory_limit', DEFAULT_MEMORY_LIMIT)
        cpu_limit = task.get('cpu_limit', DEFAULT_CPU_LIMIT)

        # Apply sandbox restrictions BEFORE importing any module code
        _apply_sandbox(allowed_dirs, memory_limit, cpu_limit)

        # Redirect stdout to stderr so print() calls from module code
        # don't corrupt the JSON protocol on stdout
        _real_stdout = sys.stdout
        sys.stdout = sys.stderr

        # Now import mod and resolve the function
        import mod as m
        fn_obj = m.fn(fn_path)
        if callable(fn_obj):
            result = fn_obj(**params)
        else:
            result = fn_obj

        # Handle generators
        if hasattr(result, '__next__'):
            result = list(result)

        # Serialize result back on the real stdout
        sys.stdout = _real_stdout
        output = json.dumps({'result': result})
        sys.stdout.write(output)
        sys.stdout.flush()

    except Exception as e:
        tb = traceback.format_exc()
        error_output = json.dumps({
            'error': str(e),
            'traceback': tb,
        })
        # Restore real stdout in case it was redirected
        if '_real_stdout' in dir():
            sys.stdout = _real_stdout
        sys.stdout.write(error_output)
        sys.stdout.flush()


def worker_persistent_main():
    """Entry point for persistent sandboxed worker subprocess.

    Reads one JSON task per line from stdin, executes it,
    writes one JSON result line to stdout. Loops until stdin closes.
    """
    allowed_dirs = json.loads(os.environ.get('MOD_ALLOWED_DIRS', json.dumps(ALLOWED_DIRS)))
    _apply_sandbox(allowed_dirs, DEFAULT_MEMORY_LIMIT, DEFAULT_CPU_LIMIT)

    _real_stdout = sys.stdout
    sys.stdout = sys.stderr  # Redirect prints to stderr

    import mod as m

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            task = json.loads(line)
            fn_path = task['fn']
            params = task.get('params', {})

            fn_obj = m.fn(fn_path)
            if callable(fn_obj):
                result = fn_obj(**params)
            else:
                result = fn_obj

            if hasattr(result, '__next__'):
                result = list(result)

            output = json.dumps({'result': result})
        except Exception as e:
            tb = traceback.format_exc()
            output = json.dumps({'error': str(e), 'traceback': tb})

        _real_stdout.write(output + '\n')
        _real_stdout.flush()


if __name__ == '__main__':
    if '--persistent' in sys.argv:
        worker_persistent_main()
    else:
        worker_main()
