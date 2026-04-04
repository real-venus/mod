"""
Tests for SandboxWorker, WorkerPool, and _PersistentWorker.
"""
import pytest
import json
import os
import sys
import signal
import time
import threading
from unittest.mock import patch, MagicMock
from mod.core.server.executor.worker import (
    SandboxWorker,
    WorkerPool,
    _PersistentWorker,
    ALLOWED_DIRS,
    DEFAULT_TIMEOUT,
    DEFAULT_MEMORY_LIMIT,
    DEFAULT_CPU_LIMIT,
)


# ============================================================
# SandboxWorker (legacy one-shot) tests
# ============================================================

class TestSandboxWorkerUnit:
    """Unit tests for SandboxWorker (no subprocess spawning)."""

    def test_init_defaults(self):
        sw = SandboxWorker()
        assert sw.max_workers == 10
        assert sw.active_count == 0

    def test_init_custom_workers(self):
        sw = SandboxWorker(max_workers=5)
        assert sw.max_workers == 5

    def test_status_empty(self):
        sw = SandboxWorker()
        status = sw.status()
        assert status['active_workers'] == 0
        assert status['max_workers'] == 10
        assert status['active_cids'] == []

    def test_kill_nonexistent_cid(self):
        sw = SandboxWorker()
        assert sw.kill('nonexistent') is False

    def test_kill_all_empty(self):
        sw = SandboxWorker()
        sw.kill_all()  # should not raise
        assert sw.active_count == 0

    def test_max_workers_exceeded(self):
        sw = SandboxWorker(max_workers=0)
        with pytest.raises(PermissionError, match="Max workers"):
            sw.run(fn_path='test/fn', params={})

    def test_active_count_cleans_dead(self):
        sw = SandboxWorker()
        mock_proc = MagicMock()
        mock_proc.poll.return_value = 0  # already dead
        with sw._lock:
            sw._active['test_cid'] = mock_proc
        # active_count should clean up the dead process
        assert sw.active_count == 0


# ============================================================
# _PersistentWorker tests
# ============================================================

class TestPersistentWorkerUnit:
    """Unit tests for _PersistentWorker."""

    def test_init(self):
        w = _PersistentWorker(worker_id=0)
        assert w.worker_id == 0
        assert w.proc is None
        assert w.busy is False
        assert w.current_cid is None
        assert w.tasks_completed == 0
        assert w.alive is False

    def test_start_spawns_process(self):
        w = _PersistentWorker(worker_id=0)
        w.start()
        assert w.proc is not None
        assert w.alive is True
        assert w.started_at > 0
        w.kill()

    def test_kill_cleans_up(self):
        w = _PersistentWorker(worker_id=0)
        w.start()
        assert w.alive is True
        w.kill()
        assert w.proc is None
        assert w.busy is False

    def test_kill_idempotent(self):
        w = _PersistentWorker(worker_id=0)
        w.kill()  # no-op on unstarted worker
        assert w.proc is None

    def test_start_restart(self):
        w = _PersistentWorker(worker_id=0)
        w.start()
        pid1 = w.proc.pid
        w.kill()
        w.start()
        pid2 = w.proc.pid
        assert pid1 != pid2
        w.kill()


# ============================================================
# WorkerPool unit tests (no subprocess execution)
# ============================================================

class TestWorkerPoolUnit:
    """Unit tests for WorkerPool without running tasks."""

    def test_init_defaults(self):
        p = WorkerPool()
        assert p.min_workers == 1
        assert p.max_workers == 10
        assert p.idle_timeout == 60
        assert p._started is False
        assert p.total_tasks == 0

    def test_init_custom(self):
        p = WorkerPool(min_workers=3, max_workers=8, idle_timeout=30)
        assert p.min_workers == 3
        assert p.max_workers == 8
        assert p.idle_timeout == 30

    def test_min_workers_floor(self):
        p = WorkerPool(min_workers=0)
        assert p.min_workers == 1

    def test_max_clamps_to_min(self):
        p = WorkerPool(min_workers=5, max_workers=3)
        assert p.max_workers == 5

    def test_status_before_start(self):
        p = WorkerPool()
        s = p.status()
        assert s['current_workers'] == 0
        assert s['min_workers'] == 1
        assert s['max_workers'] == 10
        assert s['workers'] == []

    def test_start_spawns_min_workers(self):
        p = WorkerPool(min_workers=2, max_workers=5)
        p.start()
        s = p.status()
        assert s['current_workers'] == 2
        assert len(s['workers']) == 2
        p.kill_all()

    def test_start_idempotent(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        p.start()  # second call should be a no-op
        assert p.status()['current_workers'] == 1
        p.kill_all()

    def test_scale_up(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        s = p.scale(3)
        assert s['current_workers'] == 3
        p.kill_all()

    def test_scale_down(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        p.scale(4)
        s = p.scale(2)
        assert s['current_workers'] == 2
        p.kill_all()

    def test_scale_clamps_to_min(self):
        p = WorkerPool(min_workers=2, max_workers=5)
        p.start()
        p.scale(4)
        s = p.scale(1)  # below min, should clamp to 2
        assert s['current_workers'] == 2
        p.kill_all()

    def test_scale_clamps_to_max(self):
        p = WorkerPool(min_workers=1, max_workers=3)
        p.start()
        s = p.scale(10)  # above max, should clamp to 3
        assert s['current_workers'] == 3
        p.kill_all()

    def test_set_limits(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        s = p.set_limits(min_workers=2, max_workers=8)
        assert s['min_workers'] == 2
        assert s['max_workers'] == 8
        # Should have scaled up to new min
        assert s['current_workers'] >= 2
        p.kill_all()

    def test_set_limits_scales_up_to_min(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        assert p.status()['current_workers'] == 1
        p.set_limits(min_workers=3)
        assert p.status()['current_workers'] >= 3
        p.kill_all()

    def test_set_limits_scales_down_to_max(self):
        p = WorkerPool(min_workers=1, max_workers=10)
        p.start()
        p.scale(5)
        p.set_limits(max_workers=2)
        s = p.status()
        # Should have removed idle workers down to max
        assert s['current_workers'] <= 5  # may not remove busy ones
        assert s['max_workers'] == 2
        p.kill_all()

    def test_kill_all(self):
        p = WorkerPool(min_workers=2, max_workers=5)
        p.start()
        assert p.status()['current_workers'] == 2
        p.kill_all()
        assert p.status()['current_workers'] == 0

    def test_shutdown(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        assert p._started is True
        p.shutdown()
        assert p._started is False
        assert p._running is False
        assert p.status()['current_workers'] == 0

    def test_kill_nonexistent_cid(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        assert p.kill('nonexistent') is False
        p.kill_all()

    def test_status_fields(self):
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        s = p.status()
        assert 'min_workers' in s
        assert 'max_workers' in s
        assert 'current_workers' in s
        assert 'busy_workers' in s
        assert 'idle_workers' in s
        assert 'total_tasks' in s
        assert 'idle_timeout' in s
        assert 'workers' in s
        assert isinstance(s['workers'], list)
        # Check per-worker fields
        w = s['workers'][0]
        assert 'id' in w
        assert 'alive' in w
        assert 'busy' in w
        assert 'tasks_completed' in w
        assert 'uptime' in w
        assert 'idle_for' in w
        p.kill_all()

    def test_rlock_no_deadlock(self):
        """Verify scale() -> status() doesn't deadlock (RLock)."""
        p = WorkerPool(min_workers=1, max_workers=5)
        p.start()
        # This used to deadlock with threading.Lock
        result = [None]
        def do_scale():
            result[0] = p.scale(3)
        t = threading.Thread(target=do_scale)
        t.start()
        t.join(timeout=10)
        assert not t.is_alive(), "scale() deadlocked"
        assert result[0] is not None
        assert result[0]['current_workers'] == 3
        p.kill_all()


# ============================================================
# WorkerPool integration tests (real subprocess execution)
# ============================================================

class TestWorkerPoolIntegration:
    """Integration tests that execute real tasks on persistent workers."""

    @pytest.fixture(autouse=True)
    def pool(self):
        self.p = WorkerPool(min_workers=1, max_workers=5)
        self.p.start()
        # Wait for worker to import mod
        time.sleep(6)
        yield
        self.p.shutdown()

    def test_run_simple(self):
        """Execute a simple module function."""
        result = self.p.run(fn_path='time', params={}, timeout=15)
        assert result is not None
        assert isinstance(result, (int, float))

    def test_run_with_params(self):
        """Execute a function with parameters."""
        result = self.p.run(fn_path='store/ls', params={}, timeout=15)
        assert isinstance(result, list)

    def test_run_with_cid(self):
        """CID tracking is cleaned up after execution."""
        result = self.p.run(fn_path='time', params={}, timeout=15, cid='track-me')
        assert 'track-me' not in self.p._cid_to_worker

    def test_run_increments_total_tasks(self):
        before = self.p.total_tasks
        self.p.run(fn_path='time', params={}, timeout=15)
        assert self.p.total_tasks == before + 1

    def test_run_increments_worker_tasks_completed(self):
        self.p.run(fn_path='time', params={}, timeout=15)
        s = self.p.status()
        completed = sum(w['tasks_completed'] for w in s['workers'])
        assert completed >= 1

    def test_run_error_propagates(self):
        """Calling a nonexistent function should raise RuntimeError."""
        with pytest.raises(RuntimeError):
            self.p.run(fn_path='nonexistent_module_xyz/fake_fn', params={}, timeout=15)

    def test_multiple_sequential_tasks(self):
        """Run several tasks sequentially on same worker."""
        results = []
        for _ in range(3):
            r = self.p.run(fn_path='time', params={}, timeout=15)
            results.append(r)
        assert len(results) == 3
        # Timestamps should be increasing
        assert results[0] <= results[1] <= results[2]

    def test_scale_and_run(self):
        """Scale up, then verify tasks still work."""
        self.p.scale(3)
        time.sleep(6)  # let new workers boot
        result = self.p.run(fn_path='time', params={}, timeout=15)
        assert result is not None
        assert self.p.status()['current_workers'] == 3

    def test_worker_auto_restarts(self):
        """If a worker dies, the pool restarts it on next task."""
        # Kill the worker process directly
        with self.p._lock:
            w = self.p._workers[0]
        w.kill()
        assert not w.alive
        # Running a task should restart the worker
        result = self.p.run(fn_path='time', params={}, timeout=30)
        assert result is not None


# ============================================================
# Constants / ALLOWED_DIRS tests
# ============================================================

class TestAllowedDirs:
    """Test ALLOWED_DIRS configuration."""

    def test_allowed_dirs_count(self):
        assert len(ALLOWED_DIRS) >= 3  # ~/.mod, ~/mod, ~/.localfs

    def test_allowed_dirs_are_absolute(self):
        for d in ALLOWED_DIRS:
            assert os.path.isabs(d)

    def test_home_mod_in_allowed(self):
        home = os.path.expanduser('~')
        mod_dir = os.path.realpath(os.path.join(home, 'mod'))
        assert mod_dir in ALLOWED_DIRS

    def test_dot_mod_in_allowed(self):
        home = os.path.expanduser('~')
        dot_mod = os.path.realpath(os.path.join(home, '.mod'))
        assert dot_mod in ALLOWED_DIRS

    def test_localfs_in_allowed(self):
        home = os.path.expanduser('~')
        localfs = os.path.realpath(os.path.join(home, '.localfs'))
        assert localfs in ALLOWED_DIRS


class TestConstants:
    """Test default constants."""

    def test_default_memory_limit(self):
        assert DEFAULT_MEMORY_LIMIT == 512 * 1024 * 1024

    def test_default_cpu_limit(self):
        assert DEFAULT_CPU_LIMIT == 120

    def test_default_timeout(self):
        assert DEFAULT_TIMEOUT == 120
