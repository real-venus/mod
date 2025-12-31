import { WalletAdapter } from '../types'

export class LocalWalletAdapter implements WalletAdapter {
  async connect(): Promise<void> {
    // Local wallet connection logic
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_password')
  }

  async signIn(): Promise<void> {
    const password = localStorage.getItem('wallet_password')
    if (!password) throw new Error('Password required')
    localStorage.setItem('wallet_mode', 'local')
  }

  async isAvailable(): Promise<boolean> {
    return true
  }
}
