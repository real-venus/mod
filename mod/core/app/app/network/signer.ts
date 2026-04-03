import { ethers } from 'ethers'
import { blake2AsHex } from '@polkadot/util-crypto'
import modConfig from '@config'

const TESTNET_RPC = (modConfig.chain as any)?.testnet?.url || 'https://sepolia.base.org'

/**
 * Get an ethers Signer for the current wallet mode.
 * - local: derives private key from wallet_password in localStorage, uses JsonRpcProvider
 * - web3/metamask: uses BrowserProvider from window.ethereum
 */
export async function getSigner(userAddress?: string): Promise<ethers.Signer> {
  const walletMode = localStorage.getItem('wallet_mode') || 'local'

  if (walletMode === 'local') {
    const walletPassword = localStorage.getItem('wallet_password')
    if (!walletPassword) throw new Error('No wallet password found. Please sign in again.')
    const privateKey = blake2AsHex(walletPassword, 256)
    const provider = new ethers.JsonRpcProvider(TESTNET_RPC)
    return new ethers.Wallet(privateKey, provider)
  }

  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Ethereum provider found. Please install MetaMask or another wallet.')
  }
  const provider = new ethers.BrowserProvider(window.ethereum)
  return provider.getSigner(userAddress)
}

/**
 * Get a read-only provider (no signing needed).
 */
export function getProvider(): ethers.Provider {
  const walletMode = localStorage.getItem('wallet_mode') || 'local'

  if (walletMode === 'local') {
    return new ethers.JsonRpcProvider(TESTNET_RPC)
  }

  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum)
  }

  return new ethers.JsonRpcProvider(TESTNET_RPC)
}
