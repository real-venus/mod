"""
Tests for the pluggable backend system
"""

import sys
import os
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from claude.backends import (
    Backend,
    BackendRegistry,
    ClaudeCodeBackend,
    DevToolsBackend,
    CodexBackend,
    registry
)


class TestBackendRegistry:
    """Test backend registry functionality"""

    def test_registry_exists(self):
        """Test that global registry exists"""
        assert registry is not None
        assert isinstance(registry, BackendRegistry)

    def test_registry_has_default_backends(self):
        """Test that default backends are registered"""
        backends = list(registry.backends.keys())
        assert 'claude-code' in backends
        assert 'dev-tools' in backends
        assert 'codex' in backends

    def test_list_available(self):
        """Test listing available backends"""
        backends = registry.list_available()
        assert isinstance(backends, list)
        assert len(backends) >= 3

        for b in backends:
            assert 'name' in b
            assert 'description' in b
            assert 'available' in b

    def test_get_backend(self):
        """Test getting backend by name"""
        backend = registry.get_backend('claude-code')
        assert isinstance(backend, ClaudeCodeBackend)
        assert backend.name == 'claude-code'

    def test_get_invalid_backend(self):
        """Test error when getting invalid backend"""
        with pytest.raises(ValueError):
            registry.get_backend('nonexistent-backend')

    def test_auto_select(self):
        """Test automatic backend selection"""
        backend = registry.auto_select()
        assert isinstance(backend, Backend)
        assert backend.name in ['claude-code', 'dev-tools', 'codex']

    def test_register_custom_backend(self):
        """Test registering a custom backend"""

        class TestBackend(Backend):
            @property
            def name(self):
                return "test"

            @property
            def description(self):
                return "Test backend"

            def is_available(self):
                return True

            def install(self):
                return True

            def forward(self, query, **kwargs):
                return {"test": True}

        # Register
        registry.register('test', TestBackend)

        # Get it
        backend = registry.get_backend('test')
        assert isinstance(backend, TestBackend)
        assert backend.name == 'test'


class TestClaudeCodeBackend:
    """Test Claude Code CLI backend"""

    def test_backend_properties(self):
        """Test backend name and description"""
        backend = ClaudeCodeBackend()
        assert backend.name == 'claude-code'
        assert 'Claude Code' in backend.description

    def test_is_available(self):
        """Test availability check"""
        backend = ClaudeCodeBackend()
        # May or may not be available depending on system
        result = backend.is_available()
        assert isinstance(result, bool)

    def test_api_key_from_env(self):
        """Test API key loading from environment"""
        # Save original
        original = os.environ.get('ANTHROPIC_API_KEY')

        try:
            # Set test key
            os.environ['ANTHROPIC_API_KEY'] = 'test-key-123'

            backend = ClaudeCodeBackend()
            assert backend.api_key == 'test-key-123'

        finally:
            # Restore original
            if original:
                os.environ['ANTHROPIC_API_KEY'] = original
            elif 'ANTHROPIC_API_KEY' in os.environ:
                del os.environ['ANTHROPIC_API_KEY']

    def test_api_key_from_init(self):
        """Test API key from init"""
        backend = ClaudeCodeBackend(api_key='custom-key')
        assert backend.api_key == 'custom-key'


class TestDevToolsBackend:
    """Test dev tools backend"""

    def test_backend_properties(self):
        """Test backend name and description"""
        backend = DevToolsBackend()
        assert backend.name == 'dev-tools'
        assert 'dev' in backend.description.lower()

    def test_is_available(self):
        """Test availability check"""
        backend = DevToolsBackend()
        result = backend.is_available()
        assert isinstance(result, bool)


class TestCodexBackend:
    """Test Codex backend"""

    def test_backend_properties(self):
        """Test backend name and description"""
        backend = CodexBackend()
        assert backend.name == 'codex'
        assert 'OpenAI' in backend.description or 'Codex' in backend.description

    def test_is_available_without_openai(self):
        """Test availability when OpenAI not installed"""
        backend = CodexBackend()
        # May or may not be available
        result = backend.is_available()
        assert isinstance(result, bool)

    def test_api_key_loading(self):
        """Test API key loading"""
        original = os.environ.get('OPENAI_API_KEY')

        try:
            os.environ['OPENAI_API_KEY'] = 'sk-test-123'
            backend = CodexBackend()
            assert backend.api_key == 'sk-test-123'

        finally:
            if original:
                os.environ['OPENAI_API_KEY'] = original
            elif 'OPENAI_API_KEY' in os.environ:
                del os.environ['OPENAI_API_KEY']


class TestCustomBackend:
    """Test creating custom backends"""

    def test_custom_backend_interface(self):
        """Test implementing custom backend"""

        class CustomBackend(Backend):
            @property
            def name(self):
                return "custom"

            @property
            def description(self):
                return "Custom test backend"

            def is_available(self):
                return True

            def install(self):
                return True

            def forward(self, query, **kwargs):
                return {
                    "backend": self.name,
                    "query": query,
                    "success": True
                }

        backend = CustomBackend()

        # Test properties
        assert backend.name == "custom"
        assert backend.description == "Custom test backend"

        # Test methods
        assert backend.is_available() == True
        assert backend.install() == True

        # Test forward
        result = backend.forward("test query")
        assert result["backend"] == "custom"
        assert result["query"] == "test query"
        assert result["success"] == True


class TestBackendIntegration:
    """Integration tests for backend system"""

    def test_can_import_backends(self):
        """Test that backends can be imported"""
        from claude.backends import Backend, registry
        assert Backend is not None
        assert registry is not None

    def test_can_create_all_backends(self):
        """Test that all default backends can be instantiated"""
        backends_to_test = ['claude-code', 'dev-tools', 'codex']

        for name in backends_to_test:
            backend = registry.get_backend(name)
            assert backend is not None
            assert backend.name == name


def run_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("BACKEND SYSTEM TESTS")
    print("="*60 + "\n")

    # Run with pytest if available
    try:
        import pytest
        pytest.main([__file__, '-v'])
    except ImportError:
        print("pytest not available, running manual tests...\n")

        # Manual test execution
        test_classes = [
            TestBackendRegistry,
            TestClaudeCodeBackend,
            TestDevToolsBackend,
            TestCodexBackend,
            TestCustomBackend,
            TestBackendIntegration
        ]

        passed = 0
        failed = 0

        for test_class in test_classes:
            print(f"\nTesting {test_class.__name__}...")
            instance = test_class()

            for method_name in dir(instance):
                if method_name.startswith('test_'):
                    try:
                        method = getattr(instance, method_name)
                        method()
                        print(f"  ✓ {method_name}")
                        passed += 1
                    except Exception as e:
                        print(f"  ✗ {method_name}: {e}")
                        failed += 1

        print("\n" + "="*60)
        print(f"RESULTS: {passed} passed, {failed} failed")
        print("="*60 + "\n")

        return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
