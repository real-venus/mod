export interface WalletAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  signIn(): Promise<void>
  isAvailable(): Promise<boolean>
  getAccounts?(): Promise<any[]>
}

export type WalletType = 'local' | 'subwallet' | 'metamask' | 'phantom'

export interface WalletConfig {
  type: WalletType
  name: string
  icon: any
  adapter: new () => WalletAdapter
}
