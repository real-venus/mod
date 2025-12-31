import { WalletAdapter } from '../types'

export class MetamaskAdapter implements WalletAdapter {
  async connect(): Promise<void> {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed')
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' })
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('wallet_type')
  }

  async signIn(): Promise<void> {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) throw new Error('No accounts found')
    localStorage.setItem('wallet_mode', 'metamask')
    localStorage.setItem('wallet_address', accounts[0])
    localStorage.setItem('wallet_type', 'ethereum')
  }

  async isAvailable(): Promise<boolean> {
    return typeof window.ethereum !== 'undefined'
  }
}
