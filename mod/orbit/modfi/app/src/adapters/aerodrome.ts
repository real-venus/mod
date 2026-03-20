import { ethers } from 'ethers'
import { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
import { TOKENS, ERC20_ABI } from '@/config/tokens'
import { getProtocol } from '@/config/protocols'

// Aerodrome Router on Base
const ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'

// Aerodrome gauge contracts for staking LP tokens
const POOLS: Record<string, { pool: string; gauge: string; token0: string; token1: string }> = {
  'USDC-WETH': {
    pool: '0xcDAC0d6c6C59727a65F871236188350531885C43',
    gauge: '0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025',
    token0: 'USDC',
    token1: 'WETH',
  },
}

const ROUTER_ABI = [
  'function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, bool stable, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB)',
]

const GAUGE_ABI = [
  'function deposit(uint256 amount) external',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address) external view returns (uint256)',
]

const LP_ABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function getReserves() external view returns (uint256, uint256, uint256)',
]

export const aerodromeAdapter: ProtocolAdapter = {
  meta: getProtocol('aerodrome')!,

  async getApprovalTx(token: string, amount: string): Promise<TxRequest | null> {
    // For Aerodrome, approve both tokens to the router
    const t = TOKENS[token]
    if (!t || token === 'ETH') return null
    const iface = new ethers.Interface(ERC20_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: t.address,
      data: iface.encodeFunctionData('approve', [ROUTER, amountWei]),
    }
  },

  async buildStakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    // For simplicity, stake = deposit LP tokens into gauge
    // Users would need LP tokens first (from addLiquidity)
    const pool = POOLS['USDC-WETH']
    if (!pool) throw new Error('Pool not found')
    const iface = new ethers.Interface(GAUGE_ABI)
    const amountWei = ethers.parseUnits(amount, 18) // LP tokens are 18 decimals
    return {
      to: pool.gauge,
      data: iface.encodeFunctionData('deposit', [amountWei]),
    }
  },

  async buildUnstakeTx(token: string, amount: string): Promise<TxRequest> {
    const pool = POOLS['USDC-WETH']
    if (!pool) throw new Error('Pool not found')
    const iface = new ethers.Interface(GAUGE_ABI)
    const amountWei = ethers.parseUnits(amount, 18)
    return {
      to: pool.gauge,
      data: iface.encodeFunctionData('withdraw', [amountWei]),
    }
  },

  async getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]> {
    const positions: ProtocolPosition[] = []
    for (const [name, pool] of Object.entries(POOLS)) {
      try {
        // Check gauge balance (staked LP)
        const gauge = new ethers.Contract(pool.gauge, GAUGE_ABI, provider)
        const staked: bigint = await gauge.balanceOf(userAddress)

        // Check unstaked LP balance
        const lp = new ethers.Contract(pool.pool, LP_ABI, provider)
        const unstaked: bigint = await lp.balanceOf(userAddress)

        const total = staked + unstaked
        if (total > BigInt(0)) {
          positions.push({
            protocolId: 'aerodrome',
            token: name,
            amount: ethers.formatUnits(total, 18),
            amountRaw: total,
            apy: 0,
            type: 'lp',
          })
        }
      } catch {}
    }
    return positions
  },
}
