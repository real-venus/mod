import { WalletConfig, WalletType } from './types'
import { LocalWalletAdapter, SubwalletAdapter, MetamaskAdapter, PhantomAdapter } from './adapters'
import { KeyIcon, WalletIcon } from '@heroicons/react/24/outline'

export class WalletRegistry {
  private static wallets: Map<WalletType, WalletConfig> = new Map()

  static register(config: WalletConfig) {
    this.wallets.set(config.type, config)
  }

  static get(type: WalletType): WalletConfig | undefined {
    return this.wallets.get(type)
  }

  static getAll(): WalletConfig[] {
    return Array.from(this.wallets.values())
  }

  static initialize() {
    this.register({
      type: 'local',
      name: 'LOCAL',
      icon: KeyIcon,
      adapter: LocalWalletAdapter
    })

    this.register({
      type: 'subwallet',
      name: 'SUBWALLET',
      icon: WalletIcon,
      adapter: SubwalletAdapter
    })

    this.register({
      type: 'metamask',
      name: 'METAMASK',
      icon: WalletIcon,
      adapter: MetamaskAdapter
    })

    this.register({
      type: 'phantom',
      name: 'PHANTOM',
      icon: WalletIcon,
      adapter: PhantomAdapter
    })
  }
}

// Initialize on module load
WalletRegistry.initialize()
