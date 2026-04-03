"""
Tests for the Claude Code interface module.

Run with: pytest tests/test_claude.py -v -s
The -s flag shows output during tests.

Tests are split into:
  - Unit tests: Always run, no API/CLI needed
  - CLI tests: Require claude binary (Max auth or API key)
  - Server tests: Require the Rust job server running
  - Permission tests: Test owner-based access control
  - IPFS tests: Test IPFS storage and history tracking
"""
import pytest
import os
import sys
import subprocess
import json
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from claude.claude import Mod, run_claude


# ── Helpers ──────────────────────────────────────────────────────

def has_claude_cli():
    """Check if claude CLI is installed."""
    try:
        result = subprocess.run(["which", "claude"], capture_output=True, text=True)
        return result.returncode == 0
    except Exception:
        return False

def has_api_key():
    """Check if an API key is available."""
    return bool(os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('ANTHROPIC_AUTH_TOKEN'))

def has_max_auth():
    """Check if Claude Max OAuth is configured."""
    auth_file = Path.home() / '.claude' / '.credentials.json'
    if auth_file.exists():
        return True
    # Also check for oauth tokens
    config_dir = Path.home() / '.claude'
    if config_dir.exists():
        for f in config_dir.iterdir():
            if 'auth' in f.name.lower() or 'oauth' in f.name.lower() or 'credential' in f.name.lower():
                return True
    return False

def can_run_claude():
    """Check if we can actually run claude (CLI exists + some auth)."""
    return has_claude_cli() and (has_api_key() or has_max_auth())

def is_server_running():
    """Check if the Rust job server is running."""
    try:
        import urllib.request
        url = os.environ.get('CLAUDE_JOBS_URL', 'http://localhost:8820') + '/health'
        with urllib.request.urlopen(url, timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


skip_no_cli = pytest.mark.skipif(not has_claude_cli(), reason="Claude CLI not installed")
skip_no_auth = pytest.mark.skipif(not can_run_claude(), reason="No auth available (need API key or Max subscription)")
skip_no_server = pytest.mark.skipif(not is_server_running(), reason="Job server not running")


# ── Unit Tests (always run) ─────────────────────────────────────

class TestUnit:
    """Unit tests that run without any external dependencies."""

    def test_init_no_api_key(self):
        """Init works without an API key (Max auth mode)."""
        env_override = {k: v for k, v in os.environ.items()
                        if k not in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN')}
        with patch.dict(os.environ, env_override, clear=True):
            mod = Mod(default_path="/tmp")
            assert mod is not None
            assert mod.default_path == "/tmp"
            assert mod.api_key is None
            # Should not raise — Max auth doesn't need a key
            print("\n  Init without API key: OK (Max auth mode)")

    def test_init_with_api_key(self):
        """Init works with an explicit API key."""
        mod = Mod(default_path="/tmp", api_key="sk-test-fake-key")
        assert mod.api_key == "sk-test-fake-key"
        print("\n  Init with API key: OK")

    def test_init_api_key_from_env(self):
        """Init picks up API key from environment."""
        with patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'sk-env-key'}):
            mod = Mod(default_path="/tmp")
            assert mod.api_key == 'sk-env-key'
            print("\n  Init from ANTHROPIC_API_KEY env: OK")

    def test_init_auth_token_from_env(self):
        """Init picks up auth token from ANTHROPIC_AUTH_TOKEN."""
        with patch.dict(os.environ, {'ANTHROPIC_AUTH_TOKEN': 'token-123'}, clear=False):
            mod = Mod(default_path="/tmp")
            assert mod.api_key == 'token-123'
            print("\n  Init from ANTHROPIC_AUTH_TOKEN env: OK")

    def test_set_log_level(self):
        """Log level can be changed."""
        Mod.set_log_level("DEBUG")
        Mod.set_log_level("WARNING")
        Mod.set_log_level("INFO")
        print("\n  Log levels: OK")

    def test_default_model(self):
        """Default model is set correctly."""
        mod = Mod(default_path="/tmp")
        assert mod.model == 'anthropic/claude-opus-4'
        print("\n  Default model: OK")

    def test_custom_model(self):
        """Custom model can be set."""
        mod = Mod(default_path="/tmp", model="anthropic/claude-sonnet-4")
        assert mod.model == "anthropic/claude-sonnet-4"
        print("\n  Custom model: OK")

    def test_bg_status_not_running(self):
        """bg_status returns completed for non-existent PID."""
        mod = Mod(default_path="/tmp")
        status = mod.bg_status(999999999)
        assert status == "completed"
        print("\n  bg_status for dead PID: OK")

    def test_bg_list_empty(self):
        """bg_list returns empty list when no logs exist."""
        mod = Mod(default_path="/tmp")
        logs = mod.bg_list(log_dir="/tmp/nonexistent_claude_logs")
        assert logs == []
        print("\n  bg_list empty: OK")

    def test_bg_list_with_logs(self, tmp_path):
        """bg_list finds log files."""
        # Create fake log files
        (tmp_path / "task1.log").write_text("log1")
        (tmp_path / "task2.log").write_text("log2")

        mod = Mod(default_path="/tmp")
        logs = mod.bg_list(log_dir=str(tmp_path))
        assert len(logs) == 2
        assert all('file' in l and 'size' in l for l in logs)
        print(f"\n  bg_list found {len(logs)} logs: OK")

    def test_jobs_url_default(self):
        """Jobs URL defaults to localhost:8820."""
        mod = Mod(default_path="/tmp")
        assert mod._jobs_url() == 'http://localhost:8820'
        print("\n  Jobs URL default: OK")

    def test_jobs_url_from_env(self):
        """Jobs URL can be set via env var."""
        with patch.dict(os.environ, {'CLAUDE_JOBS_URL': 'http://myhost:9999'}):
            mod = Mod(default_path="/tmp")
            assert mod._jobs_url() == 'http://myhost:9999'
        print("\n  Jobs URL from env: OK")


# ── CLI Tests (require claude binary + auth) ────────────────────

class TestCLI:
    """Tests that invoke the actual claude CLI."""

    @pytest.fixture
    def claude_mod(self):
        return Mod(default_path=os.getcwd())

    @pytest.fixture
    def test_dir(self, tmp_path):
        test_file = tmp_path / "test.py"
        test_file.write_text('def hello():\n    print("Hello World")\n\nhello()\n')
        return str(tmp_path)

    @skip_no_cli
    def test_claude_binary_found(self, claude_mod):
        """Claude binary is found on the system."""
        assert claude_mod.claude_bin is not None
        assert os.path.exists(claude_mod.claude_bin)
        print(f"\n  Claude binary: {claude_mod.claude_bin}")

    @skip_no_auth
    def test_forward_text(self, claude_mod, test_dir):
        """Forward with text output."""
        result = claude_mod.forward(
            query="Say 'test passed' and nothing else",
            path=test_dir,
            output_format="text",
            stream_output=False
        )
        assert result is not None
        print(f"\n  Forward text result: {str(result)[:100]}")

    @skip_no_auth
    def test_forward_stream(self, claude_mod, test_dir):
        """Forward with streaming output."""
        result = claude_mod.forward(
            query="Say 'stream test' and nothing else",
            path=test_dir,
            output_format="text",
            stream_output=True
        )
        assert result is not None
        print(f"\n  Forward stream result: {str(result)[:100]}")

    @skip_no_auth
    def test_forward_json(self, claude_mod, test_dir):
        """Forward with JSON output."""
        result = claude_mod.forward(
            query="List the files in this directory",
            path=test_dir,
            output_format="json",
            stream_output=False
        )
        assert result is not None
        print(f"\n  Forward JSON result type: {type(result).__name__}")

    @skip_no_auth
    def test_analyze_code(self, claude_mod, test_dir):
        """Code analysis works."""
        result = claude_mod.analyze_code(path=test_dir, focus="code quality")
        assert result is not None
        print(f"\n  Analysis result: OK")

    @skip_no_auth
    def test_edit_file(self, claude_mod, test_dir):
        """File editing works."""
        result = claude_mod.edit_file(
            file_path="test.py",
            instructions="Add a docstring to the hello function",
            path=test_dir
        )
        assert result is not None
        print(f"\n  Edit result: OK")

    @skip_no_auth
    def test_bg_task(self, claude_mod, test_dir, tmp_path):
        """Background task spawns and creates log file."""
        log_dir = str(tmp_path / "logs")
        task = claude_mod.bg(
            prompt="Say 'background test' and nothing else",
            path=test_dir,
            log_dir=log_dir
        )
        assert 'pid' in task
        assert 'log_file' in task
        assert os.path.exists(task['log_file'])
        print(f"\n  BG task PID: {task['pid']}, log: {task['log_file']}")

    @skip_no_auth
    def test_quick_run(self, test_dir):
        """Convenience run_claude function works."""
        result = run_claude(
            "Say 'quick test' and nothing else",
            path=test_dir,
            output_format="text",
            stream_output=False
        )
        assert result is not None
        print(f"\n  Quick run result: {str(result)[:100]}")


# ── Server Tests (require Rust job server running) ──────────────

class TestServer:
    """Tests for the Rust job server integration."""

    @pytest.fixture
    def claude_mod(self):
        return Mod(default_path=os.getcwd())

    @skip_no_server
    def test_server_health(self):
        """Server health check returns ok."""
        import urllib.request
        url = os.environ.get('CLAUDE_JOBS_URL', 'http://localhost:8820') + '/health'
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())
            assert data['status'] == 'ok'
        print("\n  Server health: OK")

    @skip_no_server
    def test_list_jobs(self, claude_mod):
        """Can list jobs from server."""
        jobs = claude_mod.jobs()
        assert isinstance(jobs, list)
        print(f"\n  Jobs listed: {len(jobs)}")

    @skip_no_server
    @skip_no_auth
    def test_submit_and_check(self, claude_mod):
        """Submit a job and check its status."""
        job = claude_mod.submit(
            prompt="Say 'server test' and nothing else",
            model="haiku"
        )
        assert 'id' in job
        assert job.get('status') in ('pending', 'running')

        # Check it shows up in list
        found = claude_mod.job(job['id'])
        assert found is not None
        assert found['id'] == job['id']
        print(f"\n  Submitted job: {job['id'][:8]}, status: {found.get('status')}")


# ── Permission Tests ────────────────────────────────────────────

class TestPermissions:
    """Tests for owner-based access control."""

    @pytest.fixture
    def claude_mod(self, tmp_path):
        """Create a Claude instance with isolated config."""
        # Use temp directory for config
        config_dir = tmp_path / '.mod' / 'claude'
        config_dir.mkdir(parents=True, exist_ok=True)

        with patch('pathlib.Path.home', return_value=tmp_path):
            mod = Mod(default_path=str(tmp_path))
            return mod

    def test_no_owner_by_default(self, claude_mod):
        """No owner is set by default."""
        assert claude_mod.get_owner() is None
        print("\n  No owner by default: OK")

    def test_set_owner(self, claude_mod, tmp_path):
        """Can set an owner."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"

        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod.set_owner(owner_addr)

        assert claude_mod.get_owner() == owner_addr.lower()
        print(f"\n  Set owner: {owner_addr}")

    def test_is_owner_no_owner_set(self, claude_mod):
        """Everyone is owner when no owner is set."""
        assert claude_mod.is_owner("0xanyaddress") is True
        assert claude_mod.is_owner(None) is True
        print("\n  No owner = everyone has access: OK")

    def test_is_owner_match(self, claude_mod, tmp_path):
        """Owner check works correctly."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"

        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod.set_owner(owner_addr)

        assert claude_mod.is_owner(owner_addr) is True
        assert claude_mod.is_owner(owner_addr.upper()) is True  # Case insensitive
        print("\n  Owner check matches: OK")

    def test_is_owner_no_match(self, claude_mod, tmp_path):
        """Non-owner is correctly identified."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"
        other_addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod.set_owner(owner_addr)

        assert claude_mod.is_owner(other_addr) is False
        print("\n  Non-owner check: OK")

    def test_require_owner_success(self, claude_mod, tmp_path):
        """require_owner passes for owner."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"

        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod.set_owner(owner_addr)
            claude_mod.require_owner(owner_addr, "test operation")

        print("\n  Require owner (owner): OK")

    def test_require_owner_failure(self, claude_mod, tmp_path):
        """require_owner raises error for non-owner."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"
        other_addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod.set_owner(owner_addr)

            with pytest.raises(PermissionError) as exc_info:
                claude_mod.require_owner(other_addr, "test operation")

            assert "Access denied" in str(exc_info.value)
            assert "test operation" in str(exc_info.value)

        print("\n  Require owner (non-owner raises error): OK")

    def test_owner_config_persists(self, tmp_path):
        """Owner config is saved and loaded."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"

        with patch('pathlib.Path.home', return_value=tmp_path):
            # Create and set owner
            mod1 = Mod(default_path=str(tmp_path))
            mod1.set_owner(owner_addr)

            # Create new instance - should load owner
            mod2 = Mod(default_path=str(tmp_path))
            assert mod2.get_owner() == owner_addr.lower()

        print("\n  Owner config persists: OK")


# ── IPFS Tests ───────────────────────────────────────────────────

class TestIPFS:
    """Tests for IPFS storage and history tracking."""

    @pytest.fixture
    def claude_mod(self, tmp_path):
        """Create a Claude instance with isolated config."""
        config_dir = tmp_path / '.mod' / 'claude'
        config_dir.mkdir(parents=True, exist_ok=True)

        with patch('pathlib.Path.home', return_value=tmp_path):
            mod = Mod(default_path=str(tmp_path))
            # Mock IPFS to avoid requiring actual IPFS daemon
            mod._ipfs = Mock()
            return mod

    def test_add_to_history(self, claude_mod, tmp_path):
        """Can add entry to history."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod._add_to_history("QmTest123", "Test update")

            history = claude_mod._load_history()
            assert len(history) == 1
            assert history[0]['cid'] == "QmTest123"
            assert history[0]['description'] == "Test update"

        print("\n  Add to history: OK")

    def test_get_history_empty(self, claude_mod):
        """Get history returns empty list when no history."""
        history = claude_mod.get_history()
        assert history == []
        print("\n  Empty history: OK")

    def test_get_history_with_entries(self, claude_mod, tmp_path):
        """Get history returns entries newest first."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod._add_to_history("QmFirst", "First")
            claude_mod._add_to_history("QmSecond", "Second")
            claude_mod._add_to_history("QmThird", "Third")

            history = claude_mod.get_history()
            assert len(history) == 3
            assert history[0]['cid'] == "QmThird"  # Newest first
            assert history[1]['cid'] == "QmSecond"
            assert history[2]['cid'] == "QmFirst"

        print("\n  Get history (newest first): OK")

    def test_get_history_limit(self, claude_mod, tmp_path):
        """Get history respects limit."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            for i in range(10):
                claude_mod._add_to_history(f"QmTest{i}", f"Update {i}")

            history = claude_mod.get_history(limit=5)
            assert len(history) == 5
            assert history[0]['cid'] == "QmTest9"  # Newest

        print("\n  Get history with limit: OK")

    def test_get_latest_cid(self, claude_mod, tmp_path):
        """Get latest CID returns most recent."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod._add_to_history("QmOld", "Old")
            claude_mod._add_to_history("QmNew", "New")

            latest = claude_mod.get_latest_cid()
            assert latest == "QmNew"

        print("\n  Get latest CID: OK")

    def test_get_latest_cid_empty(self, claude_mod):
        """Get latest CID returns None when no history."""
        latest = claude_mod.get_latest_cid()
        assert latest is None
        print("\n  Get latest CID (empty): OK")

    def test_store_to_ipfs(self, claude_mod, tmp_path):
        """Store to IPFS adds to history."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            # Mock IPFS put to return a CID
            claude_mod._ipfs.put = Mock(return_value="QmStored123")

            cid = claude_mod._store_to_ipfs(
                {'test': 'data'},
                description="Test storage"
            )

            assert cid == "QmStored123"
            assert claude_mod._ipfs.put.called

            # Check it was added to history
            history = claude_mod.get_history()
            assert len(history) == 1
            assert history[0]['cid'] == "QmStored123"

        print("\n  Store to IPFS: OK")

    def test_history_file_location(self, tmp_path):
        """History file is in correct location."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            mod = Mod(default_path=str(tmp_path))
            expected_path = tmp_path / '.mod' / 'claude' / 'cid_history.json'
            assert Path(mod.history_path) == expected_path

        print("\n  History file location: OK")

    def test_show_history(self, claude_mod, tmp_path, capsys):
        """Show history displays correctly."""
        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod._add_to_history("QmTest123", "Test update")

            claude_mod.show_history(limit=10)

            captured = capsys.readouterr()
            assert "QmTest123" in captured.out
            assert "Test update" in captured.out
            assert "IPFS CID HISTORY" in captured.out

        print("\n  Show history display: OK")

    def test_show_history_empty(self, claude_mod, capsys):
        """Show history handles empty history."""
        claude_mod.show_history()

        captured = capsys.readouterr()
        assert "No history entries found" in captured.out

        print("\n  Show history (empty): OK")


# ── Integration Tests (Permissions + IPFS + Editing) ────────────

class TestIntegration:
    """Integration tests combining permissions and IPFS."""

    @pytest.fixture
    def claude_mod(self, tmp_path):
        """Create a Claude instance with mocked IPFS."""
        config_dir = tmp_path / '.mod' / 'claude'
        config_dir.mkdir(parents=True, exist_ok=True)

        with patch('pathlib.Path.home', return_value=tmp_path):
            mod = Mod(default_path=str(tmp_path))
            # Mock IPFS
            mod._ipfs = Mock()
            mod._ipfs.put = Mock(return_value="QmMocked123")
            return mod

    @skip_no_auth
    def test_edit_file_owner_permission(self, tmp_path):
        """Edit file requires owner permission."""
        test_file = tmp_path / "test.py"
        test_file.write_text("# Test file\n")

        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"
        other_addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

        with patch('pathlib.Path.home', return_value=tmp_path):
            mod = Mod(default_path=str(tmp_path))
            mod.set_owner(owner_addr)

            # Non-owner cannot edit
            with pytest.raises(PermissionError):
                mod.edit_file(
                    "test.py",
                    "Add a comment",
                    path=str(tmp_path),
                    key=other_addr
                )

        print("\n  Edit file requires owner: OK")

    def test_forward_edit_keywords_require_owner(self, claude_mod, tmp_path):
        """Forward with edit keywords requires owner."""
        owner_addr = "0x1234567890abcdef1234567890abcdef12345678"
        other_addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

        with patch('pathlib.Path.home', return_value=tmp_path):
            claude_mod.set_owner(owner_addr)

            # These keywords should trigger permission check
            edit_queries = [
                "Edit the file",
                "Modify the code",
                "Update the function",
                "Fix the bug",
                "Add a feature",
                "Remove the line",
            ]

            for query in edit_queries:
                # Mock the actual CLI call to avoid needing auth
                with patch.object(claude_mod, 'claude_bin', '/bin/echo'):
                    with pytest.raises(PermissionError):
                        claude_mod.forward(
                            query=query,
                            path=str(tmp_path),
                            key=other_addr
                        )

        print("\n  Edit keywords require owner: OK")


# Run tests with verbose output
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
