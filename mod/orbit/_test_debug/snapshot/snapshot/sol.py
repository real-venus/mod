"""Solana token snapshot — balance sheet scraping for SPL tokens."""

TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"


class SolanaSnapshot:
    """Solana SPL token holder snapshot."""

    def snapshot(self, mint: str, rpc_call, out: str = None, export_fn=None, print_table_fn=None, snap_dir_fn=None) -> list:
        result = rpc_call("solana", "getAccountInfo", [mint, {"encoding": "jsonParsed"}])
        if not result or not result.get("value"):
            raise Exception(f"Could not fetch mint info for {mint}")
        decimals = result["value"]["data"]["parsed"]["info"].get("decimals", 9)
        print(f"Token decimals: {decimals}")

        print("Fetching all token accounts...")
        accounts = rpc_call("solana", "getProgramAccounts", [
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

        if print_table_fn:
            print_table_fn(holders, mint, "solana", total_supply, decimals)
        if export_fn:
            export_fn(holders, out, mint, "solana", decimals, total_supply, snap_dir_fn)

        return holders
