"""
Token Snapshot - Scrape full balance sheet for an SPL token.

Takes a Solana token mint address and fetches every holder + balance
using the Solana RPC `getTokenLargestAccounts` and `getProgramAccounts`.

Usage:
    from raydium.token.snapshot.mod import Snapshot
    snap = Snapshot()
    holders = snap.forward("TOKEN_MINT_ADDRESS")
"""

import json
import requests
import os
from datetime import datetime

RPC_URL = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"


class Snapshot:
    description = "Take a snapshot of all holders for an SPL token mint"
    def __init__(self, address: str = None):
        self.address = address

    def rpc(self, method, params):
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        resp = requests.post(RPC_URL, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise Exception(f"RPC error: {data['error']}")
        return data["result"]

    def forward(self, mint: str, out: str = None) -> list:
        """
        Snapshot all token holders for a given mint address.

        Args:
            mint: SPL token mint address
            out:  Optional output JSON path. Defaults to snapshot_<mint[:8]>_<date>.json

        Returns:
            List of dicts: [{"owner": str, "account": str, "balance_raw": int, "balance": float, "pct": float}, ...]
        """
        print(f"Fetching token info for mint: {mint}")

        # Get mint decimals
        decimals = self._get_decimals(mint)
        print(f"Token decimals: {decimals}")

        # Fetch all token accounts for this mint
        print("Fetching all token accounts (this may take a moment)...")
        accounts = self._get_all_token_accounts(mint)
        print(f"Found {len(accounts)} token accounts")

        # Parse into holder list
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

        # Calculate human-readable balance and percentage
        divisor = 10 ** decimals
        for h in holders:
            h["balance"] = h["balance_raw"] / divisor
            h["pct"] = (h["balance_raw"] / total_supply * 100) if total_supply > 0 else 0

        # Sort by balance descending
        holders.sort(key=lambda x: x["balance_raw"], reverse=True)

        # Print summary
        print(f"\n{'='*70}")
        print(f"TOKEN SNAPSHOT - {mint}")
        print(f"{'='*70}")
        print(f"Total holders (non-zero): {len(holders)}")
        print(f"Total supply:             {total_supply / divisor:,.{decimals}f}")
        print(f"{'='*70}")
        print(f"{'#':<6} {'Owner':<46} {'Balance':>20} {'%':>8}")
        print(f"{'-'*70}")
        for i, h in enumerate(holders[:30]):
            print(f"{i+1:<6} {h['owner'][:44]+'..':46} {h['balance']:>20,.2f} {h['pct']:>7.2f}%")
        if len(holders) > 30:
            print(f"  ... and {len(holders) - 30} more holders")

        # Export to JSON
        if out is None:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            out = f"snapshot_{mint[:8]}_{ts}.json"
        self._export_json(holders, out, mint, decimals, total_supply)
        print(f"\nSnapshot saved to: {out}")

        return holders

    def balance_map(self, mint: str = None, out: str = "total_balances.json") -> dict:
        """
        Generate a simple address -> balance map for bridge module compatibility.

        Args:
            mint: SPL token mint address
            out:  Output path. Defaults to total_balances.json

        Returns:
            dict: { "owner_address": balance_float, ... }
        """
        holders = self.forward(mint)
        mint = mint or self.address

        # Aggregate balances per owner (some owners may have multiple token accounts)
        balances = {}
        for h in holders:
            owner = h["owner"]
            balances[owner] = balances.get(owner, 0) + h["balance"]

        # Sort by balance descending
        balances = dict(sorted(balances.items(), key=lambda x: x[1], reverse=True))

        with open(out, "w") as f:
            json.dump(balances, f, indent=2)

        print(f"\nBalance map saved to: {out}")
        print(f"Unique owners: {len(balances)}")
        return balances

    def _get_decimals(self, mint: str) -> int:
        result = self.rpc("getAccountInfo", [
            mint,
            {"encoding": "jsonParsed"}
        ])
        if result and result.get("value"):
            parsed = result["value"]["data"]["parsed"]["info"]
            return parsed.get("decimals", 9)
        raise Exception(f"Could not fetch mint info for {mint}")

    def _get_all_token_accounts(self, mint: str) -> list:
        """Fetch all token accounts for a mint using getProgramAccounts."""
        # Filter: accounts owned by Token Program, matching this mint
        # Mint is at offset 0 in SPL token account data
        result = self.rpc("getProgramAccounts", [
            TOKEN_PROGRAM_ID,
            {
                "encoding": "jsonParsed",
                "filters": [
                    {"dataSize": 165},  # SPL token account size
                    {
                        "memcmp": {
                            "offset": 0,
                            "bytes": mint,
                        }
                    }
                ]
            }
        ])
        return result

    def _export_json(self, holders: list, path: str, mint: str, decimals: int, total_raw: int):
        """Export snapshot to JSON."""
        blob = {
            "mint": mint,
            "timestamp": datetime.now().isoformat(),
            "decimals": decimals,
            "total_supply_raw": total_raw,
            "total_supply": total_raw / (10 ** decimals),
            "total_holders": len(holders),
            "holders": [
                {
                    "rank": i + 1,
                    "owner": h["owner"],
                    "token_account": h["account"],
                    "balance_raw": h["balance_raw"],
                    "balance": h["balance"],
                    "pct": round(h["pct"], 4),
                }
                for i, h in enumerate(holders)
            ],
        }
        with open(path, "w") as f:
            json.dump(blob, f, indent=2)


# CLI entry point
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m raydium.snapshot.mod <MINT_ADDRESS> [--map] [output.json]")
        print("  --map    Output simple address->balance map as total_balances.json")
        sys.exit(1)

    mint_addr = sys.argv[1]
    use_map = "--map" in sys.argv
    args = [a for a in sys.argv[2:] if a != "--map"]
    out_path = args[0] if args else None

    snap = Snapshot()
    if use_map:
        snap.balance_map(mint_addr, out=out_path or "total_balances.json")
    else:
        snap.forward(mint_addr, out=out_path)
