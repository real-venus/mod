# filecoin

Simple Filecoin network interface. Uses the public Glif RPC — no API key needed.

## Usage

```python
import mod as m
fil = m.mod('filecoin')()

# Network status
fil.status()

# Balance
fil.balance('f1...')

# Chain
fil.height()
fil.head()
fil.block(cid)
fil.message(cid)

# Gas
fil.base_fee()
fil.gas_estimate(address)

# Storage deals
fil.deal(deal_id)
fil.miner_info('f0...')
fil.miner_power('f0...')

# Network
fil.network()
fil.supply()
fil.network_power()

# Search transactions
fil.search_msg(cid)
fil.receipt(cid)
```

```bash
# CLI
m filecoin                           # network status
m filecoin forward address=f1...     # balance
m filecoin balance address=f1...     # balance
m filecoin height                    # block height
m filecoin deal deal_id=123          # deal info
m filecoin test                      # connectivity test
```

## Config

Set `FILECOIN_RPC` env var to use a different endpoint (default: `https://api.node.glif.io/rpc/v1`).
