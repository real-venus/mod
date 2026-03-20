import { ethers } from 'ethers'
import { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
import { TOKENS, ERC20_ABI } from '@/config/tokens'
import { getProtocol } from '@/config/protocols'

// Compound V3 Comet contracts on Base
const COMETS: Record<string, string> = {
  USDC: '0xb125E6687d4313864e53df431d5425969c15Eb2F',
  WETH: '0x46e6b214b524310239732D51387075E0e70970bf',
}

const COMET_ABI = [
  'function supply(address asset, uint256 amount) external',
  'function withdraw(address asset, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
]

export const compoundV3Adapter: ProtocolAdapter = {
  meta: getProtocol('compound-v3')!,

  async getApprovalTx(token: string, amount: string): Promise<TxRequest | null> {
    const t = TOKENS[token]
    if (!t || token === 'ETH') return null
    const comet = COMETS[token]
    if (!comet) return null
    const iface = new ethers.Interface(ERC20_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: t.address,
      data: iface.encodeFunctionData('approve', [comet, amountWei]),
    }
  },

  async buildStakeTx(token: string, amount: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const comet = COMETS[token]
    if (!comet) throw new Error(`Compound V3 does not support ${token}`)
    const iface = new ethers.Interface(COMET_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: comet,
      data: iface.encodeFunctionData('supply', [t.address, amountWei]),
    }
  },

  async buildUnstakeTx(token: string, amount: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const comet = COMETS[token]
    if (!comet) throw new Error(`Compound V3 does not support ${token}`)
    const iface = new ethers.Interface(COMET_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: comet,
      data: iface.encodeFunctionData('withdraw', [t.address, amountWei]),
    }
  },

  async getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]> {
    const positions: ProtocolPosition[] = []
    for (const [symbol, cometAddr] of Object.entries(COMETS)) {
      try {
        const comet = new ethers.Contract(cometAddr, COMET_ABI, provider)
        const balance: bigint = await comet.balanceOf(userAddress)
        if (balance > BigInt(0)) {
          const t = TOKENS[symbol]
          positions.push({
            protocolId: 'compound-v3',
            token: symbol,
            amount: ethers.formatUnits(balance, t.decimals),
            amountRaw: balance,
            apy: 0,
            type: 'supply',
          })
        }
      } catch {}
    }
    return positions
  },
}
