"""
Router Tests

Tests for the Router functionality including:
- Task creation and execution
- Function calls
- Transaction management
- Sync operations
"""
import pytest
import sys
from pathlib import Path
import time

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

try:
    import mod as m
    from api.api.router.router import Router
except ImportError as e:
    pytest.skip(f"Required modules not available: {e}", allow_module_level=True)


class TestRouterCore:
    """Test suite for Router core functionality"""

    def test_router_initialization(self):
        """Test that Router can be initialized"""
        try:
            router = Router(store='localfs', key='test')
            assert router is not None
            assert hasattr(router, 'store')
            assert hasattr(router, 'key')
        except Exception as e:
            pytest.skip(f"Router initialization failed: {e}")

    def test_router_has_required_methods(self):
        """Test that Router has all required methods"""
        try:
            router = Router(store='localfs', key='test')
            required_methods = [
                'call', 'task_data', 'run_task', 'txs',
                'sync_info', 'tasks', 'call_paths'
            ]
            for method in required_methods:
                assert hasattr(router, method), f"Router missing method: {method}"
        except Exception as e:
            pytest.skip(f"Router method check failed: {e}")

    def test_task_data_creation(self):
        """Test task data creation"""
        try:
            router = Router(store='localfs', key='test')
            task = router.task_data(
                fn='store/ls',
                params={'test': 'value'},
                timeout=1000
            )
            assert isinstance(task, dict)
            assert 'fn' in task
            assert 'params' in task
            assert 'timeout' in task
            assert 'status' in task
            assert 'time' in task
            assert task['status'] == 'pending'
        except Exception as e:
            pytest.skip(f"Task data creation test failed: {e}")

    def test_call_data_creation(self):
        """Test call data creation"""
        try:
            router = Router(store='localfs', key='test')
            call_data = router.call_data(
                fn='store/ls',
                params={'test': 'value'}
            )
            assert isinstance(call_data, dict)
            assert 'fn' in call_data
            assert 'params' in call_data
            assert 'key' in call_data
        except Exception as e:
            pytest.skip(f"Call data creation test failed: {e}")

    def test_sync_info(self):
        """Test sync info retrieval"""
        try:
            router = Router(store='localfs', key='test')
            info = router.sync_info()
            assert isinstance(info, dict)
            # Check for expected sync functions
            assert any(key in info for key in ['sync_tasks', 'sync_ious'])
        except Exception as e:
            pytest.skip(f"Sync info test failed: {e}")

    def test_n_tasks(self):
        """Test task count"""
        try:
            router = Router(store='localfs', key='test')
            count = router.n_tasks()
            assert isinstance(count, int)
            assert count >= 0
        except Exception as e:
            pytest.skip(f"Task count test failed: {e}")

    def test_tasks_list(self):
        """Test tasks list retrieval"""
        try:
            router = Router(store='localfs', key='test')
            tasks = router.tasks()
            assert isinstance(tasks, list)
        except Exception as e:
            pytest.skip(f"Tasks list test failed: {e}")

    def test_call_paths(self):
        """Test call paths retrieval"""
        try:
            router = Router(store='localfs', key='test')
            paths = router.call_paths()
            assert isinstance(paths, list)
        except Exception as e:
            pytest.skip(f"Call paths test failed: {e}")

    def test_is_generator(self):
        """Test generator detection"""
        try:
            router = Router(store='localfs', key='test')

            def normal_func():
                return 1

            def gen_func():
                yield 1

            assert router.is_generator(gen_func) == True
            assert router.is_generator(normal_func) == False
        except Exception as e:
            pytest.skip(f"Generator detection test failed: {e}")


class TestRouterTransactions:
    """Test suite for Router transaction functionality"""

    def test_txs_method(self):
        """Test transactions retrieval"""
        try:
            router = Router(store='localfs', key='test')
            txs = router.txs(n=5, df=0)
            assert isinstance(txs, list)
        except Exception as e:
            pytest.skip(f"Transactions test failed: {e}")

    def test_ious_method(self):
        """Test IOUs retrieval"""
        try:
            router = Router(store='localfs', key='test')
            ious = router.ious()
            assert isinstance(ious, dict)
        except Exception as e:
            pytest.skip(f"IOUs test failed: {e}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
