import { WalletAdapter } from '../types'
import { ethers } from 'ethers'

export class MetamaskAdapter implements WalletAdapter {
  private provider: any = null

  async connect(): Promise<void> {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed')
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' })
    this.provider = new ethers.BrowserProvider(window.ethereum)
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('wallet_type')
    this.provider = null
  }

  async signIn(): Promise<void> {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) throw new Error('No accounts found')
    localStorage.setItem('wallet_mode', 'metamask')
    localStorage.setItem('wallet_address', accounts[0])
    localStorage.setItem('wallet_type', 'ethereum')
    this.provider = new ethers.BrowserProvider(window.ethereum)
  }

  async isAvailable(): Promise<boolean> {
    return typeof window.ethereum !== 'undefined'
  }

  async sign(message: string): Promise<string> {
    if (!this.provider) {
      await this.connect()
    }
    const signer = await this.provider.getSigner()

    // assert verify the signature

    const signature = await signer.signMessage(message)
    const verified = await this.verify(message, signature, await signer.getAddress())
    if (!verified) {
      throw new Error('Signature verification failed')
    }

    return signature
  }

  async verify(message: string, signature: string, publicKey: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature)
      return recoveredAddress.toLowerCase() === publicKey.toLowerCase()
    } catch (error) {
      return false
    }
  }
}
