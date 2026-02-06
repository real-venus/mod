/**
 * Wallet connection and network management type definitions
 */

export type WalletType = 'metamask' | 'phantom' | 'subwallet' | 'local'
export type NetworkType = 'ethereum' | 'base' | 'solana' | 'polkadot'

export interface ConnectedWallet {
  type: WalletType
  address: string
  chainId: string
  networkType: NetworkType
  balance: string
  balanceFormatted: string
  isActive: boolean
  connectedAt: number
}

export interface NetworkConfig {
  chainId: string
  name: string
  networkType: NetworkType
  rpcUrl: string
  blockExplorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
  icon?: string
}

export interface PendingTransaction {
  hash: string
  type: 'swap' | 'approve' | 'transfer' | 'contract_call' | 'send'
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: number
  fromToken?: string
  toToken?: string
  amount?: string
  amountFormatted?: string
  chainId: string
  blockExplorerUrl?: string
  error?: string
}

export interface WalletError {
  code: string
  message: string
  category: 'user_rejected' | 'network_error' | 'insufficient_funds' | 'unknown'
  originalError?: Error
}

export interface WalletConnectionState {
  isConnecting: boolean
  connectionError: WalletError | null
  lastConnectionAttempt: number
}

export interface NetworkSwitchRequest {
  wallet: WalletType
  targetChainId: string
  targetNetwork: NetworkConfig
}

export interface TokenBalance {
  token: string
  symbol: string
  balance: string
  balanceFormatted: string
  decimals: number
  valueUSD?: number
}
