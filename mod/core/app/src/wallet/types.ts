export interface WalletAdapter {
  connect(): Promise<void | { address: string; publicKey: string }>
  disconnect(): Promise<void>
  signIn(): Promise<void>
  isAvailable(): Promise<boolean>
  getAccounts?(): Promise<any[]>
  sign(message: string): Promise<string>
  verify(message: string, signature: string, publicKey: string): Promise<boolean>
}

export type WalletType = 'local' | 'subwallet' | 'metamask' | 'phantom'

export interface WalletConfig {
  type: WalletType
  name: string
  icon: any
  adapter: new () => WalletAdapter
}
