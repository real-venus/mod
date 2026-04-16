mod"""
StakeTime — Delegated staking + Incentive (Yuma Consensus) on EVM (Base Sepolia).

Two contracts:
  StakeTime — Pure staking primitive. Users stake nativeToken ON validators, earn STT.
  Incentive — I(StakeTime). Blocktime scoring, decay, emission distribution.

Usage:
  m.fn('tt/status')()
  m.fn('tt/deploy')()
  m.fn('tt/serve')()
  m.fn('tt/stake_on')(validator_key='val1', amount=1000, lock_blocks=43200)
  m.fn('tt/register')(key='val1', key_type=1, commission_bps=1000)
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
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or str(ROOT),
        capture_output=True, text=True, timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{result.stderr}")
    return result.stdout.strip()


class Mod:
    description = "StakeTime + Incentive — Delegated staking with configurable curves and Yuma consensus emission distribution."

    def __init__(self, config=None, **kwargs):
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

    # ── Default entry point ───────────────────────────────────────────

    def forward(self, **kwargs):
        return self.status()

    # ── Build / Deploy ────────────────────────────────────────────────

    def compile(self):
        _run('npx hardhat compile', cwd=str(self.module_dir))
        st_abi = self.module_dir / 'artifacts' / 'src' / 'contracts' / 'subnet' / 'StakeTime.sol' / 'StakeTime.json'
        inc_abi = self.module_dir / 'artifacts' / 'src' / 'contracts' / 'subnet' / 'Subnet.sol' / 'Subnet.json'
        return {
            'compiled': True,
            'stakeTime_abi': str(st_abi),
            'incentive_abi': str(inc_abi),
        }

    def deploy(self, network='base_sepolia'):
        self.compile()
        output = _run(
            f'npx hardhat run scripts/deploy.js --network {network}',
            cwd=str(self.module_dir), timeout=300,
        )
        deploy_path = self.module_dir / 'config.json'
        if deploy_path.exists():
            with open(deploy_path) as f:
                info = json.load(f)
            info['output'] = output
            return info
        return {'output': output}

    def test(self):
        output = _run('npx hardhat test', cwd=str(self.module_dir), timeout=300)
        return {'output': output}

    # ── Serve ─────────────────────────────────────────────────────────

    def serve(self, api_port=None, app_port=None, dev=True):
        api_port = int(api_port or self.api_port)
        app_port = int(app_port or self.app_port)
        log_dir = Path('/tmp/staketime')
        log_dir.mkdir(parents=True, exist_ok=True)
        results = {}

        self.kill()

        api_dir = self.module_dir / 'src' / 'api'
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

        app_dir = self.module_dir / 'src' / 'app'
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
        killed = []
        for pattern in [f'uvicorn.*api:app.*{self.api_port}', f'next.*{self.app_port}']:
            try:
                result = subprocess.run(
                    ['pgrep', '-f', pattern], capture_output=True, text=True,
                )
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(pid)
            except Exception:
                pass
        return {'killed': killed}

    # ── Contract loaders ──────────────────────────────────────────────

    def _load_deployment(self):
        from web3 import Web3
        deploy_path = self.module_dir / 'config.json'
        if not deploy_path.exists():
            raise RuntimeError("Not deployed. Run deploy() first.")
        with open(deploy_path) as f:
            deploy = json.load(f)
        rpc = os.environ.get('BASE_TESTNET_RPC_URL', 'https://sepolia.base.org')
        w3 = Web3(Web3.HTTPProvider(rpc))
        pk = os.environ.get('PRIVATE_KEY')
        account = w3.eth.account.from_key(pk) if pk else None
        return w3, deploy, account

    def _load_staketime(self):
        from web3 import Web3
        w3, deploy, account = self._load_deployment()
        abi_path = self.module_dir / 'artifacts' / 'src' / 'contracts' / 'subnet' / 'StakeTime.sol' / 'StakeTime.json'
        with open(abi_path) as f:
            artifact = json.load(f)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(deploy['stakeTime']),
            abi=artifact['abi'],
        )
        return w3, contract, account

    def _load_incentive(self):
        from web3 import Web3
        w3, deploy, account = self._load_deployment()
        abi_path = self.module_dir / 'artifacts' / 'src' / 'contracts' / 'subnet' / 'Subnet.sol' / 'Subnet.json'
        with open(abi_path) as f:
            artifact = json.load(f)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(deploy['incentive']),
            abi=artifact['abi'],
        )
        return w3, contract, account

    def _send_tx(self, contract_loader, fn):
        w3, contract, account = contract_loader()
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
        return {'success': receipt.status == 1, 'tx_hash': tx_hash.hex()}

    # ── StakeTime: Validator methods ──────────────────────────────────

    def register(self, key, key_type=0, commission_bps=1000):
        """Register a validator (via StakeTime)."""
        return self._send_tx(
            self._load_staketime,
            lambda c: c.functions.registerValidatorAdmin(key, key_type, commission_bps),
        )

    # ── StakeTime: Staking methods ────────────────────────────────────

    def stake_on(self, validator_key, amount, lock_blocks=0):
        """Stake nativeToken on a validator (via StakeTime)."""
        from web3 import Web3
        amount_wei = Web3.to_wei(amount, 'ether') if isinstance(amount, (int, float)) else int(amount)
        return self._send_tx(
            self._load_staketime,
            lambda c: c.functions.stakeOn(validator_key, amount_wei, lock_blocks),
        )

    def unstake_from(self, stake_id):
        """Unstake a position after lock period (via StakeTime)."""
        return self._send_tx(
            self._load_staketime,
            lambda c: c.functions.unstakeFrom(stake_id),
        )

    # ── Incentive: Consensus methods ──────────────────────────────────

    def checkin(self, key):
        """Validator heartbeat checkin (via Incentive)."""
        return self._send_tx(
            self._load_incentive,
            lambda c: c.functions.batchCheckin([key]),
        )

    def batch_checkin(self, keys):
        """Batch checkin for multiple validators (via Incentive)."""
        return self._send_tx(
            self._load_incentive,
            lambda c: c.functions.batchCheckin(keys),
        )

    def produce_block(self):
        """Produce the next consensus block (via Incentive)."""
        return self._send_tx(
            self._load_incentive,
            lambda c: c.functions.produceBlock(),
        )

    def distribute(self):
        """Distribute emissions (via Incentive)."""
        return self._send_tx(
            self._load_incentive,
            lambda c: c.functions.distributeEmissions(),
        )

    # ── Incentive: Reward claims ──────────────────────────────────────

    def claim_staker_rewards(self):
        """Claim accumulated staker rewards (via Incentive)."""
        return self._send_tx(
            self._load_incentive,
            lambda c: c.functions.claimStakerRewards(),
        )

    def claim_validator_rewards(self, key, to=None):
        """Claim validator commission rewards (via Incentive)."""
        if to is None:
            _, _, account = self._load_incentive()
            to = account.address
        return self._send_tx(
            self._load_incentive,
            lambda c: c.functions.claimValidatorRewards(key, to),
        )

    # ── StakeTime: Views ──────────────────────────────────────────────

    def validator(self, key):
        """Get validator info from StakeTime."""
        _, contract, _ = self._load_staketime()
        r = contract.functions.getValidator(key).call()
        return {
            'key': r[0], 'keyType': r[1],
            'registeredBlock': r[2],
            'commissionBps': r[3], 'active': r[4],
        }

    def stake_position(self, stake_id):
        _, contract, _ = self._load_staketime()
        r = contract.functions.getStakePosition(stake_id).call()
        return {
            'staker': r[0], 'validatorKeyHash': r[1].hex(),
            'amount': str(r[2]), 'startBlock': r[3],
            'lockBlocks': r[4], 'stakeTimeBalance': str(r[5]),
            'blocksRemaining': r[6],
        }

    def user_stakes(self, address):
        from web3 import Web3
        _, contract, _ = self._load_staketime()
        return contract.functions.getUserStakeIds(
            Web3.to_checksum_address(address)
        ).call()

    def validator_stakes(self, key):
        _, contract, _ = self._load_staketime()
        return contract.functions.getValidatorStakeIds(key).call()

    def validator_total_stake_time(self, key):
        _, contract, _ = self._load_staketime()
        return str(contract.functions.getValidatorTotalStakeTime(key).call())

    # ── Incentive: Views ──────────────────────────────────────────────

    def consensus(self):
        """Get consensus state from Incentive."""
        _, contract, _ = self._load_incentive()
        r = contract.functions.getBlock().call()
        return {
            'currentBlock': r[0],
            'lastEmissionBlock': r[1],
            'totalBlocktime': r[2],
            'emissionRate': str(r[3]),
            'decayBps': r[4],
            'epochLength': r[5],
        }

    def leaderboard(self, limit=20):
        _, contract, _ = self._load_incentive()
        keys, scores = contract.functions.getLeaderboard(limit).call()
        return [{'keyHash': k.hex(), 'score': s} for k, s in zip(keys, scores)]

    def staker_rewards(self, address):
        from web3 import Web3
        _, contract, _ = self._load_incentive()
        return str(contract.functions.getStakerRewards(
            Web3.to_checksum_address(address)
        ).call())

    def validator_balance(self, key):
        _, contract, _ = self._load_incentive()
        return str(contract.functions.getValidatorBalance(key).call())

    # ── Registry ──────────────────────────────────────────────────────

    def _load_registry(self):
        from web3 import Web3
        w3, deploy, account = self._load_deployment()
        if 'registry' not in deploy:
            raise RuntimeError("Registry not deployed. Redeploy with Registry.")
        abi_path = self.module_dir / 'artifacts' / 'src' / 'contracts' / 'Registry.sol' / 'Registry.json'
        with open(abi_path) as f:
            artifact = json.load(f)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(deploy['registry']),
            abi=artifact['abi'],
        )
        return w3, contract, account

    def register_subnet(self, name, stake_time, incentive):
        """Register a subnet in the Registry (locks NativeToken)."""
        from web3 import Web3
        w3, registry, account = self._load_registry()
        if not account:
            raise RuntimeError("PRIVATE_KEY env var required for transactions")

        # Approve NativeToken for registration cost
        cost = registry.functions.getRegistrationCost().call()
        if cost > 0:
            _, deploy, _ = self._load_deployment()
            ntv_abi_path = self.module_dir / 'artifacts' / 'src' / 'contracts' / 'NativeToken.sol' / 'NativeToken.json'
            with open(ntv_abi_path) as f:
                ntv_abi = json.load(f)['abi']
            ntv = w3.eth.contract(
                address=Web3.to_checksum_address(deploy['nativeToken']),
                abi=ntv_abi,
            )
            approve_tx = ntv.functions.approve(registry.address, cost).build_transaction({
                'from': account.address,
                'nonce': w3.eth.get_transaction_count(account.address),
                'gas': 100000,
            })
            signed = account.sign_transaction(approve_tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        return self._send_tx(
            self._load_registry,
            lambda c: c.functions.registerSubnet(
                name,
                Web3.to_checksum_address(stake_time),
                Web3.to_checksum_address(incentive),
            ),
        )

    def deregister_subnet(self, subnet_id):
        """Deregister a subnet from the Registry."""
        return self._send_tx(
            self._load_registry,
            lambda c: c.functions.deregisterSubnet(int(subnet_id)),
        )

    def subnets(self):
        """List all active subnets."""
        _, contract, _ = self._load_registry()
        raw = contract.functions.getAllSubnets().call()
        result = []
        for s in raw:
            score = contract.functions.getStakeScore(s[0]).call()
            immune = contract.functions.isImmune(s[0]).call()
            result.append({
                'id': s[0], 'owner': s[1], 'name': s[2],
                'stakeTime': s[3], 'incentive': s[4],
                'registeredBlock': s[5], 'active': s[6],
                'stakeScore': str(score), 'immune': immune,
            })
        return result

    def subnet(self, subnet_id):
        """Get a single subnet's info."""
        _, contract, _ = self._load_registry()
        r = contract.functions.getSubnet(int(subnet_id)).call()
        score = contract.functions.getStakeScore(int(subnet_id)).call()
        immune = contract.functions.isImmune(int(subnet_id)).call()
        return {
            'id': r[0], 'owner': r[1], 'name': r[2],
            'stakeTime': r[3], 'incentive': r[4],
            'registeredBlock': r[5], 'active': r[6],
            'stakeScore': str(score), 'immune': immune,
        }

    def weakest_subnet(self):
        """Show which subnet would be replaced at capacity."""
        _, contract, _ = self._load_registry()
        weak_id, weak_score, found = contract.functions.getWeakestSubnet().call()
        return {'id': weak_id, 'score': str(weak_score), 'found': found}

    # ── Status ────────────────────────────────────────────────────────

    def status(self):
        deploy_path = self.module_dir / 'config.json'
        if not deploy_path.exists():
            return {'deployed': False}
        with open(deploy_path) as f:
            info = json.load(f)
        info['deployed'] = True
        info['stakeTime_explorer'] = f"https://sepolia.basescan.org/address/{info.get('stakeTime', '')}"
        info['incentive_explorer'] = f"https://sepolia.basescan.org/address/{info.get('incentive', '')}"
        try:
            info['consensus'] = self.consensus()
        except Exception:
            pass
        return info
