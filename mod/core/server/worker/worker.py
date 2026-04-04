"""
Worker - Auto-scaling sandboxed worker pool for module execution.

Exposes WorkerPool as a mod core module so it can be used via:
    m.mod('worker')()
    m.fn('worker/status')()
    m.fn('worker/scale')(n=3)
"""

from mod.core.server.executor.worker import WorkerPool, SandboxWorker, ALLOWED_DIRS


class Worker:
    """Mod-compatible wrapper around WorkerPool for auto-scaling sandboxed execution."""

    def __init__(self, min_workers: int = 1, max_workers: int = 10, idle_timeout: int = 60):
        self.pool = WorkerPool(
            min_workers=min_workers,
            max_workers=max_workers,
            idle_timeout=idle_timeout,
        )
        self.pool.start()

    def run(self, fn: str, params: dict = None, timeout: int = 120, cid: str = None):
        """Execute a module function on a sandboxed worker.

        Args:
            fn: Function path like 'store/ls' or 'chain/balance'
            params: Parameters dict to pass to the function
            timeout: Wall-clock timeout in seconds
            cid: Optional task CID for tracking/killing
        """
        return self.pool.run(fn_path=fn, params=params or {}, timeout=timeout, cid=cid)

    def status(self):
        """Get pool status with per-worker details."""
        return self.pool.status()

    def scale(self, n: int = 1):
        """Manually scale the pool to n workers (clamped to min/max)."""
        return self.pool.scale(n)

    def deploy(self, min_workers: int = 1, max_workers: int = 10):
        """Reconfigure scaling limits on the fly."""
        return self.pool.set_limits(min_workers=min_workers, max_workers=max_workers)

    def kill(self, cid: str):
        """Kill the worker running a specific task CID."""
        return self.pool.kill(cid)

    def kill_all(self):
        """Kill all workers and reset the pool."""
        self.pool.kill_all()
        return {'status': 'all workers killed'}

    def shutdown(self):
        """Stop the pool entirely."""
        self.pool.shutdown()
        return {'status': 'shutdown'}
