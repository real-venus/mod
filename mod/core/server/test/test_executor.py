"""
Tests for the Executor thread pool.
"""
import pytest
import time
import threading
from mod.core.server.executor.executor import Executor


class TestExecutor:
    """Unit tests for Executor."""

    def test_init_defaults(self):
        e = Executor()
        assert e.max_workers > 0
        assert e.mode == 'thread'
        assert e.broken is False
        assert e.shutdown is False
        assert e.is_empty is True

    def test_init_custom_workers(self):
        e = Executor(max_workers=3)
        assert e.max_workers == 3

    def test_init_zero_workers_raises(self):
        with pytest.raises(ValueError, match="max_workers must be greater than 0"):
            Executor(max_workers=0)

    def test_submit_and_get_result(self):
        e = Executor(max_workers=2)
        future = e.submit(fn=lambda x: x * 2, params={'x': 5})
        result = future.result(timeout=5)
        assert result == 10

    def test_submit_multiple(self):
        e = Executor(max_workers=4)
        futures = [e.submit(fn=lambda x: x ** 2, params={'x': i}) for i in range(5)]
        results = [f.result(timeout=5) for f in futures]
        assert results == [0, 1, 4, 9, 16]

    def test_submit_error_returns_error_dict(self):
        def failing():
            raise ValueError("boom")
        e = Executor(max_workers=2)
        future = e.submit(fn=failing, params={})
        result = future.result(timeout=5)
        assert isinstance(result, dict)
        assert 'error' in result
        assert 'boom' in result['error']

    def test_num_tasks(self):
        e = Executor(max_workers=1)
        # Submit tasks faster than they can be processed
        results = []
        for i in range(3):
            f = e.submit(fn=lambda x: x, params={'x': i})
            results.append(f)
        # Wait for all to complete
        for f in results:
            f.result(timeout=5)

    def test_status(self):
        e = Executor(max_workers=2)
        status = e.status()
        assert 'num_threads' in status
        assert 'num_tasks' in status
        assert 'is_empty' in status
        assert 'is_full' in status

    def test_do_shutdown(self):
        e = Executor(max_workers=2)
        f = e.submit(fn=lambda: 42, params={})
        f.result(timeout=5)
        e.do_shutdown(wait=True)
        assert e.shutdown is True

    def test_submit_alias(self):
        """submit is an alias for forward."""
        assert Executor.submit is Executor.forward

    def test_concurrent_execution(self):
        """Verify tasks run concurrently, not sequentially."""
        e = Executor(max_workers=4)
        start = time.time()
        futures = []
        for _ in range(4):
            f = e.submit(fn=lambda: time.sleep(0.1) or 'done', params={})
            futures.append(f)
        for f in futures:
            f.result(timeout=5)
        elapsed = time.time() - start
        # 4 tasks at 0.1s each, with 4 workers, should be ~0.1s not ~0.4s
        assert elapsed < 0.3
