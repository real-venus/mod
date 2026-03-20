import { ethers } from 'ethers'
import { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
import { TOKENS, ERC20_ABI } from '@/config/tokens'
import { getProtocol } from '@/config/protocols'

// Morpho Blue on Base
const MORPHO_BLUE = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'

// Known market IDs for Base (supply-only markets)
const MARKETS: Record<string, { id: string; loanToken: string }> = {
  USDC: {
    id: '0xdba352d93a64b17c71104cbddc6aef85cd432322a1446b5b65163cbbc615cd0c',
    loanToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  WETH: {
    id: '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41',
    loanToken: '0x4200000000000000000000000000000000000006',
  },
}

const MORPHO_ABI = [
  'function supply((bytes32 id, address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) external returns (uint256, uint256)',
  'function withdraw((bytes32 id, address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256)',
  'function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
]

// Simplified: use the MetaMorpho vault pattern instead of raw Morpho Blue for better UX
// MetaMorpho vaults on Base
const VAULTS: Record<string, string> = {
  USDC: '0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca', // Gauntlet USDC Prime
  WETH: '0xa0E430870c4604CcfC7B38Ca7845B1FF653D0ff1', // Gauntlet WETH Prime
}

const VAULT_ABI = [
  'function deposit(uint256 assets, address receiver) external returns (uint256 shares)',
  'function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function convertToAssets(uint256 shares) external view returns (uint256)',
]

export const morphoAdapter: ProtocolAdapter = {
  meta: getProtocol('morpho')!,

  async getApprovalTx(token: string, amount: string): Promise<TxRequest | null> {
    const t = TOKENS[token]
    if (!t || token === 'ETH') return null
    const vault = VAULTS[token]
    if (!vault) return null
    const iface = new ethers.Interface(ERC20_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: t.address,
      data: iface.encodeFunctionData('approve', [vault, amountWei]),
    }
  },

  async buildStakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const vault = VAULTS[token]
    if (!vault) throw new Error(`Morpho vault not available for ${token}`)
    const iface = new ethers.Interface(VAULT_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: vault,
      data: iface.encodeFunctionData('deposit', [amountWei, userAddress]),
    }
  },

  async buildUnstakeTx(token: string, amount: string, userAddress: string): Promise<TxRequest> {
    const t = TOKENS[token]
    const vault = VAULTS[token]
    if (!vault) throw new Error(`Morpho vault not available for ${token}`)
    const iface = new ethers.Interface(VAULT_ABI)
    const amountWei = ethers.parseUnits(amount, t.decimals)
    return {
      to: vault,
      data: iface.encodeFunctionData('withdraw', [amountWei, userAddress, userAddress]),
    }
  },

  async getPositions(userAddress: string, provider: ethers.Provider): Promise<ProtocolPosition[]> {
    const positions: ProtocolPosition[] = []
    for (const [symbol, vaultAddr] of Object.entries(VAULTS)) {
      try {
        const vault = new ethers.Contract(vaultAddr, VAULT_ABI, provider)
        const shares: bigint = await vault.balanceOf(userAddress)
        if (shares > BigInt(0)) {
          const assets: bigint = await vault.convertToAssets(shares)
          const t = TOKENS[symbol]
          positions.push({
            protocolId: 'morpho',
            token: symbol,
            amount: ethers.formatUnits(assets, t.decimals),
            amountRaw: assets,
            apy: 0,
            type: 'supply',
          })
        }
      } catch {}
    }
    return positions
  },
}
