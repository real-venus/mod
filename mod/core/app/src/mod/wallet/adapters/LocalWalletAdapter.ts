import { WalletAdapter } from '../types'
import { Key } from '@/mod/key'

export class LocalWalletAdapter implements WalletAdapter {
  private keyInstance: Key | null = null

  async connect(): Promise<void> {
    // Local wallet connection logic
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_password')
    this.keyInstance = null
  }

  async signIn(): Promise<void> {
    const password = localStorage.getItem('wallet_password')
    if (!password) throw new Error('Password required')
    this.keyInstance = new Key(password, 'ecdsa')
    localStorage.setItem('wallet_mode', 'local')
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async sign(message: string): Promise<string> {
    if (!this.keyInstance) {
      const password = localStorage.getItem('wallet_password')
      if (!password) throw new Error('Wallet not initialized')
      this.keyInstance = new Key(password, 'ecdsa')
    }
    return this.keyInstance.sign(message)
  }

  async verify(message: string, signature: string, publicKey: string): Promise<boolean> {
    if (!this.keyInstance) {
      const password = localStorage.getItem('wallet_password')
      if (!password) throw new Error('Wallet not initialized')
      this.keyInstance = new Key(password, 'ecdsa')
    }
    return this.keyInstance.verify(message, signature, publicKey)
  }
}
