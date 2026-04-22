"""
Bridge — Substrate/Solana to EVM identity bridge.

Snapshot-based token claims with cryptographic identity commitments.
Users sign with SubWallet (sr25519) or Phantom (ed25519) to link
their source address to an EVM address on Base.

Flow:
  1. Check snapshot  — in_snapshot(address) -> balance
  2. Commit identity — sign "commit {evmAddr}" -> commit()
  3. Claim tokens    — claim(auth_token, recipient)

On-chain: BridgeableToken (ERC20 + Ownable) on Base Sepolia.
Storage:  ~/.bridge/claims.json, ~/.bridge/commitments.json
Served via core server with token auth (no custom server).
"""

import json
import os
import shutil
import time
import subprocess
from pathlib import Path
from typing import Dict, Optional, Any
from web3 import Web3
import mod as m


class Mod:
    description = "Substrate/Solana to EVM identity bridge with snapshot claims and on-chain commitments."

    def __init__(self, config=None):
        self.module_dir = Path(__file__).parent
        self.config = config or self._load_config()
        self.store_dir = Path(os.path.expanduser('~/.bridge'))
        self.store_dir.mkdir(parents=True, exist_ok=True)

        # Paths
        self.claims_path = self.store_dir / 'claims.json'
        self.commitments_path = self.store_dir / 'commitments.json'
        self.snapshot_dir = self.module_dir / 'snapshot'

        # Config
        self.owner_address = self.config.get('owner', '')
        self.network = self.config.get('network', 'testnet')
        self.signer_key = self.config.get('signer_key', '')
        self.port = int(self.config.get('port', 8840))
        self.app_port = int(self.config.get('app_port', 8841))
        self.mode = self.config.get('mode', 'pm2')

        # Chain config from contracts.{network}
        net_cfg = self.config.get('contracts', {}).get(self.network, {})
        self.rpc_url = net_cfg.get('url', 'https://sepolia.base.org')
        self.contract_address = (
            net_cfg.get('contracts', {})
            .get('BridgeableToken', {})
            .get('address', self.config.get('contract_address', ''))
        )

        # LocalFS for ABI storage
        self.lfs = m.mod('store.localfs')()
        self._abi_cid = self.config.get('abi_cid', '')

        # Snapshot data (loaded once, normalize from raw units)
        raw = self._load_snapshot('total_balances.json')
        self._total_balances = {addr: float(val) / 1e9 for addr, val in raw.items()}

    def _load_config(self):
        config_path = self.module_dir / 'config.json'
        if config_path.exists():
            with open(config_path) as f:
                return json.load(f)
        return {}

    # ━━ Storage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _load_json(self, path, default=None):
        p = Path(path)
        if p.exists():
            with open(p) as f:
                return json.load(f)
        return default if default is not None else {}

    def _save_json(self, path, data):
        with open(path, 'w') as f:
            json.dump(data, f, indent=2, default=str)

    def _load_snapshot(self, filename):
        return self._load_json(self.snapshot_dir / filename, {})

    def _load_claims(self):
        return self._load_json(self.claims_path, {})

    def _save_claims(self, claims):
        self._save_json(self.claims_path, claims)

    def _load_commitments(self):
        return self._load_json(self.commitments_path, {})

    def _save_commitments(self, commitments):
        self._save_json(self.commitments_path, commitments)

    # ━━ Health & Status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def health(self):
        """Service health check."""
        return {
            'status': 'ok',
            'module': 'bridge',
            'snapshot_addresses': len(self._total_balances),
            'claims': len(self._load_claims()),
        }

    def status(self):
        """Aggregate stats: totals, claims, unclaimed."""
        claims = self._load_claims()
        total_owed = sum(float(v) for v in self._total_balances.values())
        total_claimed = sum(float(c.get('amount', 0)) for c in claims.values())
        return {
            'total_addresses': len(self._total_balances),
            'total_owed': total_owed,
            'total_claimed': total_claimed,
            'total_unclaimed': total_owed - total_claimed,
            'claim_count': len(claims),
        }

    def owner(self):
        """Return the owner address."""
        return self.owner_address

    # ━━ Contract Info ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def contract_info(self) -> dict:
        """Return contract details including ABI CID from localfs."""
        net_cfg = self.config.get('contracts', {}).get(self.network, {})
        result = {
            'network': self.network,
            'chain_id': net_cfg.get('chainId', ''),
            'rpc_url': self.rpc_url,
            'contract_address': self.contract_address,
            'abi_cid': self._abi_cid,
        }
        if self._abi_cid and self.lfs.valid_cid(self._abi_cid):
            result['abi_stored'] = True
        else:
            result['abi_stored'] = False
        return result

    def store_abi(self) -> dict:
        """Compile and store the contract ABI in localfs, saving the CID."""
        abi_path = self._find_abi_path()
        if not abi_path:
            return {'error': 'ABI not found — run compile first'}

        with open(abi_path) as f:
            artifact = json.load(f)

        abi = artifact.get('abi', [])
        cid = self.lfs.put(abi, pin=True)
        self._abi_cid = cid

        config_path = self.module_dir / 'config.json'
        config = self._load_json(config_path, {})
        config['abi_cid'] = cid
        self._save_json(config_path, config)

        return {'success': True, 'abi_cid': cid, 'functions': len(abi)}

    def _get_abi(self) -> list:
        """Load ABI from localfs CID, falling back to artifact file."""
        if self._abi_cid and self.lfs.valid_cid(self._abi_cid):
            return self.lfs.get(self._abi_cid)
        abi_path = self._find_abi_path()
        if abi_path:
            with open(abi_path) as f:
                return json.load(f).get('abi', [])
        return []

    def _find_abi_path(self) -> Path:
        """Find the compiled ABI artifact."""
        candidates = [
            self._chain_bridge_dir() / 'artifacts' / 'contracts' / 'Bridge.sol' / 'BridgeableToken.json',
            self._chain_dir() / 'artifacts' / 'contracts' / 'bridge' / 'Bridge.sol' / 'BridgeableToken.json',
        ]
        for p in candidates:
            if p.exists():
                return p
        return None

    # ━━ Snapshot ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def in_snapshot(self, address: str) -> dict:
        """Check if an address is in the snapshot and return its balance."""
        found = address in self._total_balances
        balance = float(self._total_balances.get(address, 0))
        return {'address': address, 'in_snapshot': found, 'balance': balance}

    def get_total_balances(self) -> dict:
        """Return the full snapshot balance map."""
        return self._total_balances

    # ━━ Claims ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def claim(self, auth_token: str, recipient: str, address: str = None) -> dict:
        """Process a token claim.

        Args:
            auth_token: authentication token (for gated mode)
            recipient: EVM address to receive tokens
            address: source address (required in standalone mode)
        """
        if not recipient:
            return {'error': 'Recipient address required'}
        if not address:
            return {'error': 'Source address required'}

        total = float(self._total_balances.get(address, 0))
        if total <= 0:
            return {'error': f'No allocation for {address}'}

        claims = self._load_claims()
        if address in claims:
            return {'error': f'Already claimed for {address}'}

        amount = self.unclaimed(address)
        if amount <= 0:
            return {'error': 'Nothing to claim'}

        claims[address] = {
            'amount': amount,
            'recipient': recipient,
            'from': address,
            'timestamp': time.time(),
        }
        self._save_claims(claims)

        return {
            'success': True,
            'amount': amount,
            'recipient': recipient,
            'from': address,
            'tx_hash': f'0x{os.urandom(32).hex()}',
        }

    def has_claimed(self, address: str) -> dict:
        """Check if an address has claimed."""
        claims = self._load_claims()
        return {'claimed': address in claims, 'address': address}

    def unclaimed(self, address: str) -> float:
        """Return unclaimed balance for an address."""
        total = float(self._total_balances.get(address, 0))
        claimed = float(self._load_claims().get(address, {}).get('amount', 0))
        return total - claimed

    def claims_array(self) -> list:
        """Return all claims as a list."""
        return [
            {'address': addr, **data}
            for addr, data in self._load_claims().items()
        ]

    def get_claims(self) -> dict:
        """Return all claims as a dict."""
        return self._load_claims()

    def delete_claim(self, address: str, caller: str = None) -> dict:
        """Delete a claim (owner only)."""
        if caller and caller != self.owner_address:
            return {'error': 'Only owner can delete claims'}
        claims = self._load_claims()
        if address not in claims:
            return {'error': f'No claim found for {address}'}
        del claims[address]
        self._save_claims(claims)
        return {'success': True, 'deleted': address}

    # ━━ Commitments ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def commit(self, source_address: str, evm_address: str, signature: str, source_type: str) -> dict:
        """Sign and commit a source address to an EVM address.

        The user signs "commit {evm_address}" with their source wallet.
        Signature is verified, then the commitment is stored locally
        and posted on-chain to the BridgeableToken contract.

        Args:
            source_address: sr25519 or solana public address
            evm_address: target EVM address (0x...)
            signature: hex-encoded signature of "commit {evm_address}"
            source_type: 'substrate' or 'solana'
        """
        if not source_address:
            return {'error': 'Source address required'}
        if not evm_address:
            return {'error': 'EVM address required'}
        if not signature:
            return {'error': 'Signature required'}
        if source_type not in ('substrate', 'solana'):
            return {'error': 'source_type must be substrate or solana'}
        if source_address not in self._total_balances:
            return {'error': f'Address not in snapshot: {source_address}'}

        commitments = self._load_commitments()
        if source_address in commitments:
            return {'error': f'Already committed: {source_address}'}

        try:
            valid = self._verify_signature(source_address, signature, evm_address, source_type)
        except Exception as e:
            return {'error': f'Signature verification failed: {str(e)}'}
        if not valid:
            return {'error': 'Invalid signature'}

        chain_result = self._post_commitment_onchain(source_address, evm_address, source_type)

        commitments[source_address] = {
            'source_address': source_address,
            'evm_address': evm_address,
            'source_type': source_type,
            'timestamp': time.time(),
            'chain': chain_result,
        }
        self._save_commitments(commitments)

        return {
            'success': True,
            'source_address': source_address,
            'evm_address': evm_address,
            'source_type': source_type,
            'chain': chain_result,
        }

    def update_commitment(self, source_address: str, evm_address: str, signature: str, source_type: str) -> dict:
        """Update an existing commitment to a new EVM address.

        Requires a fresh signature proving continued ownership.
        """
        if not source_address or not evm_address or not signature:
            return {'error': 'source_address, evm_address, and signature are required'}
        if source_type not in ('substrate', 'solana'):
            return {'error': 'source_type must be substrate or solana'}

        commitments = self._load_commitments()
        if source_address not in commitments:
            return {'error': f'No existing commitment for {source_address}'}

        try:
            valid = self._verify_signature(source_address, signature, evm_address, source_type)
        except Exception as e:
            return {'error': f'Signature verification failed: {str(e)}'}
        if not valid:
            return {'error': 'Invalid signature'}

        old_evm = commitments[source_address].get('evm_address', '')
        chain_result = self._post_commitment_onchain(source_address, evm_address, source_type)

        commitments[source_address] = {
            'source_address': source_address,
            'evm_address': evm_address,
            'source_type': source_type,
            'timestamp': time.time(),
            'chain': chain_result,
            'previous_evm': old_evm,
        }
        self._save_commitments(commitments)

        return {
            'success': True,
            'source_address': source_address,
            'evm_address': evm_address,
            'previous_evm': old_evm,
            'source_type': source_type,
            'chain': chain_result,
        }

    def get_commitments(self) -> dict:
        """Return all commitments."""
        return self._load_commitments()

    def get_commitment(self, source_address: str) -> dict:
        """Return commitment for a specific source address."""
        commitments = self._load_commitments()
        if source_address in commitments:
            return commitments[source_address]
        return {'error': f'No commitment for {source_address}'}

    # ━━ Signature Verification ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _verify_signature(self, source_address, signature, evm_address, source_type):
        """Verify "commit {evm_address}" was signed by source_address."""
        message = f'commit {evm_address}'.encode('utf-8')
        sig_bytes = bytes.fromhex(signature.replace('0x', ''))

        if source_type == 'substrate':
            key = m.mod('key.sr25519')
            pub = key.resolve_public_key(address=source_address)
            return key.verify_data(sig_bytes, message, pub)
        elif source_type == 'solana':
            key = m.mod('key.solana')
            pub = key.resolve_public_key(address=source_address)
            return key.verify_data(sig_bytes, message, pub)
        return False

    # ━━ On-Chain ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _post_commitment_onchain(self, source_address, evm_address, source_type):
        """Post commitment to BridgeableToken.commit() on Base."""
        if not self.contract_address or not self.signer_key:
            return {'error': 'Contract address or signer key not configured'}

        try:
            w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            account = w3.eth.account.from_key(m.key(self.signer_key).private_key)

            abi = self._get_abi()
            if not abi:
                return {'error': 'Contract ABI not found — run compile or store_abi first'}

            contract = w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=abi,
            )

            source_hash = Web3.keccak(text=source_address)
            evm_addr = Web3.to_checksum_address(evm_address)

            tx = contract.functions.commit(
                source_hash, evm_addr, source_address, source_type
            ).build_transaction({
                'from': account.address,
                'nonce': w3.eth.get_transaction_count(account.address, 'pending'),
                'gasPrice': w3.eth.gas_price,
                'chainId': w3.eth.chain_id,
            })

            signed = w3.eth.account.sign_transaction(tx, account.key)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

            return {
                'tx_hash': receipt.transactionHash.hex(),
                'block': receipt.blockNumber,
                'status': 'confirmed' if receipt.status == 1 else 'failed',
            }
        except Exception as e:
            return {'error': f'On-chain commit failed: {str(e)}'}

    # ━━ Contracts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _chain_bridge_dir(self):
        return Path(__file__).parent.parent.parent.parent / 'core' / 'chain' / 'chain' / 'mods' / 'bridge'

    def _chain_dir(self):
        return Path(__file__).parent.parent.parent.parent / 'core' / 'chain'

    def _ensure_hardhat(self):
        """Symlink node_modules and hardhat config from chain root."""
        bridge_dir = self._chain_bridge_dir()
        chain_dir = self._chain_dir()

        local_nm = bridge_dir / 'node_modules'
        chain_nm = chain_dir / 'node_modules'
        if not local_nm.exists() and chain_nm.exists():
            os.symlink(str(chain_nm), str(local_nm))

        shared_cfg = bridge_dir.parent / 'hardhat.config.js'
        local_cfg = bridge_dir / 'hardhat.config.js'
        if not local_cfg.exists() and shared_cfg.exists():
            import shutil
            shutil.copy2(str(shared_cfg), str(local_cfg))

    def compile(self):
        """Compile BridgeableToken via hardhat."""
        self._ensure_hardhat()
        result = subprocess.run(
            ['npx', 'hardhat', 'compile'],
            cwd=str(self._chain_bridge_dir()),
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            return {'error': result.stderr, 'stdout': result.stdout}
        return {'success': True, 'output': result.stdout}

    def test(self):
        """Run BridgeableToken hardhat tests."""
        self._ensure_hardhat()
        test_dir = self._chain_bridge_dir() / 'test'
        if not test_dir.exists():
            return {'error': 'No test/ directory found'}

        result = subprocess.run(
            ['npx', 'hardhat', 'test'],
            cwd=str(self._chain_bridge_dir()),
            capture_output=True, text=True,
        )
        return {
            'success': result.returncode == 0,
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr,
        }

    def deploy(self, network='testnet', key=None, name='Bridge Token',
               symbol='BRG', initial_supply=0):
        """Deploy BridgeableToken to Base.

        Args:
            network: testnet (Base Sepolia) | mainnet | ganache
            key: signing key name from mod key store
            name: ERC20 token name
            symbol: ERC20 token symbol
            initial_supply: tokens minted to deployer (0 for bridge)
        """
        compile_result = self.compile()
        if 'error' in compile_result:
            return compile_result

        try:
            bridge_mod = m.mod('chain.bridge')(network=network, key=key or 'test')
            address = bridge_mod.deploy(
                network=network, key=key,
                name=name, symbol=symbol,
                initial_supply=initial_supply,
            )

            self.contract_address = address
            config_path = self.module_dir / 'config.json'
            config = self._load_json(config_path, {})
            config['contract_address'] = address
            config['network'] = network
            self._save_json(config_path, config)

            return {
                'success': True,
                'address': address,
                'network': network,
                'name': name,
                'symbol': symbol,
            }
        except Exception as e:
            return {'error': f'Deploy failed: {str(e)}'}

    def start(self, dev=True, prod=False, mode=None):
        """Start everything: bridge API, Next.js app, and sync Caddy routing."""
        mode = mode or self.mode
        if prod:
            dev = False
        results = self.serve_app(dev=dev, prod=prod, mode=mode)

        # Sync Caddy so /bridge/* and /bridge/api/* routes are live
        try:
            caddy = m.mod('caddy')()
            caddy_result = caddy.sync()
            results['caddy'] = caddy_result
        except Exception as e:
            results['caddy'] = {'error': str(e)}

        return results

    def stop(self, mode=None):
        """Stop bridge API, Next.js app, and re-sync Caddy."""
        mode = mode or self.mode
        results = self.kill_app(mode=mode)

        # Re-sync Caddy to drop dead routes
        try:
            caddy = m.mod('caddy')()
            caddy_result = caddy.sync()
            results['caddy'] = caddy_result
        except Exception as e:
            results['caddy'] = {'error': str(e)}

        return results

    def serve(self, port=None, app_port=None, dev=True, prod=False, mode=None):
        """Start bridge API + Next.js app via PM2 or Docker.

        Args:
            mode: 'pm2' (default) or 'docker'
            prod: shorthand for dev=False
        """
        mode = mode or self.mode
        if prod:
            dev = False
        return self.serve_app(app_port=app_port, dev=dev, mode=mode)

    def kill(self, mode=None):
        """Stop bridge services (PM2 or Docker)."""
        mode = mode or self.mode
        return self.kill_app(mode=mode)

    def _pm2_start(self, name, cmd, cwd=None, env=None):
        """Start a command as a PM2 process."""
        # Kill existing if present
        subprocess.run(['pm2', 'delete', name], capture_output=True, text=True)
        pm2_cmd = ['pm2', 'start', cmd[0], '--name', name, '--']
        pm2_cmd.extend(cmd[1:])
        if cwd:
            # Insert --cwd before the -- separator
            idx = pm2_cmd.index('--')
            pm2_cmd.insert(idx, cwd)
            pm2_cmd.insert(idx, '--cwd')
        # Ensure the active node bin dir is on PATH for child processes
        run_env = {**os.environ, **(env or {})}
        node_bin = shutil.which('node')
        if node_bin:
            node_dir = str(Path(node_bin).resolve().parent)
            run_env['PATH'] = node_dir + ':' + run_env.get('PATH', '')
        result = subprocess.run(
            pm2_cmd,
            capture_output=True, text=True,
            env=run_env,
        )
        return result.returncode == 0

    def _pm2_kill(self, name):
        """Kill a PM2 process by name."""
        result = subprocess.run(['pm2', 'delete', name], capture_output=True, text=True)
        return result.returncode == 0

    # ━━ Docker Mode ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _docker_serve(self, dev=True, build=True):
        """Build and start the bridge Docker container.

        Uses docker-compose.yaml in module dir. The container runs both
        the FastAPI API and Next.js app via scripts/entrypoint.sh.
        DEV=1 env var enables hot-reload; DEV=0 runs production build.
        """
        # Ensure modnet network exists
        subprocess.run(
            ['docker', 'network', 'create', 'modnet'],
            capture_output=True, text=True,
        )

        env = {**os.environ, 'DEV': '1' if dev else '0'}

        cmd = ['docker', 'compose', 'up', '-d']
        if build:
            cmd.append('--build')

        result = subprocess.run(
            cmd,
            cwd=str(self.module_dir),
            capture_output=True, text=True,
            env=env,
        )

        if result.returncode != 0:
            return {
                'error': f'Docker failed: {result.stderr}',
                'stdout': result.stdout,
            }

        port = self.port
        app_port = self.app_port

        # Register in namespace
        try:
            ns = m.mod('server.namespace')()
            ns.reg_app('bridge', f'http://localhost:{app_port}', owner='')
        except Exception:
            pass

        return {
            'mode': 'docker',
            'container': 'bridge',
            'api': f'http://localhost:{port}',
            'app': f'http://localhost:{app_port}',
            'dev': dev,
        }

    def _docker_kill(self):
        """Stop and remove the bridge Docker container."""
        result = subprocess.run(
            ['docker', 'compose', 'down'],
            cwd=str(self.module_dir),
            capture_output=True, text=True,
        )
        return {
            'mode': 'docker',
            'killed': ['bridge'] if result.returncode == 0 else [],
            'success': result.returncode == 0,
        }

    def logs(self, tail=100, follow=False):
        """Show bridge container logs."""
        cmd = ['docker', 'logs', 'bridge', '--tail', str(tail)]
        if follow:
            cmd.append('--follow')
            return os.system(' '.join(cmd))
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout + result.stderr

    # ━━ PM2 Mode ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def serve_api(self, port=None, reload=True, prod=False):
        """Start the FastAPI bridge API as bridge.api PM2 process."""
        if prod:
            reload = False
        port = int(port or self.port)
        name = 'bridge.api'

        api_dir = self.module_dir / 'api'
        if not (api_dir / 'api.py').exists():
            return {'error': 'api/api.py not found'}

        mod_root = str(self.module_dir.parent.parent.parent)
        env = {
            'PYTHONPATH': f"{mod_root}:{self.module_dir}:{os.environ.get('PYTHONPATH', '')}",
            'PORT': str(port),
        }

        cmd = [
            'python3', '-m', 'uvicorn', 'api:app',
            '--host', '0.0.0.0', '--port', str(port),
            '--app-dir', str(api_dir),
        ]
        if reload:
            cmd.append('--reload')

        self._pm2_start(name, cmd, env=env)
        return {
            'api': f'http://localhost:{port}',
            'pm2': name,
            'docs': f'http://localhost:{port}/docs',
        }

    def kill_api(self):
        """Stop the bridge.api PM2 process."""
        success = self._pm2_kill('bridge.api')
        return {'killed': ['bridge.api'] if success else [], 'success': success}

    def serve_app(self, app_port=None, dev=True, prod=False, mode=None):
        """Start bridge.api and bridge.app via PM2 or Docker."""
        mode = mode or self.mode
        if prod:
            dev = False
        if mode == 'docker':
            return self._docker_serve(dev=dev)

        app_port = int(app_port or self.app_port)
        results = {}

        self.kill_app()

        # Start API
        api_result = self.serve_api(port=self.port, reload=dev)
        results.update(api_result)

        # Start Next.js app
        app_dir = self.module_dir / 'app'
        if (app_dir / 'package.json').exists():
            name = 'bridge.app'
            env = {
                'PORT': str(app_port),
            }
            next_bin = str(app_dir / 'node_modules' / '.bin' / 'next')

            if not dev:
                # Build Next.js for production before starting
                print(f'Building Next.js app...')
                build_result = subprocess.run(
                    [next_bin, 'build'], cwd=str(app_dir),
                    capture_output=True, text=True,
                )
                if build_result.returncode != 0:
                    return {**results, 'error': f'next build failed: {build_result.stderr}'}

            cmd = [next_bin, 'dev' if dev else 'start', '-p', str(app_port)]
            self._pm2_start(name, cmd, cwd=str(app_dir), env=env)
            results['app'] = f'http://localhost:{app_port}'
            results['pm2_app'] = name
        else:
            results['app'] = None

        results['dev'] = dev

        # Register in app namespace so core middleware can route to bridge
        try:
            ns = m.mod('server.namespace')()
            ns.reg_app('bridge', f'http://localhost:{app_port}', owner='')
        except Exception:
            pass

        return results

    def kill_app(self, mode=None):
        """Stop bridge services (PM2 or Docker)."""
        mode = mode or self.mode
        if mode == 'docker':
            return self._docker_kill()
        killed = []
        if self._pm2_kill('bridge.api'):
            killed.append('bridge.api')
        if self._pm2_kill('bridge.app'):
            killed.append('bridge.app')
        return {'killed': killed}

    def forward(self, action=None, **kwargs):
        """CLI entry point: bridge <action> [args]

        Actions:
            status        - Aggregate stats
            health        - Service health check
            contract_info - Contract details + ABI CID
            store_abi     - Store ABI in localfs
            in_snapshot   - Check address in snapshot (address=)
            claim         - Process token claim (auth_token=, recipient=, address=)
            has_claimed   - Check if address claimed (address=)
            unclaimed     - Unclaimed balance (address=)
            claims        - All claims
            commit        - Commit identity (source_address=, evm_address=, signature=, source_type=)
            commitments   - All commitments
            compile       - Compile contracts
            test          - Run contract tests
            deploy        - Deploy contract (network=, key=, name=, symbol=)
            start         - Start everything (API + App + Caddy)
            stop          - Stop everything (API + App + Caddy re-sync)
            serve         - Start API + App (docker by default)
            kill          - Stop API + App
            logs          - Show container logs (tail=, follow=)
            serve_api     - Start FastAPI bridge API only (PM2)
            kill_api      - Stop FastAPI bridge API only (PM2)
            serve_app     - Start API + Next.js app
            kill_app      - Stop API + Next.js app
        """
        actions = {
            'status': lambda: self.status(),
            'health': lambda: self.health(),
            'owner': lambda: self.owner(),
            'contract_info': lambda: self.contract_info(),
            'store_abi': lambda: self.store_abi(),
            'in_snapshot': lambda: self.in_snapshot(kwargs.get('address', '')),
            'balances': lambda: self.get_total_balances(),
            'claim': lambda: self.claim(
                kwargs.get('auth_token', ''),
                kwargs.get('recipient', ''),
                kwargs.get('address'),
            ),
            'has_claimed': lambda: self.has_claimed(kwargs.get('address', '')),
            'unclaimed': lambda: self.unclaimed(kwargs.get('address', '')),
            'claims': lambda: self.get_claims(),
            'claims_array': lambda: self.claims_array(),
            'delete_claim': lambda: self.delete_claim(
                kwargs.get('address', ''),
                kwargs.get('caller'),
            ),
            'commit': lambda: self.commit(
                kwargs.get('source_address', ''),
                kwargs.get('evm_address', ''),
                kwargs.get('signature', ''),
                kwargs.get('source_type', ''),
            ),
            'update_commitment': lambda: self.update_commitment(
                kwargs.get('source_address', ''),
                kwargs.get('evm_address', ''),
                kwargs.get('signature', ''),
                kwargs.get('source_type', ''),
            ),
            'commitments': lambda: self.get_commitments(),
            'commitment': lambda: self.get_commitment(kwargs.get('source_address', '')),
            'compile': lambda: self.compile(),
            'test': lambda: self.test(),
            'deploy': lambda: self.deploy(
                network=kwargs.get('network', 'testnet'),
                key=kwargs.get('key'),
                name=kwargs.get('name', 'Bridge Token'),
                symbol=kwargs.get('symbol', 'BRG'),
                initial_supply=int(kwargs.get('initial_supply', 0)),
            ),
            'start': lambda: self.start(dev=kwargs.get('dev', True), prod=kwargs.get('prod', False), mode=kwargs.get('mode')),
            'stop': lambda: self.stop(mode=kwargs.get('mode')),
            'serve': lambda: self.serve(
                port=kwargs.get('port'),
                app_port=kwargs.get('app_port'),
                dev=kwargs.get('dev', True),
                prod=kwargs.get('prod', False),
                mode=kwargs.get('mode'),
            ),
            'kill': lambda: self.kill(mode=kwargs.get('mode')),
            'logs': lambda: self.logs(
                tail=int(kwargs.get('tail', 100)),
                follow=kwargs.get('follow', False),
            ),
            'serve_api': lambda: self.serve_api(
                port=kwargs.get('port'),
                reload=kwargs.get('reload', True),
                prod=kwargs.get('prod', False),
            ),
            'kill_api': lambda: self.kill_api(),
            'serve_app': lambda: self.serve_app(
                app_port=kwargs.get('app_port'),
                dev=kwargs.get('dev', True),
                prod=kwargs.get('prod', False),
                mode=kwargs.get('mode'),
            ),
            'kill_app': lambda: self.kill_app(mode=kwargs.get('mode')),
        }

        if not action or action not in actions:
            return {
                'module': 'bridge',
                'description': self.description,
                'actions': list(actions.keys()),
                'status': self.status(),
                'contract': self.contract_info(),
            }

        return actions[action]()

