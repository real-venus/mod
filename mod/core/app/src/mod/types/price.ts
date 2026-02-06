/**
 * Price prediction and technical analysis type definitions
 */

export interface PricePoint {
  timestamp: number
  price: number
  volume?: number
  high?: number
  low?: number
  open?: number
  close?: number
}

export interface PricePrediction {
  token: string
  tokenSymbol: string
  currentPrice: number
  predictedPrice: number
  priceChange: number
  priceChangePercent: number
  direction: 'up' | 'down' | 'neutral'
  confidence: number // 0-100
  timeframe: string // '1H', '4H', '1D', '1W'
  algorithm: PredictionAlgorithm
  indicators: PriceIndicators
  signal: 'buy' | 'sell' | 'hold'
  generatedAt: number
}

export interface PriceIndicators {
  sma7: number
  sma30: number
  ema7?: number
  ema30?: number
  rsi: number
  momentum: number
  volatility: number
  macd?: {
    value: number
    signal: number
    histogram: number
  }
  bollingerBands?: {
    upper: number
    middle: number
    lower: number
  }
}

export type PredictionAlgorithm =
  | 'simple_ma'
  | 'exponential_ma'
  | 'momentum'
  | 'combined'
  | 'rsi_based'

export type Timeframe = '1H' | '4H' | '1D' | '1W' | '1M' | '3M' | '1Y'

export interface HistoricalPriceData {
  token: string
  timeframe: Timeframe
  data: PricePoint[]
  fetchedAt: number
}

export interface PriceDataSource {
  id: string
  name: string
  type: 'dex' | 'oracle' | 'api'
  chain?: 'ethereum' | 'base' | 'solana'
  reliability: number // 0-100
}

export interface OraclePrice {
  token: string
  price: number
  decimals: number
  timestamp: number
  source: 'chainlink' | 'pyth' | 'manual'
  roundId?: string
  confidence?: number
}

export interface PriceComparison {
  token: string
  dexPrice: number
  oraclePrice: number
  difference: number
  differencePercent: number
  arbitrageOpportunity: boolean
}
