export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ProtocolCategory = 'lending' | 'dex' | 'yield' | 'leverage'

export interface ProtocolMeta {
  id: string
  name: string
  description: string
  url: string
  riskLevel: RiskLevel
  riskFactors: string[]
  supportedTokens: string[]
  defiLlamaSlug: string
  chain: string
  category: ProtocolCategory
}

export const PROTOCOLS: ProtocolMeta[] = [
  {
    id: 'aave-v3',
    name: 'Aave V3',
    description: 'Blue-chip lending. Supply tokens to earn interest with battle-tested security.',
    url: 'https://app.aave.com',
    riskLevel: 'LOW',
    riskFactors: ['Battle-tested since 2020', '20+ security audits', 'TVL > $10B across chains', 'Governance token'],
    supportedTokens: ['USDC', 'USDT', 'WETH', 'cbETH'],
    defiLlamaSlug: 'aave-v3',
    chain: 'Base',
    category: 'lending',
  },
  {
    id: 'compound-v3',
    name: 'Compound V3',
    description: 'Isolated lending markets. Single-asset pools with clear risk boundaries.',
    url: 'https://app.compound.finance',
    riskLevel: 'LOW',
    riskFactors: ['Pioneer of DeFi lending', 'Formally verified', 'TVL > $2B', 'Isolated market design'],
    supportedTokens: ['USDC', 'WETH'],
    defiLlamaSlug: 'compound-v3',
    chain: 'Base',
    category: 'lending',
  },
  {
    id: 'moonwell',
    name: 'Moonwell',
    description: 'Base-native lending with competitive rates and WELL token rewards.',
    url: 'https://moonwell.fi',
    riskLevel: 'MEDIUM',
    riskFactors: ['Audited by Halborn', 'Base-native', 'TVL > $200M', 'Fork of Compound'],
    supportedTokens: ['USDC', 'WETH', 'cbETH'],
    defiLlamaSlug: 'moonwell',
    chain: 'Base',
    category: 'lending',
  },
  {
    id: 'morpho',
    name: 'Morpho',
    description: 'Peer-to-peer lending optimization. Better rates through direct matching.',
    url: 'https://app.morpho.org',
    riskLevel: 'MEDIUM',
    riskFactors: ['Audited by Spearbit', 'Novel P2P matching engine', 'TVL > $1B', 'Backed by a16z'],
    supportedTokens: ['USDC', 'WETH'],
    defiLlamaSlug: 'morpho',
    chain: 'Base',
    category: 'lending',
  },
  {
    id: 'extra-finance',
    name: 'Extra Finance',
    description: 'Leveraged yield farming. Higher returns with amplified risk exposure.',
    url: 'https://app.extrafi.io',
    riskLevel: 'HIGH',
    riskFactors: ['Leverage amplifies losses', 'Newer protocol', 'Liquidation risk', 'Smart contract risk'],
    supportedTokens: ['USDC', 'WETH'],
    defiLlamaSlug: 'extra-finance',
    chain: 'Base',
    category: 'leverage',
  },
  {
    id: 'aerodrome',
    name: 'Aerodrome',
    description: 'Top DEX on Base. Provide liquidity to earn fees + AERO rewards.',
    url: 'https://aerodrome.finance',
    riskLevel: 'MEDIUM',
    riskFactors: ['Largest DEX on Base', 'Impermanent loss risk', 'Multiple audits', 'TVL > $500M'],
    supportedTokens: ['USDC', 'WETH'],
    defiLlamaSlug: 'aerodrome-v2',
    chain: 'Base',
    category: 'dex',
  },
]

export function getProtocol(id: string): ProtocolMeta | undefined {
  return PROTOCOLS.find(p => p.id === id)
}
