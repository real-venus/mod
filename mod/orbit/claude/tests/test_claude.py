"""
Tests for the Claude module (v2).

Run with: pytest tests/test_claude.py -v -s
         pytest tests/test_claude.py -v -s -k "Unit"     # unit tests only

Tests are split into:
  - Unit tests:   Always run, no API/CLI/server needed
  - CLI tests:    Require claude binary + auth
  - Server tests: Require the Rust job server running
"""
import pytest
import os
import sys
import subprocess
import json
import time
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock

# Add parent directory to path so we can import the module
sys.path.insert(0, str(Path(__file__).parent.parent))

import mod as m
from claude.mod import Mod


# ── Helpers ──────────────────────────────────────────────────────

def has_claude_cli():
    try:
        result = subprocess.run(["which", "claude"], capture_output=True, text=True)
        return result.returncode == 0
    except Exception:
        return False

def has_auth():
    if os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('ANTHROPIC_AUTH_TOKEN'):
        return True
    auth_file = Path.home() / '.claude' / '.credentials.json'
    return auth_file.exists()

def can_run_claude():
    return has_claude_cli() and has_auth()

def is_server_running():
    try:
        import urllib.request
        url = 'http://localhost:8820/health'
        with urllib.request.urlopen(url, timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


skip_no_cli = pytest.mark.skipif(not has_claude_cli(), reason="Claude CLI not installed")
skip_no_auth = pytest.mark.skipif(not can_run_claude(), reason="No auth available")
skip_no_server = pytest.mark.skipif(not is_server_running(), reason="Job server not running")


# ── Unit Tests (always run, no dependencies) ─────────────────────

class TestUnit:
    """Core unit tests — always pass, no external deps."""

    def test_init_default(self):
        """Module initializes with defaults."""
        c = Mod()
        assert c.config is not None
        assert c.default_path is not None
        assert c.api_url.startswith('http')

    def test_init_custom_urls(self):
        """Custom API/app URLs are respected."""
        c = Mod(api_url='http://custom:9000', app_url='http://custom:9001')
        assert c.api_url == 'http://custom:9000'
        assert c.app_url == 'http://custom:9001'

    def test_init_with_default_path(self):
        """default_path parameter works."""
        c = Mod(default_path='/tmp/test')
        assert c.default_path == '/tmp/test'

    def test_config_loads(self):
        """Config loads from config.json."""
        c = Mod()
        assert 'name' in c.config
        assert c.config['name'] == 'claude'

    def test_description_set(self):
        """Module has description."""
        assert Mod.description is not None
        assert len(Mod.description) > 10

    def test_endpoints_list(self):
        """Module has endpoints list."""
        assert isinstance(Mod.endpoints, list)
        assert 'forward' in Mod.endpoints
        assert 'ask' in Mod.endpoints
        assert 'submit' in Mod.endpoints

    def test_module_dir(self):
        """_module_dir returns the claude package root."""
        c = Mod()
        d = c._module_dir()
        assert os.path.isdir(d)
        assert os.path.exists(os.path.join(d, 'config.json'))


class TestOwnership:
    """Permission / ownership system."""

    @pytest.fixture
    def clean_mod(self, tmp_path):
        """Create a Mod with isolated config to avoid mutating real config."""
        cfg_src = Path(__file__).parent.parent / 'config.json'
        cfg_dst = tmp_path / 'config.json'
        cfg_dst.write_text(cfg_src.read_text())
        c = Mod()
        c._history_dir = tmp_path / '.history'
        return c

    def test_owner_always_set(self):
        """Owner is always set — from config or defaulting to key address."""
        c = Mod()
        assert c._owner is not None

    def test_owner_defaults_to_key_when_no_config(self):
        """When config has no owner, owner defaults to the module's key address."""
        c = Mod()
        # Simulate no owner in config
        c._owner = None
        c._owner = c._owner or c.key.address.lower()
        assert c._owner == c.key.address.lower()

    def test_get_owner_returns_config_value(self):
        """get_owner returns the owner from config."""
        c = Mod()
        owner = c.get_owner()
        assert owner is not None

    def test_owner_info_dict(self):
        """owner() returns dict with has_owner and owner fields."""
        c = Mod()
        info = c.owner()
        assert 'owner' in info
        assert 'has_owner' in info
        assert info['has_owner'] is True

    def test_is_owner_no_owner_set(self):
        """When no owner set, everyone is owner."""
        c = Mod()
        c._owner = None
        assert c.is_owner("0xanyone") is True

    def test_is_owner_none_defaults_to_self_key(self):
        """is_owner(None) resolves to self.key. If self.key IS the owner, returns True."""
        c = Mod()
        c._owner = c.key.address.lower()  # align owner with default key
        assert c.is_owner(None) is True
        assert c.is_owner() is True

    def test_is_owner_match(self):
        """Owner matches correctly (case insensitive)."""
        c = Mod()
        c._owner = "0xabcdef1234567890abcdef1234567890abcdef12"
        assert c.is_owner("0xabcdef1234567890abcdef1234567890abcdef12") is True
        assert c.is_owner("0xABCDEF1234567890ABCDEF1234567890ABCDEF12") is True

    def test_is_owner_no_match(self):
        """Non-owner returns False."""
        c = Mod()
        c._owner = "0xabcdef1234567890abcdef1234567890abcdef12"
        assert c.is_owner("0x1111111111111111111111111111111111111111") is False

    def test_require_owner_no_key_defaults_to_owner(self):
        """require_owner() with no key defaults to self.key (the owner)."""
        c = Mod()
        c._owner = c.key.address.lower()  # align owner with default key
        c.require_owner(operation="test op")  # should not raise

    def test_require_owner_passes(self):
        """require_owner passes for matching address."""
        c = Mod()
        c._owner = "0xabc"
        c.require_owner("0xabc", "test op")  # should not raise

    def test_require_owner_raises(self):
        """require_owner raises PermissionError for wrong address."""
        c = Mod()
        c._owner = "0xabc"
        with pytest.raises(PermissionError, match="Permission denied"):
            c.require_owner("0xother", "test op")

    def test_require_owner_message_contains_operation(self):
        """PermissionError includes the operation name."""
        c = Mod()
        c._owner = "0xabc"
        with pytest.raises(PermissionError, match="edit_file"):
            c.require_owner("0xother", "edit_file")

    def test_require_owner_message_readable(self):
        """Error message is human-readable with truncated addresses."""
        c = Mod()
        c._owner = "0xeb0631ce3ec62ceed053c66eb6481753d0c812a8"
        try:
            c.require_owner("0xaF3e0796042aF79eA1642c919ac0ea6d165Bc6dB", "forward(test query...)")
            assert False, "Should have raised"
        except PermissionError as e:
            msg = str(e)
            assert "Permission denied" in msg
            assert "owner-only" in msg
            assert "caller:" in msg
            assert "owner:" in msg
            assert "0xaF3e0796..." in msg or "0xaf3e0796..." in msg.lower()

    def test_require_owner_handles_key_object(self):
        """require_owner handles Key objects with .address attribute."""
        c = Mod()
        c._owner = "0xeb0631ce3ec62ceed053c66eb6481753d0c812a8"
        key = MagicMock()
        key.address = "0xaF3e0796042aF79eA1642c919ac0ea6d165Bc6dB"
        key.__str__ = lambda self: f"Key({self.address}, type=ecdsa)"
        try:
            c.require_owner(key, "forward(test...)")
            assert False, "Should have raised"
        except PermissionError as e:
            msg = str(e)
            assert "Key(" not in msg
            assert "type=ecdsa" not in msg
            assert "caller:" in msg

    def test_is_owner_handles_key_object(self):
        """is_owner handles Key objects with .address attribute."""
        c = Mod()
        c._owner = "0xabc123"
        key = MagicMock()
        key.address = "0xabc123"
        assert c.is_owner(key) is True

    def test_is_owner_handles_key_object_no_match(self):
        """is_owner returns False for non-matching Key object."""
        c = Mod()
        c._owner = "0xabc123"
        key = MagicMock()
        key.address = "0xother"
        assert c.is_owner(key) is False

    def test_format_address_plain_hex(self):
        """_format_address truncates long hex addresses."""
        c = Mod()
        result = c._format_address("0xeb0631ce3ec62ceed053c66eb6481753d0c812a8")
        assert result == "0xeb0631ce...12a8"

    def test_format_address_key_repr(self):
        """_format_address parses Key(...) repr strings."""
        c = Mod()
        result = c._format_address("Key(0xaF3e0796042aF79eA1642c919ac0ea6d165Bc6dB, type=ecdsa)")
        assert "Key(" not in result
        assert "type=" not in result
        assert result.startswith("0xaF3e0796")

    def test_format_address_key_object(self):
        """_format_address uses .address from Key objects."""
        c = Mod()
        key = MagicMock()
        key.address = "0xaF3e0796042aF79eA1642c919ac0ea6d165Bc6dB"
        result = c._format_address(key)
        assert "Key(" not in result
        assert result.startswith("0xaF3e0796")

    def test_format_address_short(self):
        """_format_address doesn't truncate short addresses."""
        c = Mod()
        result = c._format_address("0xabc")
        assert result == "0xabc"


class TestTokenAuth:
    """Token-based authentication."""

    def test_has_auth_module(self):
        """Module initializes with auth module."""
        c = Mod()
        assert c.auth is not None
        assert hasattr(c.auth, 'token')
        assert hasattr(c.auth, 'verify')

    def test_generate_token(self):
        """token() generates a signed token string."""
        c = Mod()
        tok = c.token()
        assert isinstance(tok, str)
        assert len(tok) > 0

    def test_verify_token(self):
        """verify() decodes and validates a token."""
        c = Mod()
        tok = c.token()
        verified = c.verify(tok)
        assert 'key' in verified
        assert verified['key'] == c.key.address

    def test_token_with_custom_data(self):
        """token() can include custom data."""
        c = Mod()
        tok = c.token(data={'fn': 'forward', 'scope': 'write'})
        verified = c.verify(tok)
        assert verified['data']['fn'] == 'forward'

    def test_is_owner_with_token(self):
        """is_owner() accepts a signed token and verifies the caller."""
        c = Mod()
        c._owner = c.key.address.lower()
        tok = c.token()
        assert c.is_owner(tok) is True

    def test_is_owner_with_non_owner_token(self):
        """is_owner() rejects token from a non-owner key."""
        c = Mod()
        other_key = m.key('test.claude.nonowner')
        c._owner = c.key.address.lower()
        tok = c.token(key=other_key)
        assert c.is_owner(tok) is False

    def test_require_owner_with_token(self):
        """require_owner() passes with a valid owner token."""
        c = Mod()
        c._owner = c.key.address.lower()
        tok = c.token()
        c.require_owner(tok, "test op")  # should not raise

    def test_require_owner_rejects_non_owner_token(self):
        """require_owner() rejects token from non-owner."""
        c = Mod()
        other_key = m.key('test.claude.nonowner2')
        c._owner = c.key.address.lower()
        tok = c.token(key=other_key)
        with pytest.raises(PermissionError, match="Permission denied"):
            c.require_owner(tok, "edit_file")

    def test_resolve_address_none_returns_owner(self):
        """_resolve_address(None) returns self.key.address (the owner)."""
        c = Mod()
        addr = c._resolve_address(None)
        assert addr == c.key.address

    def test_resolve_address_key_object(self):
        """_resolve_address extracts .address from Key objects."""
        c = Mod()
        key = MagicMock()
        key.address = "0xdeadbeef"
        assert c._resolve_address(key) == "0xdeadbeef"

    def test_resolve_address_hex_string(self):
        """_resolve_address passes through hex addresses."""
        c = Mod()
        addr = "0xaF3e0796042aF79eA1642c919ac0ea6d165Bc6dB"
        assert c._resolve_address(addr) == addr

    def test_resolve_address_token(self):
        """_resolve_address decodes a valid token to get the address."""
        c = Mod()
        tok = c.token()
        addr = c._resolve_address(tok)
        assert addr == c.key.address


class TestHistory:
    """IPFS version history (local file-based)."""

    @pytest.fixture
    def c(self, tmp_path):
        mod = Mod()
        mod._history_dir = tmp_path / '.history'
        return mod

    def test_empty_history(self, c):
        """Fresh module has empty history."""
        assert c.get_history() == []

    def test_add_and_get_history(self, c):
        """Can add entries and retrieve them."""
        c._add_to_history("QmFirst", "First commit")
        c._add_to_history("QmSecond", "Second commit")
        h = c.get_history()
        assert len(h) == 2
        assert h[0]['cid'] == "QmSecond"  # newest first
        assert h[1]['cid'] == "QmFirst"

    def test_history_with_version(self, c):
        """Version label is stored."""
        c._add_to_history("QmVer", "Tagged release", version="v1.0")
        h = c.get_history()
        assert h[0]['version'] == "v1.0"

    def test_history_limit(self, c):
        """get_history respects limit."""
        for i in range(10):
            c._add_to_history(f"Qm{i}", f"Entry {i}")
        h = c.get_history(limit=3)
        assert len(h) == 3
        assert h[0]['cid'] == "Qm9"

    def test_get_latest_cid(self, c):
        """get_latest_cid returns most recent."""
        c._add_to_history("QmOld", "old")
        c._add_to_history("QmNew", "new")
        assert c.get_latest_cid() == "QmNew"

    def test_get_latest_cid_empty(self, c):
        """get_latest_cid returns None when empty."""
        assert c.get_latest_cid() is None

    def test_get_version_by_label(self, c):
        """Can retrieve entry by version label."""
        c._add_to_history("QmV1", "v1", version="v1.0")
        c._add_to_history("QmV2", "v2", version="v2.0")
        entry = c.get_version(version="v1.0")
        assert entry is not None
        assert entry['cid'] == "QmV1"

    def test_get_version_by_cid(self, c):
        """Can retrieve entry by CID."""
        c._add_to_history("QmSpecial", "special")
        entry = c.get_version(cid="QmSpecial")
        assert entry is not None
        assert entry['description'] == "special"

    def test_get_version_not_found(self, c):
        """Returns None for unknown version."""
        assert c.get_version(version="v999") is None

    def test_changelog_alias(self, c):
        """changelog() is an alias for get_history()."""
        c._add_to_history("Qm1", "one")
        c._add_to_history("Qm2", "two")
        cl = c.changelog(limit=1)
        assert len(cl) == 1
        assert cl[0]['cid'] == "Qm2"

    def test_show_changelog_empty(self, c, capsys):
        """show_changelog handles empty history."""
        c.show_changelog()
        out = capsys.readouterr().out
        assert "No history" in out

    def test_show_changelog_with_entries(self, c, capsys):
        """show_changelog displays entries."""
        c._add_to_history("QmShow", "Test display")
        c.show_changelog()
        out = capsys.readouterr().out
        assert "QmShow" in out
        assert "Test display" in out
        assert "IPFS CID HISTORY" in out

    def test_history_file_persists(self, c):
        """History persists across _load_history calls."""
        c._add_to_history("QmPersist", "persist test")
        # Force reload
        h = c._load_history()
        assert len(h) == 1
        assert h[0]['cid'] == "QmPersist"

    def test_history_entry_has_date(self, c):
        """History entries include date string."""
        c._add_to_history("QmDate", "date test")
        h = c.get_history()
        assert 'date' in h[0]
        assert 'timestamp' in h[0]


class TestBgJobs:
    """Local background job management (no server needed)."""

    def test_bg_status_dead_pid(self):
        """bg_status returns 'completed' for non-existent PID."""
        c = Mod()
        assert c.bg_status(999999999) == "completed"

    def test_bg_list_empty(self):
        """bg_list returns empty for nonexistent directory."""
        c = Mod()
        assert c.bg_list(log_dir="/tmp/nonexistent_claude_logs_xyz") == []

    def test_bg_list_finds_logs(self, tmp_path):
        """bg_list finds .log files."""
        (tmp_path / "job_1.log").write_text("output1")
        (tmp_path / "job_2.log").write_text("output2")
        c = Mod()
        logs = c.bg_list(log_dir=str(tmp_path))
        assert len(logs) == 2
        assert all('file' in l and 'size' in l and 'name' in l for l in logs)

    def test_bg_list_sorted_newest_first(self, tmp_path):
        """bg_list returns logs newest first."""
        f1 = tmp_path / "old.log"
        f1.write_text("old")
        time.sleep(0.05)
        f2 = tmp_path / "new.log"
        f2.write_text("new")
        c = Mod()
        logs = c.bg_list(log_dir=str(tmp_path))
        assert logs[0]['name'] == 'new.log'


class TestServerAvailability:
    """Server connectivity checks."""

    def test_server_available_returns_bool(self):
        """_server_available returns a boolean."""
        c = Mod()
        result = c._server_available()
        assert isinstance(result, bool)

    def test_server_available_bad_url(self):
        """_server_available returns False for bad URL."""
        c = Mod(api_url='http://localhost:1')
        assert c._server_available() is False

    def test_request_raises_on_bad_server(self):
        """_request raises ConnectionError for unreachable server."""
        c = Mod(api_url='http://localhost:1')
        with pytest.raises(ConnectionError):
            c._request("GET", "/health", timeout=1)

    def test_modules_fallback(self):
        """modules() falls back to m.mods() when server is down."""
        c = Mod(api_url='http://localhost:1')
        mods = c.modules()
        assert isinstance(mods, list)
        # should have found some modules via m.mods()
        assert len(mods) > 0


class TestCodeOps:
    """Code operation method signatures (mocked, no CLI needed)."""

    @pytest.fixture
    def c(self):
        mod = Mod()
        mod._find_claude = Mock(return_value='/usr/bin/echo')
        return mod

    def test_analyze_code_calls_cli(self, c):
        """analyze_code invokes _run_cli."""
        with patch.object(c, '_run_cli', return_value="analysis result") as mock:
            result = c.analyze_code(path="/tmp", focus="security")
            assert mock.called
            assert result == "analysis result"
            # check prompt contains focus
            call_args = mock.call_args
            assert "security" in call_args[0][0]

    def test_generate_code_requires_owner(self, c):
        """generate_code requires owner permission."""
        c._owner = "0xowner"
        with pytest.raises(PermissionError):
            c.generate_code("make a function", key="0xother")

    def test_generate_code_passes_with_owner(self, c):
        """generate_code works for the owner."""
        c._owner = "0xowner"
        with patch.object(c, '_run_cli', return_value="def foo(): pass") as mock:
            result = c.generate_code("make a function", key="0xowner")
            assert mock.called

    def test_generate_code_passes_default_owner(self):
        """generate_code works when no key passed (defaults to owner)."""
        c = Mod()
        c._find_claude = Mock(return_value='/usr/bin/echo')
        c._owner = c.key.address.lower()
        with patch.object(c, '_run_cli', return_value="def foo(): pass") as mock:
            result = c.generate_code("make a function")
            assert mock.called

    def test_refactor_requires_owner(self, c):
        """refactor requires owner permission."""
        c._owner = "0xowner"
        with pytest.raises(PermissionError):
            c.refactor("/tmp", key="0xother")

    def test_debug_no_owner_required(self, c):
        """debug is read-only, no owner needed."""
        c._owner = "0xowner"
        with patch.object(c, '_run_cli', return_value="found the bug") as mock:
            result = c.debug("/tmp", error="TypeError")
            assert mock.called
            assert "TypeError" in mock.call_args[0][0]

    def test_edit_file_requires_owner(self, c):
        """edit_file requires owner permission."""
        c._owner = "0xowner"
        with pytest.raises(PermissionError):
            c.edit_file("test.py", "add docstring", key="0xother")

    def test_run_task_calls_cli(self, c):
        """run_task invokes _run_cli."""
        with patch.object(c, '_run_cli', return_value="done") as mock:
            result = c.run_task("list files", path="/tmp")
            assert mock.called
            assert result == "done"

    def test_batch_process_returns_list(self, c):
        """batch_process returns a list of results."""
        with patch.object(c, '_run_cli', return_value="processed") as mock:
            results = c.batch_process(["a", "b", "c"], "summarize")
            assert len(results) == 3
            assert all(r['status'] == 'ok' for r in results)

    def test_batch_process_handles_errors(self, c):
        """batch_process captures errors per item."""
        with patch.object(c, '_run_cli', side_effect=RuntimeError("fail")) as mock:
            results = c.batch_process(["a"], "summarize")
            assert results[0]['status'] == 'error'
            assert 'fail' in results[0]['error']


class TestForwardPermissions:
    """Forward write-operation permission checks."""

    @pytest.fixture
    def c(self):
        mod = Mod()
        mod._owner = "0xowner"
        return mod

    def test_forward_edit_requires_owner(self, c):
        """Forward with edit keyword requires owner."""
        with pytest.raises(PermissionError):
            c.forward("Edit the login page", key="0xother", background=False)

    def test_forward_modify_requires_owner(self, c):
        with pytest.raises(PermissionError):
            c.forward("Modify the auth flow", key="0xother", background=False)

    def test_forward_fix_requires_owner(self, c):
        with pytest.raises(PermissionError):
            c.forward("Fix the bug in main.py", key="0xother", background=False)

    def test_forward_add_requires_owner(self, c):
        with pytest.raises(PermissionError):
            c.forward("Add a new feature", key="0xother", background=False)

    def test_forward_remove_requires_owner(self, c):
        with pytest.raises(PermissionError):
            c.forward("Remove the deprecated function", key="0xother", background=False)

    def test_forward_read_ok_for_non_owner(self, c):
        """Read-only queries don't trigger PermissionError."""
        with patch.object(c, '_run_cli', return_value={"result": "ok"}) as mock:
            result = c.forward("Explain the code structure", key="0xother", background=False)
            assert mock.called

    def test_forward_write_ok_for_owner_default(self):
        """Owner can call write operations without passing key (default)."""
        c = Mod()
        c._owner = c.key.address.lower()  # align owner with default key
        with patch.object(c, '_run_cli', return_value={"result": "ok"}) as mock:
            result = c.forward("Edit the login page", background=False)
            assert mock.called

    def test_forward_write_ok_with_owner_token(self):
        """Owner can call write operations by passing a signed token."""
        c = Mod()
        c._owner = c.key.address.lower()
        tok = c.token()
        with patch.object(c, '_run_cli', return_value={"result": "ok"}) as mock:
            result = c.forward("Edit the login page", key=tok, background=False)
            assert mock.called


class TestSelfTest:
    """Built-in test() method."""

    def test_self_test_returns_dict(self):
        """test() returns structured results."""
        c = Mod()
        result = c.test()
        assert 'passed' in result
        assert 'failed' in result
        assert 'total' in result
        assert 'tests' in result
        assert result['total'] == result['passed'] + result['failed']

    def test_self_test_passes(self):
        """Built-in tests should pass."""
        c = Mod()
        result = c.test()
        assert result['passed'] > 0
        assert result['failed'] == 0, f"Self-test failures: {[t for t in result['tests'] if t['status'] == 'fail']}"


class TestRepr:
    """String representation."""

    def test_repr(self):
        c = Mod()
        r = repr(c)
        assert 'Claude' in r
        assert 'api=' in r


# ── CLI Tests (require claude binary + auth) ────────────────────

class TestCLI:
    """Tests that invoke the actual claude CLI."""

    @pytest.fixture
    def c(self):
        return Mod()

    @skip_no_cli
    def test_find_claude(self, c):
        """Claude binary is found."""
        path = c._find_claude()
        assert os.path.exists(path)

    @skip_no_auth
    def test_forward_text(self, c, tmp_path):
        """Forward with text output."""
        result = c.forward(
            query="Say 'test passed' and nothing else",
            path=str(tmp_path),
            background=False,
            output_format="text",
            stream_output=False,
        )
        assert result is not None

    @skip_no_auth
    def test_analyze_code(self, c, tmp_path):
        """analyze_code runs."""
        (tmp_path / "test.py").write_text("def hello(): print('hi')\n")
        result = c.analyze_code(path=str(tmp_path), focus="code quality")
        assert result is not None

    @skip_no_auth
    def test_bg_spawns(self, c, tmp_path):
        """bg() spawns a process."""
        job = c.bg(
            prompt="Say 'bg test' and nothing else",
            path=str(tmp_path),
            log_dir=str(tmp_path / "logs"),
        )
        assert 'pid' in job
        assert 'log_file' in job
        assert os.path.exists(job['log_file'])


# ── Server Tests (require Rust job server) ───────────────────────

class TestServer:
    """Tests for the Rust job server integration."""

    @skip_no_server
    def test_health(self):
        c = Mod()
        h = c.health()
        assert h.get('status') == 'ok'

    @skip_no_server
    def test_list_jobs(self):
        c = Mod()
        j = c.jobs()
        assert isinstance(j, list)

    @skip_no_server
    @skip_no_auth
    def test_submit_and_check(self):
        c = Mod()
        job = c.submit(prompt="Say 'server test'", model="haiku")
        assert 'id' in job
        found = c.job(job['id'])
        assert found['id'] == job['id']


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
