"use client";
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

  async signIn(index?:number): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed')
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    let accountAddress: string = accounts[0]
    if (index !== undefined && index >= 0 && index < accounts.length) {
      accountAddress = accounts[index]
    }
    console.log('Connected account:', accountAddress)
    localStorage.setItem('wallet_mode', 'metamask')
    localStorage.setItem('wallet_address', accountAddress)
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

    // Get the specific address the user selected during sign-in
    const selectedAddress = localStorage.getItem('wallet_address')
    if (!selectedAddress) {
      throw new Error('No wallet address found. Please sign in again.')
    }

    // Request the signer for the specific selected address, not just the default active account
    const signer = await this.provider.getSigner(selectedAddress)
    const signerAddress = await signer.getAddress()

    // Verify we got the right signer
    if (signerAddress.toLowerCase() !== selectedAddress.toLowerCase()) {
      throw new Error(
        `MetaMask signer mismatch: expected ${selectedAddress} but got ${signerAddress}. ` +
        `Please switch to the correct account in MetaMask and try again.`
      )
    }

    const signature = await signer.signMessage(message)
    const verified = await this.verify(message, signature, signerAddress)
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
