import { WalletAdapter } from '../types'

export class PhantomAdapter implements WalletAdapter {
  async connect(): Promise<void> {
    if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
      throw new Error('Phantom wallet is not installed')
    }
    await window.solana.connect()
  }

  async disconnect(): Promise<void> {
    if (window.solana?.isPhantom) {
      await window.solana.disconnect()
    }
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('wallet_type')
  }

  async signIn(): Promise<void> {
    if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
      throw new Error('Phantom wallet is not installed')
    }
    
    const response = await window.solana.connect()
    if (!response.publicKey) throw new Error('Failed to connect')
    
    const address = response.publicKey.toString()
    localStorage.setItem('wallet_mode', 'phantom')
    localStorage.setItem('wallet_address', address)
    localStorage.setItem('wallet_type', 'solana')
  }

  async isAvailable(): Promise<boolean> {
    return typeof window.solana !== 'undefined' && window.solana.isPhantom
  }
}
