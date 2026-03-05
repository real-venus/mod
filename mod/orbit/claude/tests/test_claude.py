"""
Tests for the Claude Code interface module.

Run with: pytest tests/test_claude.py -v -s
The -s flag shows output during tests.
"""
import pytest
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from claude.claude import Mod, run_claude


class TestClaudeModule:
    """Test suite for Claude Code interface."""

    @pytest.fixture
    def claude_mod(self):
        """Create a Claude module instance for testing."""
        # Use current directory as default
        return Mod(default_path=os.getcwd())

    @pytest.fixture
    def test_dir(self, tmp_path):
        """Create a temporary test directory with a sample file."""
        test_file = tmp_path / "test.py"
        test_file.write_text("""
def hello():
    print("Hello World")

hello()
""")
        return str(tmp_path)

    def test_initialization(self, claude_mod):
        """Test that the module initializes correctly."""
        assert claude_mod is not None
        assert claude_mod.default_path is not None
        assert claude_mod.claude_bin is not None
        print(f"\n✓ Claude initialized with path: {claude_mod.default_path}")

    def test_set_log_level(self, claude_mod):
        """Test setting log level."""
        claude_mod.set_log_level("DEBUG")
        claude_mod.set_log_level("INFO")
        claude_mod.set_log_level("WARNING")
        print("\n✓ Log levels changed successfully")

    @pytest.mark.skipif(
        not os.environ.get('ANTHROPIC_API_KEY'),
        reason="No API key available"
    )
    def test_forward_with_stream(self, claude_mod, test_dir):
        """Test forward function with streaming output enabled."""
        print(f"\n\n{'='*60}")
        print("Testing Claude Code with STREAMING OUTPUT")
        print(f"{'='*60}\n")

        result = claude_mod.forward(
            query="What files are in this directory?",
            path=test_dir,
            output_format="text",
            stream_output=True  # Enable streaming
        )

        print(f"\n{'='*60}")
        print("RESULT:")
        print(f"{'='*60}")
        print(result)
        assert result is not None

    @pytest.mark.skipif(
        not os.environ.get('ANTHROPIC_API_KEY'),
        reason="No API key available"
    )
    def test_forward_json_output(self, claude_mod, test_dir):
        """Test forward function with JSON output."""
        print(f"\n\n{'='*60}")
        print("Testing Claude Code with JSON OUTPUT")
        print(f"{'='*60}\n")

        result = claude_mod.forward(
            query="List the files in this directory",
            path=test_dir,
            output_format="json",
            stream_output=True
        )

        print(f"\n{'='*60}")
        print("RESULT:")
        print(f"{'='*60}")
        print(result)
        assert result is not None

    @pytest.mark.skipif(
        not os.environ.get('ANTHROPIC_API_KEY'),
        reason="No API key available"
    )
    def test_analyze_code(self, claude_mod, test_dir):
        """Test code analysis feature."""
        print(f"\n\n{'='*60}")
        print("Testing CODE ANALYSIS")
        print(f"{'='*60}\n")

        result = claude_mod.analyze_code(
            path=test_dir,
            focus="code quality",
            stream_output=True
        )

        print(f"\n{'='*60}")
        print("ANALYSIS RESULT:")
        print(f"{'='*60}")
        print(result)
        assert result is not None

    @pytest.mark.skipif(
        not os.environ.get('ANTHROPIC_API_KEY'),
        reason="No API key available"
    )
    def test_edit_file(self, claude_mod, test_dir):
        """Test file editing feature."""
        print(f"\n\n{'='*60}")
        print("Testing FILE EDITING")
        print(f"{'='*60}\n")

        result = claude_mod.edit_file(
            file_path="test.py",
            instructions="Add a docstring to the hello function",
            path=test_dir,
            stream_output=True
        )

        print(f"\n{'='*60}")
        print("EDIT RESULT:")
        print(f"{'='*60}")
        print(result)
        assert result is not None

    def test_quick_run_function(self, test_dir):
        """Test the convenience run_claude function."""
        if not os.environ.get('ANTHROPIC_API_KEY'):
            pytest.skip("No API key available")

        print(f"\n\n{'='*60}")
        print("Testing QUICK RUN FUNCTION")
        print(f"{'='*60}\n")

        result = run_claude(
            "What Python files exist here?",
            path=test_dir,
            stream_output=True
        )

        print(f"\n{'='*60}")
        print("RESULT:")
        print(f"{'='*60}")
        print(result)
        assert result is not None


# Run tests with verbose output
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
