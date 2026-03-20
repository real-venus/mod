export interface TokenConfig {
  symbol: string
  name: string
  address: string
  decimals: number
  icon: string
}

export const TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    icon: '/tokens/usdc.svg',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    icon: '/tokens/usdt.svg',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    icon: '/tokens/weth.svg',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ether',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    icon: '/tokens/eth.svg',
  },
  cbETH: {
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    decimals: 18,
    icon: '/tokens/cbeth.svg',
  },
}

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
]
