import { ethers } from 'ethers'
import { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
import { TOKENS, ERC20_ABI } from '@/config/tokens'
import { getProtocol } from '@/config/protocols'

// Extra Finance lending pool on Base
const LENDING_POOL = '0xBB505c54D71E9e599cB8435b4F0cEEc05fC71cbD'

const LENDING_ABI = [
  'function deposit(uint256 reserveId, uint256 amount, address onBehalfOf) external',
  'function withdraw(uint256 reserveId, uint256 amount, address to) external',
]

const ETOKEN_ABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function exchangeRateStored() external view returns (uint256)',
]

// Reserve IDs on Extra Finance Base
const RESERVES: Record<string, { id: number; eToken: string }> = {
  USDC: { id: 1, eToken: '0x7fF45460C07d5e1a5F40E3793cdFe885C924D8E1' },
  WETH: { id: 2, eToken: '0x5D8B0e05d1E009Cb4aa7e4e7189FD471E3520B61' },
}

export const extraFinanceAdapter: ProtocolAdapter = {
  meta: getProtocol('extra-finance')!,

  async getApprovalTx(token: string, amount: string): Promise<TxRequest | null> {
    const t = TOKENS[token]
    if (!t || token === 'ETH') return null
    const iface = new ethers.Interface(ERC20_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: t.address,
      data: iface.encodeFunctionData('approve', [LENDING_POOL, amountWei]),
    }
  },

  async buildStakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const reserve = RESERVES[token]
    if (!reserve) throw new Error(`Extra Finance does not support ${token}`)
    const iface = new ethers.Interface(LENDING_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: LENDING_POOL,
      data: iface.encodeFunctionData('deposit', [reserve.id, amountWei, userAddress]),
    }
  },

  async buildUnstakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const reserve = RESERVES[token]
    if (!reserve) throw new Error(`Extra Finance does not support ${token}`)
    const iface = new ethers.Interface(LENDING_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: LENDING_POOL,
      data: iface.encodeFunctionData('withdraw', [reserve.id, amountWei, userAddress]),
    }
  },

  async getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]> {
    const positions: ProtocolPosition[] = []
    for (const [symbol, reserve] of Object.entries(RESERVES)) {
      try {
        const eToken = new ethers.Contract(reserve.eToken, ETOKEN_ABI, provider)
        const balance: bigint = await eToken.balanceOf(userAddress)
        if (balance > BigInt(0)) {
          const t = TOKENS[symbol]
          positions.push({
            protocolId: 'extra-finance',
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
