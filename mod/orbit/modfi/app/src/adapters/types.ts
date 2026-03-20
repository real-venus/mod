import { ethers } from 'ethers'
import { ProtocolMeta } from '@/config/protocols'

export interface ProtocolPosition {
  protocolId: string
  token: string
  amount: string
  amountRaw: bigint
  apy: number
  type: 'supply' | 'lp' | 'stake'
}

export interface TxRequest {
  to: string
  data: string
  value?: bigint
}

export interface ProtocolAdapter {
  meta: ProtocolMeta

  /** Build ERC20 approval tx if needed, null if already approved or native token */
  getApprovalTx(token: string, amount: string, userAddress: string): Promise<TxRequest | null>

  /** Build the stake/supply/deposit transaction */
  buildStakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest>

  /** Build the unstake/withdraw transaction */
  buildUnstakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest>

  /** Get user's positions in this protocol (on-chain reads) */
  getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]>
}
