"""
TT — Blocktime Yuma Consensus on EVM (Base Sepolia).

Validators register with text keys (ECDSA, ed25519, sr25519 — any format).
Blocktime scores accumulate via checkins, decay exponentially.
Emissions distribute proportional to score (Yuma consensus).

Usage:
  m.mod('tt')(action='status')
  m.mod('tt')(action='deploy')
  m.mod('tt')(action='serve')
"""

import json
import os
import signal
import subprocess
from pathlib import Path

import mod as m


DIR = Path(__file__).parent
ROOT = DIR.parent
API_PORT = 8849
APP_PORT = 8850


def _run(cmd, cwd=None, timeout=120):
    """Run a shell command and return stdout."""
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or str(ROOT),
        capture_output=True, text=True, timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{result.stderr}")
    return result.stdout.strip()


class Mod:
    description = "Blocktime Yuma Consensus — EVM contract with multi-key validator registration, blocktime scoring, and emission distribution."

    def __init__(self, config=None):
        self.module_dir = ROOT
        self.api_port = API_PORT
        self.app_port = APP_PORT
        self.config = config or self._load_config()

    def _load_config(self):
        cfg_path = self.module_dir / 'config.json'
        if cfg_path.exists():
            with open(cfg_path) as f:
                return json.load(f)
        return {}

    # ── Build / Deploy ────────────────────────────────────────────────

    def compile(self):
        """Compile Solidity contracts via Hardhat."""
        _run('npx hardhat compile', cwd=str(self.module_dir))
        abi_path = self.module_dir / 'artifacts' / 'contracts' / 'TT.sol' / 'TT.json'
        return {
            'compiled': True,
            'abi': str(abi_path),
            'exists': abi_path.exists(),
        }

    def deploy(self, network='base_sepolia'):
        """Compile and deploy TT contract to Base Sepolia."""
        self.compile()
        output = _run(
            f'npx hardhat run scripts/deploy.js --network {network}',
            cwd=str(self.module_dir), timeout=300,
        )
        deploy_path = self.module_dir / 'deployment.json'
        if deploy_path.exists():
            with open(deploy_path) as f:
                info = json.load(f)
            info['output'] = output
            return info
        return {'output': output}

    # ── Serve ─────────────────────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start the FastAPI + Next.js app."""
        api_port = int(api_port or self.api_port)
        app_port = int(app_port or self.app_port)
        log_dir = Path('/tmp/tt')
        log_dir.mkdir(parents=True, exist_ok=True)
        results = {}

        self.kill()

        # Start API
        api_dir = self.module_dir / 'api'
        mod_root = str(self.module_dir.parent.parent)
        env = os.environ.copy()
        env['PYTHONPATH'] = f"{mod_root}:{self.module_dir}:{env.get('PYTHONPATH', '')}"
        env['PORT'] = str(api_port)

        api_log = open(log_dir / 'api.log', 'w')
        api_cmd = [
            'python3', '-m', 'uvicorn', 'api:app',
            '--host', '0.0.0.0', '--port', str(api_port),
            '--app-dir', str(api_dir),
        ]
        if dev:
            api_cmd.append('--reload')

        subprocess.Popen(api_cmd, env=env, stdout=api_log, stderr=subprocess.STDOUT)
        results['api'] = f'http://localhost:{api_port}'
        results['api_docs'] = f'http://localhost:{api_port}/docs'
        results['api_log'] = str(log_dir / 'api.log')

        # Start Next.js app
        app_dir = self.module_dir / 'app'
        if (app_dir / 'package.json').exists():
            app_env = os.environ.copy()
            app_env['NEXT_PUBLIC_API_URL'] = f'http://localhost:{api_port}'
            app_env['PORT'] = str(app_port)
            app_log = open(log_dir / 'app.log', 'w')
            app_cmd = ['npx', 'next', 'dev' if dev else 'start', '-p', str(app_port)]
            subprocess.Popen(
                app_cmd, cwd=str(app_dir), env=app_env,
                stdout=app_log, stderr=subprocess.STDOUT,
            )
            results['app'] = f'http://localhost:{app_port}'
            results['app_log'] = str(log_dir / 'app.log')

        results['dev'] = dev
        results['logs'] = str(log_dir)
        return results

    def kill(self):
        """Stop API and Next.js app."""
        killed = []
        for pattern in [f'uvicorn.*api:app.*{self.api_port}', f'next.*{self.app_port}']:
            try:
                result = subprocess.run(
                    ['pgrep', '-f', pattern],
                    capture_output=True, text=True,
                )
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(pid)
            except Exception:
                pass
        return {'killed': killed}

    # ── Contract interaction helpers ──────────────────────────────────

    def _load_contract(self):
        """Load Web3 contract instance."""
        from web3 import Web3

        deploy_path = self.module_dir / 'deployment.json'
        abi_path = self.module_dir / 'artifacts' / 'contracts' / 'TT.sol' / 'TT.json'

        if not deploy_path.exists():
            raise RuntimeError("Not deployed. Run action='deploy' first.")
        if not abi_path.exists():
            raise RuntimeError("ABI not found. Run action='compile' first.")

        with open(deploy_path) as f:
            deploy = json.load(f)
        with open(abi_path) as f:
            artifact = json.load(f)

        rpc = os.environ.get('BASE_TESTNET_RPC_URL', 'https://sepolia.base.org')
        w3 = Web3(Web3.HTTPProvider(rpc))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(deploy['address']),
            abi=artifact['abi'],
        )

        pk = os.environ.get('PRIVATE_KEY')
        account = w3.eth.account.from_key(pk) if pk else None

        return w3, contract, account

    def _send_tx(self, fn):
        """Build, sign, and send a transaction."""
        w3, contract, account = self._load_contract()
        if not account:
            raise RuntimeError("PRIVATE_KEY env var required for transactions")

        tx = fn(contract).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 500000,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return {
            'success': receipt.status == 1,
            'tx_hash': tx_hash.hex(),
        }

    # ── Contract methods ──────────────────────────────────────────────

    def register(self, key, key_type=0):
        """Register a validator with a text key."""
        return self._send_tx(lambda c: c.functions.registerValidatorAdmin(key, key_type))

    def checkin(self, key):
        """Validator heartbeat checkin."""
        return self._send_tx(lambda c: c.functions.batchCheckin([key]))

    def batch_checkin(self, keys):
        """Batch checkin for multiple validators."""
        return self._send_tx(lambda c: c.functions.batchCheckin(keys))

    def produce_block(self):
        """Produce the next consensus block."""
        return self._send_tx(lambda c: c.functions.produceBlock())

    def distribute(self):
        """Distribute emissions to validators."""
        return self._send_tx(lambda c: c.functions.distributeEmissions())

    # ── Views ─────────────────────────────────────────────────────────

    def get_consensus(self):
        """Get current consensus state."""
        _, contract, _ = self._load_contract()
        r = contract.functions.getBlock().call()
        return {
            'currentBlock': r[0],
            'lastEmissionBlock': r[1],
            'totalBlocktime': r[2],
            'emissionRate': str(r[3]),
            'decayBps': r[4],
            'epochLength': r[5],
        }

    def get_validator(self, key):
        """Get info for a specific validator."""
        _, contract, _ = self._load_contract()
        r = contract.functions.getValidator(key).call()
        return {
            'key': r[0], 'keyType': r[1],
            'registeredBlock': r[2], 'lastSeenBlock': r[3],
            'blocktimeScore': r[4], 'earned': str(r[5]), 'active': r[6],
        }

    def leaderboard(self, limit=20):
        """Get top validators by blocktime score."""
        _, contract, _ = self._load_contract()
        keys, scores = contract.functions.getLeaderboard(limit).call()
        return [{'keyHash': k.hex(), 'score': s} for k, s in zip(keys, scores)]

    def status(self):
        """Deployment and consensus status."""
        deploy_path = self.module_dir / 'deployment.json'
        if not deploy_path.exists():
            return {'deployed': False}
        with open(deploy_path) as f:
            info = json.load(f)
        info['deployed'] = True
        info['explorer'] = f"https://sepolia.basescan.org/address/{info.get('address', '')}"
        try:
            info['consensus'] = self.get_consensus()
        except Exception:
            pass
        return info

    # ── Default entry point ───────────────────────────────────────────

    def forward(self, action='status', **kwargs):
        """CLI: m.mod('tt')(action='deploy|serve|register|checkin|produce_block|distribute|status|leaderboard')"""
        actions = {
            'status': self.status,
            'compile': self.compile,
            'deploy': self.deploy,
            'serve': self.serve,
            'kill': self.kill,
            'register': self.register,
            'checkin': self.checkin,
            'batch_checkin': self.batch_checkin,
            'produce_block': self.produce_block,
            'distribute': self.distribute,
            'consensus': self.get_consensus,
            'validator': self.get_validator,
            'leaderboard': self.leaderboard,
        }
        fn = actions.get(action)
        if not fn:
            return {'error': f'Unknown action: {action}', 'available': list(actions.keys())}
        return fn(**kwargs)
