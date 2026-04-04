"""
Tests for the Worker module (mod core wrapper around WorkerPool).

Run:  pytest mod/core/server/worker/test/
"""
import pytest
import time
import os
from mod.core.server.worker.worker import Worker


class TestWorkerModuleUnit:
    """Unit tests for the Worker module class."""

    def test_init_defaults(self):
        w = Worker()
        s = w.status()
        assert s['min_workers'] == 1
        assert s['max_workers'] == 10
        assert s['current_workers'] >= 1
        w.shutdown()

    def test_init_custom(self):
        w = Worker(min_workers=2, max_workers=4, idle_timeout=30)
        s = w.status()
        assert s['min_workers'] == 2
        assert s['max_workers'] == 4
        assert s['current_workers'] >= 2
        w.shutdown()

    def test_status_returns_dict(self):
        w = Worker()
        s = w.status()
        assert isinstance(s, dict)
        for key in ['min_workers', 'max_workers', 'current_workers',
                     'busy_workers', 'idle_workers', 'total_tasks', 'workers']:
            assert key in s
        w.shutdown()

    def test_scale_up(self):
        w = Worker(min_workers=1, max_workers=5)
        s = w.scale(3)
        assert s['current_workers'] == 3
        w.shutdown()

    def test_scale_down(self):
        w = Worker(min_workers=1, max_workers=5)
        w.scale(4)
        s = w.scale(2)
        assert s['current_workers'] == 2
        w.shutdown()

    def test_deploy_changes_limits(self):
        w = Worker(min_workers=1, max_workers=5)
        s = w.deploy(min_workers=2, max_workers=8)
        assert s['min_workers'] == 2
        assert s['max_workers'] == 8
        assert s['current_workers'] >= 2
        w.shutdown()

    def test_kill_all(self):
        w = Worker(min_workers=2, max_workers=5)
        w.scale(3)
        result = w.kill_all()
        assert result['status'] == 'all workers killed'
        assert w.status()['current_workers'] == 0
        w.shutdown()

    def test_shutdown(self):
        w = Worker()
        result = w.shutdown()
        assert result['status'] == 'shutdown'

    def test_kill_nonexistent(self):
        w = Worker()
        assert w.kill('does-not-exist') is False
        w.shutdown()


class TestWorkerModuleIntegration:
    """Integration tests that run real tasks through the Worker module."""

    @pytest.fixture(autouse=True)
    def worker(self):
        self.w = Worker(min_workers=1, max_workers=5)
        time.sleep(6)  # let worker subprocess import mod
        yield
        self.w.shutdown()

    def test_run_function(self):
        result = self.w.run(fn='time', timeout=15)
        assert isinstance(result, (int, float))

    def test_run_with_params(self):
        result = self.w.run(fn='store/ls', params={}, timeout=15)
        assert isinstance(result, list)

    def test_run_with_cid(self):
        result = self.w.run(fn='time', cid='test-cid-123', timeout=15)
        assert result is not None

    def test_run_error(self):
        with pytest.raises(RuntimeError):
            self.w.run(fn='totally_fake_module/nope', timeout=15)

    def test_multiple_runs(self):
        r1 = self.w.run(fn='time', timeout=15)
        r2 = self.w.run(fn='time', timeout=15)
        r3 = self.w.run(fn='time', timeout=15)
        assert r1 <= r2 <= r3

    def test_scale_then_run(self):
        self.w.scale(3)
        time.sleep(6)
        result = self.w.run(fn='time', timeout=15)
        assert result is not None
        assert self.w.status()['current_workers'] == 3

    def test_deploy_then_run(self):
        self.w.deploy(min_workers=2, max_workers=6)
        time.sleep(6)
        result = self.w.run(fn='time', timeout=15)
        assert result is not None
        s = self.w.status()
        assert s['min_workers'] == 2
        assert s['max_workers'] == 6


class TestWorkerModDiscovery:
    """Test that the Worker module is discoverable via the mod system."""

    def test_mod_discovery(self):
        import mod as m
        results = m.search('server.worker', update=True)
        assert 'server.worker' in results

    def test_mod_instantiate(self):
        import mod as m
        w = m.mod('server.worker')()
        assert hasattr(w, 'run')
        assert hasattr(w, 'status')
        assert hasattr(w, 'scale')
        assert hasattr(w, 'deploy')
        assert hasattr(w, 'kill')
        assert hasattr(w, 'kill_all')
        assert hasattr(w, 'shutdown')
        w.shutdown()
