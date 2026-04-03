import { ethers } from 'ethers'
import { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
import { TOKENS, ERC20_ABI } from '@/config/tokens'
import { getProtocol } from '@/config/protocols'

const AAVE_POOL = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'

const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
]

const ATOKEN_ABI = ['function balanceOf(address) external view returns (uint256)']

// aToken addresses on Base for each underlying
const ATOKENS: Record<string, string> = {
  USDC: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
  WETH: '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7',
  cbETH: '0xcf3D55c10DB69f28fD1A75Bd73f3D8A2d9c595ad',
}

export const aaveV3Adapter: ProtocolAdapter = {
  meta: getProtocol('aave-v3')!,

  async getApprovalTx(token: string, amount: string): Promise<TxRequest | null> {
    const t = TOKENS[token]
    if (!t || token === 'ETH') return null
    const iface = new ethers.Interface(ERC20_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: t.address,
      data: iface.encodeFunctionData('approve', [AAVE_POOL, amountWei]),
    }
  },

  async buildStakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const iface = new ethers.Interface(POOL_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: AAVE_POOL,
      data: iface.encodeFunctionData('supply', [t.address, amountWei, userAddress, 0]),
    }
  },

  async buildUnstakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const iface = new ethers.Interface(POOL_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: AAVE_POOL,
      data: iface.encodeFunctionData('withdraw', [t.address, amountWei, userAddress]),
    }
  },

  async getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]> {
    const positions: ProtocolPosition[] = []
    for (const [symbol, aTokenAddr] of Object.entries(ATOKENS)) {
      try {
        const aToken = new ethers.Contract(aTokenAddr, ATOKEN_ABI, provider)
        const balance: bigint = await aToken.balanceOf(userAddress)
        if (balance > BigInt(0)) {
          const t = TOKENS[symbol]
          positions.push({
            protocolId: 'aave-v3',
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
