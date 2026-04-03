import subprocess
import json
import os

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DIR)
NEAR_CLI = "npx near-cli-rs"
NETWORK = "testnet"
WASM_PATH = os.path.join(ROOT, "target", "near", "near_token.wasm")


def _run(cmd, cwd=ROOT, timeout=120):
    """Run a shell command and return stdout."""
    result = subprocess.run(
        cmd, shell=True, cwd=cwd,
        capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{result.stderr}")
    return result.stdout.strip()


class Mod:
    description = "NEAR Protocol contract deploy, fund, and interact"

    def __init__(self, account=None, network=NETWORK):
        self.network = network
        self.account = account
        # Load from deployment.json if exists and no account given
        if not self.account:
            deploy_file = os.path.join(ROOT, "deployment.json")
            if os.path.exists(deploy_file):
                with open(deploy_file) as f:
                    info = json.load(f)
                self.account = info.get("account")

    # ── Build ─────────────────────────────────────────────────────────────

    def build(self):
        """Compile the contract to WASM."""
        _run("cargo near build non-reproducible-wasm", timeout=600)
        assert os.path.exists(WASM_PATH), f"WASM not found: {WASM_PATH}"
        size = os.path.getsize(WASM_PATH)
        return {"wasm": WASM_PATH, "size": size}

    # ── Fund ──────────────────────────────────────────────────────────────

    def fund(self, account=None, amount="200 NEAR"):
        """Create and fund a testnet account via faucet."""
        account = account or self.account or f"mod-token-{int(__import__('time').time())}.testnet"
        if not account.endswith(".testnet"):
            account = f"{account}.testnet"

        cmd = (
            f"{NEAR_CLI} account create-account fund-myself "
            f'"{account}" \'{amount}\' '
            f"autogenerate-new-keypair save-to-keychain "
            f"network-config {self.network} create"
        )
        try:
            output = _run(cmd)
        except RuntimeError:
            output = "Account may already exist"

        self.account = account
        return {"account": account, "output": output}

    # ── Deploy ────────────────────────────────────────────────────────────

    def deploy(self, account=None, init=True):
        """Build and deploy the contract to testnet."""
        # Build first
        build_info = self.build()

        account = account or self.account
        if not account:
            fund_result = self.fund()
            account = fund_result["account"]

        # Deploy WASM
        cmd = (
            f'{NEAR_CLI} contract deploy "{account}" '
            f'use-file "{WASM_PATH}" without-init-call '
            f"network-config {self.network} sign-with-keychain send"
        )
        deploy_out = _run(cmd)

        # Initialize
        if init:
            init_cmd = (
                f'{NEAR_CLI} contract call-function as-transaction '
                f'"{account}" new json-args \'{{}}\' '
                f"prepaid-gas '30 Tgas' attached-deposit '0 NEAR' "
                f"sign-with-keychain network-config {self.network} send"
            )
            _run(init_cmd)

        self.account = account

        # Save deployment info
        info = {
            "network": self.network,
            "account": account,
            "wasm": WASM_PATH,
            "wasm_size": build_info["size"],
            "deployed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        }
        with open(os.path.join(ROOT, "deployment.json"), "w") as f:
            json.dump(info, f, indent=2)

        return info

    # ── Contract Calls ────────────────────────────────────────────────────

    def call(self, method, args=None, gas="30 Tgas", deposit="0 NEAR"):
        """Call a contract method (state-changing transaction)."""
        args_json = json.dumps(args or {})
        cmd = (
            f'{NEAR_CLI} contract call-function as-transaction '
            f'"{self.account}" {method} json-args \'{args_json}\' '
            f"prepaid-gas '{gas}' attached-deposit '{deposit}' "
            f"sign-with-keychain network-config {self.network} send"
        )
        return _run(cmd)

    def view(self, method, args=None):
        """Call a read-only view method on the contract."""
        args_json = json.dumps(args or {})
        cmd = (
            f'{NEAR_CLI} contract call-function as-read-only '
            f'"{self.account}" {method} json-args \'{args_json}\' '
            f"network-config {self.network} now"
        )
        return _run(cmd)

    # ── Convenience Methods ───────────────────────────────────────────────

    def mint(self, addr_type, address, token_type, amount):
        """Mint tokens to an address."""
        return self.call("mint", {
            "addr_type": addr_type,
            "address": address,
            "token_type": token_type,
            "amount": str(amount),
        })

    def balance_of(self, addr_type, address, token_type):
        """Check balance of an address."""
        return self.view("balance_of", {
            "addr_type": addr_type,
            "address": address,
            "token_type": token_type,
        })

    def nonce_of(self, addr_type, address):
        """Get the nonce for an address."""
        return self.view("nonce_of", {
            "addr_type": addr_type,
            "address": address,
        })

    def status(self):
        """Show deployment status."""
        deploy_file = os.path.join(ROOT, "deployment.json")
        if not os.path.exists(deploy_file):
            return {"deployed": False}
        with open(deploy_file) as f:
            info = json.load(f)
        info["deployed"] = True
        info["explorer"] = f"https://testnet.nearblocks.io/address/{info['account']}"
        return info

    # ── Default entry point ───────────────────────────────────────────────

    def forward(self, action="status", **kwargs):
        """Main entry point: m.mod('near')(action='deploy')"""
        actions = {
            "build": self.build,
            "fund": self.fund,
            "deploy": self.deploy,
            "status": self.status,
            "mint": self.mint,
            "balance": self.balance_of,
        }
        fn = actions.get(action)
        if not fn:
            return {"error": f"Unknown action: {action}", "available": list(actions.keys())}
        return fn(**kwargs)
