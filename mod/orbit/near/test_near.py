"""
Tests for the NEAR module — Python-side deploy/interact logic.
Run with: pytest test_near.py -v
"""
import pytest
import json
import subprocess
import os
import tempfile
from unittest.mock import patch, MagicMock

# ── Path setup ────────────────────────────────────────────────────────────────

HERE = os.path.dirname(os.path.abspath(__file__))


# ── Build Tests ───────────────────────────────────────────────────────────────

class TestBuild:
    """Test that the Rust contract compiles to WASM."""

    def test_cargo_toml_exists(self):
        assert os.path.exists(os.path.join(HERE, "Cargo.toml"))

    def test_lib_rs_exists(self):
        assert os.path.exists(os.path.join(HERE, "src", "lib.rs"))

    def test_cargo_check(self):
        """Verify the contract compiles (cargo check, no wasm needed)."""
        result = subprocess.run(
            ["cargo", "check"],
            cwd=HERE,
            capture_output=True,
            text=True,
            timeout=300,
        )
        assert result.returncode == 0, f"cargo check failed:\n{result.stderr}"

    def test_wasm_build(self):
        """Build the contract to WASM."""
        # Ensure target is available
        subprocess.run(
            ["rustup", "target", "add", "wasm32-unknown-unknown"],
            cwd=HERE,
            capture_output=True,
        )
        result = subprocess.run(
            ["cargo", "build", "--target", "wasm32-unknown-unknown", "--release"],
            cwd=HERE,
            capture_output=True,
            text=True,
            timeout=600,
        )
        assert result.returncode == 0, f"WASM build failed:\n{result.stderr}"

        wasm_path = os.path.join(
            HERE, "target", "wasm32-unknown-unknown", "release", "near_token.wasm"
        )
        assert os.path.exists(wasm_path), "WASM binary not produced"

        # NEAR contracts must be < 4MB
        size = os.path.getsize(wasm_path)
        assert size < 4 * 1024 * 1024, f"WASM too large: {size} bytes (max 4MB)"
        assert size > 0, "WASM file is empty"


# ── Deploy Script Tests ───────────────────────────────────────────────────────

class TestDeployScript:
    """Test the deploy.sh script structure."""

    def test_deploy_script_exists(self):
        path = os.path.join(HERE, "deploy.sh")
        assert os.path.exists(path)
        assert os.access(path, os.X_OK), "deploy.sh is not executable"

    def test_fund_script_exists(self):
        path = os.path.join(HERE, "fund.sh")
        assert os.path.exists(path)
        assert os.access(path, os.X_OK), "fund.sh is not executable"

    def test_deploy_script_has_testnet(self):
        with open(os.path.join(HERE, "deploy.sh")) as f:
            content = f.read()
        assert "testnet" in content.lower()

    def test_deploy_script_builds_wasm(self):
        with open(os.path.join(HERE, "deploy.sh")) as f:
            content = f.read()
        assert "cargo build" in content
        assert "wasm32-unknown-unknown" in content


# ── Contract ABI Tests ────────────────────────────────────────────────────────

class TestContractABI:
    """Verify the contract source has expected methods."""

    @pytest.fixture(autouse=True)
    def load_source(self):
        with open(os.path.join(HERE, "src", "lib.rs")) as f:
            self.source = f.read()

    def test_has_init_method(self):
        assert "fn new(" in self.source

    def test_has_mint(self):
        assert "fn mint(" in self.source

    def test_has_transfer_signed(self):
        assert "fn transfer_signed(" in self.source

    def test_has_balance_of(self):
        assert "fn balance_of(" in self.source

    def test_has_nonce_of(self):
        assert "fn nonce_of(" in self.source

    def test_has_register_near_key(self):
        assert "fn register_near_key(" in self.source

    def test_supports_ethereum(self):
        assert "Ethereum" in self.source

    def test_supports_solana(self):
        assert "Solana" in self.source

    def test_supports_near(self):
        assert "Near" in self.source


# ── Mod.py Tests ──────────────────────────────────────────────────────────────

class TestMod:
    """Test the Python module interface."""

    def test_mod_class_exists(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "near_mod", os.path.join(HERE, "src", "mod.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert hasattr(mod, "Mod")

    def test_mod_has_deploy(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "near_mod", os.path.join(HERE, "src", "mod.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        instance = mod.Mod()
        assert hasattr(instance, "deploy")

    def test_mod_has_call(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "near_mod", os.path.join(HERE, "src", "mod.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        instance = mod.Mod()
        assert hasattr(instance, "call")

    def test_mod_has_view(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "near_mod", os.path.join(HERE, "src", "mod.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        instance = mod.Mod()
        assert hasattr(instance, "view")

    def test_mod_has_fund(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "near_mod", os.path.join(HERE, "src", "mod.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        instance = mod.Mod()
        assert hasattr(instance, "fund")


# ── Crypto Helpers Tests (unit) ───────────────────────────────────────────────

class TestCryptoHelpers:
    """Test Ethereum message hashing (Python equivalent of contract logic)."""

    def test_eth_prefixed_hash(self):
        """Verify personal_sign hash matches expected format."""
        from hashlib import sha3_256
        msg = b"test message"
        prefix = f"\x19Ethereum Signed Message:\n{len(msg)}"
        import hashlib
        h = hashlib.new("keccak_256")
        h.update(prefix.encode() + msg)
        result = h.hexdigest()
        assert len(result) == 64  # 32 bytes hex

    def test_canonical_message_format(self):
        """Test the message format used for transfer_signed."""
        msg = "transfer:near:alice.testnet:eth:0xabc:MOD:100:0"
        parts = msg.split(":")
        assert parts[0] == "transfer"
        assert parts[1] == "near"
        assert parts[2] == "alice.testnet"
        assert parts[3] == "eth"
        assert parts[4] == "0xabc"
        assert parts[5] == "MOD"
        assert parts[6] == "100"
        assert parts[7] == "0"


# ── Rust Integration Tests ────────────────────────────────────────────────────

class TestRustTests:
    """Run the Rust-side integration tests (near-workspaces sandbox)."""

    @pytest.mark.slow
    def test_rust_unit_tests(self):
        """Run cargo test (unit tests only, no sandbox)."""
        result = subprocess.run(
            ["cargo", "test", "--lib"],
            cwd=HERE,
            capture_output=True,
            text=True,
            timeout=300,
        )
        assert result.returncode == 0, f"Rust unit tests failed:\n{result.stderr}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
