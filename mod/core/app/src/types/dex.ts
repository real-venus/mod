/**
 * DEX-related type definitions for Uniswap and Raydium integrations
 */

export interface TokenPrice {
  address: string
  symbol: string
  name: string
  decimals: number
  price: number
  priceUSD: number
  change24h: number
  volume24h: number
  liquidity: number
  lastUpdated: number
  chain: 'ethereum' | 'base' | 'solana'
}

export interface PoolData {
  address: string
  dex: 'uniswap' | 'raydium'
  token0: Token
  token1: Token
  liquidity: string
  liquidityUSD: number
  volume24h: string
  volume24hUSD: number
  fee: number
  apr?: number
  tvl?: number
}

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  chain: 'ethereum' | 'base' | 'solana'
}

export interface SwapParams {
  fromToken: string
  toToken: string
  amount: string
  slippage: number
  recipient: string
  chain: 'ethereum' | 'base' | 'solana'
}

export interface SwapQuote {
  inputAmount: string
  outputAmount: string
  priceImpact: number
  fee: string
  route: string[]
  estimatedGas?: string
}

export interface SwapState {
  isSwapping: boolean
  swapError: string | null
  estimatedOutput: string | null
  priceImpact: number
  route: string[]
}

export type Chain = 'ethereum' | 'base' | 'solana'
export type DEXType = 'uniswap' | 'raydium'

export interface PriceCacheEntry {
  price: TokenPrice
  timestamp: number
  ttl: number
}

export interface PoolCacheEntry {
  pool: PoolData
  timestamp: number
  ttl: number
}
