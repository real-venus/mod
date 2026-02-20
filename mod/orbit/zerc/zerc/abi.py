"""ABI definitions for ZERC20 contract interaction."""

ZERC_TOKEN_ABI = [
    # transfer(address to, bytes32 encryptedAmount, bytes inputProof)
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "encryptedAmount", "type": "bytes32"},
            {"name": "inputProof", "type": "bytes"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # approve(address spender, bytes32 encryptedAmount, bytes inputProof)
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "encryptedAmount", "type": "bytes32"},
            {"name": "inputProof", "type": "bytes"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # transferFrom(address from, address to, bytes32 encryptedAmount, bytes inputProof)
    {
        "inputs": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "encryptedAmount", "type": "bytes32"},
            {"name": "inputProof", "type": "bytes"},
        ],
        "name": "transferFrom",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # balanceOf(address) → bytes32 (euint64 handle)
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
    # allowance(address owner, address spender) → bytes32
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
    # totalSupply() → uint64
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint64"}],
        "stateMutability": "view",
        "type": "function",
    },
    # name() → string
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    # symbol() → string
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    # decimals() → uint8
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    # mint(address to, uint64 amount) — owner only
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint64"},
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # burn(uint64 amount)
    {
        "inputs": [{"name": "amount", "type": "uint64"}],
        "name": "burn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # owner() → address
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    # Transfer event
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "transferId", "type": "uint256"},
        ],
        "name": "Transfer",
        "type": "event",
    },
    # Approval event
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "owner", "type": "address"},
            {"indexed": True, "name": "spender", "type": "address"},
            {"indexed": False, "name": "placeholder", "type": "uint256"},
        ],
        "name": "Approval",
        "type": "event",
    },
]
