"""
Multi-Chain Token Snapshot — balance sheet for a token on Solana, Base, or Ethereum.

Format: {network}/{token_address}

Usage:
    from snapshot.mod import Snapshot
    snap = Snapshot()
    holders = snap.forward("solana/TOKEN_MINT")
    holders = snap.forward("base/0xTokenAddress")
    holders = snap.forward("ethereum/0xTokenAddress")
"""

import json
import requests
import os
import random
import time
from datetime import datetime

# ─── RPC Endpoints (multiple per network to avoid rate limits) ────────────────
RPC_LISTS = {
    "solana": [
        os.environ.get("SOLANA_RPC_URL", ""),
        "https://api.mainnet-beta.solana.com",
        "https://solana-mainnet.g.alchemy.com/v2/demo",
        "https://solana.publicnode.com",
    ],
    "base": [
        os.environ.get("BASE_RPC_URL", ""),
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://base.publicnode.com",
        "https://base.drpc.org",
        "https://1rpc.io/base",
    ],
    "ethereum": [
        os.environ.get("ETH_RPC_URL", ""),
        "https://eth.llamarpc.com",
        "https://ethereum.publicnode.com",
        "https://eth.drpc.org",
        "https://1rpc.io/eth",
        "https://rpc.mevblocker.io",
        "https://rpc.flashbots.net",
    ],
}
# Filter out empty env vars
for _net in RPC_LISTS:
    RPC_LISTS[_net] = [u for u in RPC_LISTS[_net] if u]

TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ERC20_DECIMALS_SIG = "0x313ce567"
ERC20_BALANCE_SIG = "0x70a08231"
ERC20_SUPPLY_SIG = "0x18160ddd"

SUPPORTED_NETWORKS = ("solana", "base", "ethereum")


def parse_target(target: str) -> tuple:
    """Parse 'network/address' into (network, address)."""
    if "/" not in target:
        raise ValueError(f"Expected format: network/address (e.g. solana/So1..., base/0x...). Got: {target}")
    network, address = target.split("/", 1)
    network = network.lower()
    if network not in SUPPORTED_NETWORKS:
        raise ValueError(f"Unsupported network '{network}'. Use: {', '.join(SUPPORTED_NETWORKS)}")
    return network, address


class Snapshot:
    description = "Take a snapshot of all holders for a token on Solana, Base, or Ethereum"

    def __init__(self, address: str = None):
        self.address = address
        self._rpc_index = {net: 0 for net in RPC_LISTS}

    def forward(self, target: str = None, out: str = None) -> list:
        """
        Snapshot all token holders.

        Args:
            target: 'network/token_address' — e.g. 'solana/So1...', 'base/0x...', 'ethereum/0x...'
            out:    Optional output JSON path.

        Returns:
            List of holder dicts with owner, balance, pct fields.
        """
        target = target or self.address
        if not target:
            raise ValueError("Target required. Format: network/address")

        network, token = parse_target(target)
        print(f"\n[{network.upper()}] Snapshotting token: {token}")

        if network == "solana":
            return self._snapshot_solana(token, out)
        else:
            return self._snapshot_evm(token, network, out)

    def _snap_dir(self, network: str, token: str) -> str:
        base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "snapshots", network, token)
        os.makedirs(base, exist_ok=True)
        return base

    # ─── Solana ──────────────────────────────────────────────────────────

    def _next_rpc(self, network: str) -> str:
        urls = RPC_LISTS[network]
        idx = self._rpc_index[network]
        self._rpc_index[network] = (idx + 1) % len(urls)
        return urls[idx]

    def _rpc_call(self, network: str, method: str, params, max_retries: int = None):
        urls = RPC_LISTS[network]
        if max_retries is None:
            max_retries = len(urls) * 3
        payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        last_err = None
        for attempt in range(max_retries):
            url = self._next_rpc(network)
            try:
                resp = requests.post(url, json=payload, timeout=120)
                if resp.status_code == 429:
                    wait = min(2 ** attempt, 10)
                    print(f"  429 from {url.split('/')[2]}, rotating... (wait {wait}s)")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                if "error" in data:
                    last_err = Exception(f"{network} RPC error: {data['error']}")
                    print(f"  RPC error from {url.split('/')[2]}, rotating...")
                    continue
                return data["result"]
            except requests.exceptions.HTTPError as e:
                last_err = e
                status = resp.status_code if resp is not None else 0
                if status == 429 or "Too Many Requests" in str(e):
                    time.sleep(min(2 ** attempt, 10))
                    continue
                if status == 408 or status >= 500:
                    print(f"  {status} from {url.split('/')[2]}, rotating...")
                    time.sleep(1)
                    continue
                raise
            except requests.exceptions.ConnectionError:
                last_err = Exception(f"Connection failed: {url}")
                continue
        raise last_err or Exception(f"All RPCs exhausted for {network}")

    def _solana_rpc(self, method, params):
        return self._rpc_call("solana", method, params)

    def _snapshot_solana(self, mint: str, out: str = None) -> list:
        result = self._solana_rpc("getAccountInfo", [mint, {"encoding": "jsonParsed"}])
        if not result or not result.get("value"):
            raise Exception(f"Could not fetch mint info for {mint}")
        decimals = result["value"]["data"]["parsed"]["info"].get("decimals", 9)
        print(f"Token decimals: {decimals}")

        print("Fetching all token accounts...")
        accounts = self._solana_rpc("getProgramAccounts", [
            TOKEN_PROGRAM_ID,
            {
                "encoding": "jsonParsed",
                "filters": [
                    {"dataSize": 165},
                    {"memcmp": {"offset": 0, "bytes": mint}},
                ],
            },
        ])
        print(f"Found {len(accounts)} token accounts")

        holders = []
        total_supply = 0
        for acct in accounts:
            info = acct["account"]["data"]["parsed"]["info"]
            owner = info["owner"]
            raw_amount = int(info["tokenAmount"]["amount"])
            if raw_amount == 0:
                continue
            total_supply += raw_amount
            holders.append({
                "owner": owner,
                "account": acct["pubkey"],
                "balance_raw": raw_amount,
            })

        divisor = 10 ** decimals
        for h in holders:
            h["balance"] = h["balance_raw"] / divisor
            h["pct"] = (h["balance_raw"] / total_supply * 100) if total_supply > 0 else 0

        holders.sort(key=lambda x: x["balance_raw"], reverse=True)
        self._print_table(holders, mint, "solana", total_supply, decimals)
        self._export(holders, out, mint, "solana", decimals, total_supply)
        return holders

    # ─── EVM (Base + Ethereum) ───────────────────────────────────────────

    def _evm_rpc(self, network: str, method: str, params: list):
        return self._rpc_call(network, method, params)

    def _evm_call(self, network: str, to: str, data: str) -> str:
        return self._evm_rpc(network, "eth_call", [{"to": to, "data": data}, "latest"])

    def _snapshot_evm(self, token: str, network: str, out: str = None) -> list:
        token = token.lower()

        decimals = int(self._evm_call(network, token, ERC20_DECIMALS_SIG), 16)
        print(f"Token decimals: {decimals}")

        total_supply_raw = int(self._evm_call(network, token, ERC20_SUPPLY_SIG), 16)
        print(f"Total supply: {total_supply_raw / (10 ** decimals):,.{min(decimals, 4)}f}")

        latest_block = int(self._evm_rpc(network, "eth_blockNumber", []), 16)
        print(f"Current block: {latest_block}")

        # Scan Transfer events to collect all addresses that ever held the token
        print("Scanning Transfer events...")
        holder_addrs = set()
        chunk_size = 10000
        start_block = max(0, latest_block - 2_000_000)

        block = start_block
        while block <= latest_block:
            to_block = min(block + chunk_size - 1, latest_block)
            try:
                logs = self._evm_rpc(network, "eth_getLogs", [{
                    "address": token,
                    "topics": [ERC20_TRANSFER_TOPIC],
                    "fromBlock": hex(block),
                    "toBlock": hex(to_block),
                }])
                for log in logs:
                    if len(log["topics"]) >= 3:
                        holder_addrs.add("0x" + log["topics"][1][-40:])
                        holder_addrs.add("0x" + log["topics"][2][-40:])
            except Exception as e:
                err_msg = str(e).lower()
                if any(k in err_msg for k in ("range", "limit", "too many", "exceed")):
                    chunk_size = max(500, chunk_size // 2)
                    continue
                raise

            progress = min(100, int((to_block - start_block) / max(1, latest_block - start_block) * 100))
            if progress % 10 == 0 or to_block == latest_block:
                print(f"  Block {to_block} ({progress}%) — {len(holder_addrs)} addresses")
            block = to_block + 1

        holder_addrs.discard("0x" + "0" * 40)
        print(f"Unique addresses: {len(holder_addrs)}")

        # Query current balances
        print("Querying balances...")
        holders = []
        divisor = 10 ** decimals
        checked = 0

        for addr in holder_addrs:
            call_data = ERC20_BALANCE_SIG + addr[2:].lower().zfill(64)
            try:
                balance_raw = int(self._evm_call(network, token, call_data), 16)
            except Exception:
                balance_raw = 0
            checked += 1
            if checked % 200 == 0:
                print(f"  {checked}/{len(holder_addrs)} checked...")
            if balance_raw == 0:
                continue
            holders.append({
                "owner": addr,
                "account": addr,
                "balance_raw": balance_raw,
                "balance": balance_raw / divisor,
                "pct": (balance_raw / total_supply_raw * 100) if total_supply_raw > 0 else 0,
            })

        holders.sort(key=lambda x: x["balance_raw"], reverse=True)
        self._print_table(holders, token, network, total_supply_raw, decimals)
        self._export(holders, out, token, network, decimals, total_supply_raw)
        return holders

    # ─── Output ──────────────────────────────────────────────────────────

    def _print_table(self, holders, token, network, total_supply, decimals):
        divisor = 10 ** decimals
        print(f"\n{'='*70}")
        print(f"TOKEN SNAPSHOT — {network.upper()} — {token}")
        print(f"{'='*70}")
        print(f"Total holders (non-zero): {len(holders)}")
        print(f"Total supply:             {total_supply / divisor:,.{min(decimals, 4)}f}")
        print(f"{'='*70}")
        print(f"{'#':<6} {'Owner':<46} {'Balance':>20} {'%':>8}")
        print(f"{'-'*70}")
        for i, h in enumerate(holders[:30]):
            owner = h["owner"][:44] + ".." if len(h["owner"]) > 44 else h["owner"]
            print(f"{i+1:<6} {owner:46} {h['balance']:>20,.2f} {h['pct']:>7.2f}%")
        if len(holders) > 30:
            print(f"  ... and {len(holders) - 30} more holders")

    def _export(self, holders, out, token, network, decimals, total_raw):
        out_dir = out or self._snap_dir(network, token)

        # snapshot.json — full holder list
        snapshot_path = os.path.join(out_dir, "snapshot.json")
        blob = {
            "network": network,
            "token": token,
            "timestamp": datetime.now().isoformat(),
            "decimals": decimals,
            "total_supply_raw": total_raw,
            "total_supply": total_raw / (10 ** decimals),
            "total_holders": len(holders),
            "holders": [
                {
                    "rank": i + 1,
                    "owner": h["owner"],
                    "account": h.get("account", h["owner"]),
                    "balance_raw": h["balance_raw"],
                    "balance": h["balance"],
                    "pct": round(h["pct"], 4),
                }
                for i, h in enumerate(holders)
            ],
        }
        with open(snapshot_path, "w") as f:
            json.dump(blob, f, indent=2)
        print(f"\nSnapshot saved to: {snapshot_path}")

        # balances.json — address -> balance map
        balances = {}
        for h in holders:
            owner = h["owner"]
            balances[owner] = balances.get(owner, 0) + h["balance"]
        balances = dict(sorted(balances.items(), key=lambda x: x[1], reverse=True))

        balances_path = os.path.join(out_dir, "balances.json")
        with open(balances_path, "w") as f:
            json.dump(balances, f, indent=2)
        print(f"Balances saved to: {balances_path}")
        print(f"Unique owners: {len(balances)}")


# ─── CLI ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    usage = """Usage: python -m snapshot.mod <network/token_address> [-o <DIR>]

Format:  solana/<mint>  |  base/<0x...>  |  ethereum/<0x...>

Output:  snapshots/{network}/{address}/snapshot.json
         snapshots/{network}/{address}/balances.json

Options:
    -o <DIR>       Override output directory

Examples:
    python -m snapshot.mod solana/So11111...
    python -m snapshot.mod base/0xAbCdEf...
    python -m snapshot.mod ethereum/0xAbCdEf...
"""
    if len(sys.argv) < 2:
        print(usage)
        sys.exit(1)

    args = sys.argv[1:]
    out_path = None

    filtered = []
    i = 0
    while i < len(args):
        if args[i] == "-o" and i + 1 < len(args):
            out_path = args[i + 1]
            i += 2
        else:
            filtered.append(args[i])
            i += 1

    target = filtered[0] if filtered else None
    if not target:
        print(usage)
        sys.exit(1)

    snap = Snapshot()
    snap.forward(target, out=out_path)
