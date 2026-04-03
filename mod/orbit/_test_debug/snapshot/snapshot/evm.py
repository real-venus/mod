"""EVM token snapshot — balance sheet scraping for ERC-20 tokens on Base, Ethereum, etc."""

ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ERC20_DECIMALS_SIG = "0x313ce567"
ERC20_BALANCE_SIG = "0x70a08231"
ERC20_SUPPLY_SIG = "0x18160ddd"


class EVMSnapshot:
    """EVM (Base, Ethereum) ERC-20 token holder snapshot."""

    def _evm_call(self, network: str, to: str, data: str, rpc_call) -> str:
        return rpc_call(network, "eth_call", [{"to": to, "data": data}, "latest"])

    def snapshot(self, token: str, network: str, rpc_call, out: str = None, export_fn=None, print_table_fn=None, snap_dir_fn=None) -> list:
        token = token.lower()

        decimals = int(self._evm_call(network, token, ERC20_DECIMALS_SIG, rpc_call), 16)
        print(f"Token decimals: {decimals}")

        total_supply_raw = int(self._evm_call(network, token, ERC20_SUPPLY_SIG, rpc_call), 16)
        print(f"Total supply: {total_supply_raw / (10 ** decimals):,.{min(decimals, 4)}f}")

        latest_block = int(rpc_call(network, "eth_blockNumber", []), 16)
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
                logs = rpc_call(network, "eth_getLogs", [{
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
                balance_raw = int(self._evm_call(network, token, call_data, rpc_call), 16)
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

        if print_table_fn:
            print_table_fn(holders, token, network, total_supply_raw, decimals)
        if export_fn:
            export_fn(holders, out, token, network, decimals, total_supply_raw, snap_dir_fn)

        return holders
