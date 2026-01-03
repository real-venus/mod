import { WalletAdapter } from '../types'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { web3Accounts, web3Enable } from '@polkadot/extension-dapp'

export class SubwalletAdapter implements WalletAdapter {
  async connect(): Promise<void> {
    await cryptoWaitReady()
    const extensions = await web3Enable('MOD')
    if (extensions.length === 0) throw new Error('No extension found')
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('wallet_type')
  }

  async signIn(): Promise<void> {
    const address = localStorage.getItem('wallet_address')
    if (!address) throw new Error('No account selected')
    localStorage.setItem('wallet_mode', 'subwallet')
  }

  async isAvailable(): Promise<boolean> {
    const extensions = await web3Enable('MOD')
    return extensions.length > 0
  }

  async getAccounts(): Promise<any[]> {
    return await web3Accounts()
  }
}
