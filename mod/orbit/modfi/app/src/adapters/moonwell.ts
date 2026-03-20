import { ethers } from 'ethers'
import { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
import { TOKENS, ERC20_ABI } from '@/config/tokens'
import { getProtocol } from '@/config/protocols'

// Moonwell mToken addresses on Base
const MTOKENS: Record<string, string> = {
  USDC: '0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22',
  WETH: '0x628ff693426583D9a7FB391E54366292F509D457',
  cbETH: '0x3bf93770f2d4a0F4138d349C1E4913Cfe1FA04Df',
}

const MTOKEN_ABI = [
  'function mint(uint256 mintAmount) external returns (uint256)',
  'function redeem(uint256 redeemTokens) external returns (uint256)',
  'function redeemUnderlying(uint256 redeemAmount) external returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function balanceOfUnderlying(address owner) external returns (uint256)',
  'function exchangeRateStored() external view returns (uint256)',
]

export const moonwellAdapter: ProtocolAdapter = {
  meta: getProtocol('moonwell')!,

  async getApprovalTx(token: string, amount: string): Promise<TxRequest | null> {
    const t = TOKENS[token]
    if (!t || token === 'ETH') return null
    const mToken = MTOKENS[token]
    if (!mToken) return null
    const iface = new ethers.Interface(ERC20_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: t.address,
      data: iface.encodeFunctionData('approve', [mToken, amountWei]),
    }
  },

  async buildStakeTx(token: string, amount: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const mToken = MTOKENS[token]
    if (!mToken) throw new Error(`Moonwell does not support ${token}`)
    const iface = new ethers.Interface(MTOKEN_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: mToken,
      data: iface.encodeFunctionData('mint', [amountWei]),
    }
  },

  async buildUnstakeTx(token: string, amount: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const mToken = MTOKENS[token]
    if (!mToken) throw new Error(`Moonwell does not support ${token}`)
    const iface = new ethers.Interface(MTOKEN_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: mToken,
      data: iface.encodeFunctionData('redeemUnderlying', [amountWei]),
    }
  },

  async getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]> {
    const positions: ProtocolPosition[] = []
    for (const [symbol, mTokenAddr] of Object.entries(MTOKENS)) {
      try {
        const mToken = new ethers.Contract(mTokenAddr, MTOKEN_ABI, provider)
        const balance: bigint = await mToken.balanceOf(userAddress)
        if (balance > BigInt(0)) {
          const exchangeRate: bigint = await mToken.exchangeRateStored()
          const t = TOKENS[symbol]
          // underlying = mTokenBalance * exchangeRate / 1e18
          const underlying = (balance * exchangeRate) / ethers.parseEther('1')
          positions.push({
            protocolId: 'moonwell',
            token: symbol,
            amount: ethers.formatUnits(underlying, t.decimals),
            amountRaw: underlying,
            apy: 0,
            type: 'supply',
          })
        }
      } catch {}
    }
    return positions
  },
}
