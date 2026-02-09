import { WalletConfig, WalletType } from './types'
import { KeyIcon, WalletIcon } from '@heroicons/react/24/outline'

export class WalletRegistry {
  private static wallets: Map<WalletType, WalletConfig> = new Map()
  private static initialized = false

  static register(config: WalletConfig) {
    this.wallets.set(config.type, config)
  }

  static get(type: WalletType): WalletConfig | undefined {
    this.ensureInitialized()
    return this.wallets.get(type)
  }

  static getAll(): WalletConfig[] {
    this.ensureInitialized()
    return Array.from(this.wallets.values())
  }

  private static ensureInitialized() {
    if (this.initialized) return
    this.initialized = true
    this.doInitialize()
  }

  static initialize() {
    if (this.initialized) return
    this.initialized = true
    this.doInitialize()
  }

  private static doInitialize() {
    // Dynamic imports are not needed here since we only store class references,
    // but we lazy-import to avoid pulling in modules that reference `window` at parse time
    const { LocalWalletAdapter } = require('./adapters/LocalWalletAdapter')
    const { SubwalletAdapter } = require('./adapters/SubwalletAdapter')
    const { MetamaskAdapter } = require('./adapters/MetamaskAdapter')
    const { PhantomAdapter } = require('./adapters/PhantomAdapter')

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

// DO NOT initialize at module level - it will be lazily initialized on first access
