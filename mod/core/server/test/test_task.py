"""
Tests for executor Task class.
"""
import pytest
import sys
import time
from concurrent.futures._base import Future
from mod.core.server.executor.task import Task


class TestTask:
    """Unit tests for Task."""

    def test_create_task_with_callable(self):
        fn = lambda x: x * 2
        t = Task(fn=fn, params={'x': 5})
        assert t.status == 'pending'
        assert t.timeout == 10
        assert t.value == 1
        assert isinstance(t.future, Future)

    def test_create_task_with_non_callable(self):
        """Non-callable fn gets wrapped in a lambda."""
        t = Task(fn='static_value', params={})
        assert t.status == 'pending'

    def test_run_task_success(self):
        fn = lambda x, y: x + y
        t = Task(fn=fn, params={'x': 3, 'y': 7})
        t.run()
        assert t.status == 'complete'
        assert t.future.result() == 10

    def test_run_task_exception(self):
        def bad_fn():
            raise ValueError("test error")
        t = Task(fn=bad_fn, params={})
        t.run()
        assert t.status == 'failed'
        result = t.future.result()
        assert 'error' in result
        assert 'test error' in result['error']

    def test_run_task_timeout(self):
        fn = lambda: 'ok'
        t = Task(fn=fn, params={}, timeout=0)
        time.sleep(0.01)  # ensure timeout
        t.run()
        with pytest.raises(TimeoutError):
            t.future.result()

    def test_task_ordering(self):
        t1 = Task(fn=lambda: 1, params={}, value=1)
        t2 = Task(fn=lambda: 2, params={}, value=2)
        assert t1 < t2
        assert not t2 < t1

    def test_null_task(self):
        val, task = Task.null()
        assert val == sys.maxsize

    def test_task_with_path(self):
        t = Task(fn=lambda: 1, params={}, path='/tmp/test')
        assert t.path == '/tmp/test'

    def test_future_attribute_delegation(self):
        t = Task(fn=lambda: 1, params={})
        # These should be delegated from Future
        assert hasattr(t, 'cancel')
        assert hasattr(t, 'done')
        assert hasattr(t, 'running')
        assert hasattr(t, 'result')
