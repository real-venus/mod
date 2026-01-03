// Network to KeyType Mapping
// This maps each network to its supported key/crypto types

export type NetworkId = 'test' | 'mainnet' | 'ethereum' | 'solana'
export type KeyType = 'sr25519' | 'ecdsa' | 'ed25519'

export interface NetworkKeyTypeConfig {
  networkId: NetworkId
  supportedKeyTypes: KeyType[]
  recommendedWallet: string
  chainType: 'substrate' | 'evm' | 'solana'
}

export const NETWORK_KEYTYPE_MAP: Record<NetworkId, NetworkKeyTypeConfig> = {
  test: {
    networkId: 'test',
    supportedKeyTypes: ['sr25519', 'ecdsa'],
    recommendedWallet: 'subwallet',
    chainType: 'substrate'
  },
  mainnet: {
    networkId: 'mainnet',
    supportedKeyTypes: ['sr25519', 'ecdsa'],
    recommendedWallet: 'subwallet',
    chainType: 'substrate'
  },
  ethereum: {
    networkId: 'ethereum',
    supportedKeyTypes: ['ecdsa'],
    recommendedWallet: 'metamask',
    chainType: 'evm'
  },
  solana: {
    networkId: 'solana',
    supportedKeyTypes: ['ed25519'],
    recommendedWallet: 'phantom',
    chainType: 'solana'
  }
}

export class NetworkKeyTypeValidator {
  /**
   * Validates if a key type is compatible with a network
   * @param networkId - The network identifier
   * @param keyType - The key/crypto type to validate
   * @returns boolean indicating if the key type is supported
   */
  static isKeyTypeSupported(networkId: NetworkId, keyType: KeyType): boolean {
    const config = NETWORK_KEYTYPE_MAP[networkId]
    if (!config) {
      throw new Error(`Network '${networkId}' not found in configuration`)
    }
    return config.supportedKeyTypes.includes(keyType)
  }

  /**
   * Gets the recommended wallet for a network and key type combination
   * @param networkId - The network identifier
   * @param keyType - The key/crypto type
   * @returns Recommended wallet name or error message
   */
  static getRecommendedWallet(networkId: NetworkId, keyType: KeyType): string {
    const config = NETWORK_KEYTYPE_MAP[networkId]
    if (!config) {
      throw new Error(`Network '${networkId}' not found`)
    }

    if (!this.isKeyTypeSupported(networkId, keyType)) {
      const supportedTypes = config.supportedKeyTypes.join(', ')
      throw new Error(
        `Key type '${keyType}' is not supported on network '${networkId}'. ` +
        `Supported types: ${supportedTypes}. ` +
        `Recommended wallet for this network: ${config.recommendedWallet}`
      )
    }

    return config.recommendedWallet
  }

  /**
   * Gets all supported key types for a network
   * @param networkId - The network identifier
   * @returns Array of supported key types
   */
  static getSupportedKeyTypes(networkId: NetworkId): KeyType[] {
    const config = NETWORK_KEYTYPE_MAP[networkId]
    if (!config) {
      throw new Error(`Network '${networkId}' not found`)
    }
    return config.supportedKeyTypes
  }

  /**
   * Validates and provides recommendation for network/key combination
   * @param networkId - The network identifier
   * @param keyType - The key/crypto type
   * @returns Validation result with recommendation
   */
  static validateAndRecommend(networkId: NetworkId, keyType: KeyType): {
    isValid: boolean
    message: string
    recommendedWallet?: string
    supportedKeyTypes?: KeyType[]
  } {
    const config = NETWORK_KEYTYPE_MAP[networkId]
    
    if (!config) {
      return {
        isValid: false,
        message: `Network '${networkId}' not found in configuration`
      }
    }

    const isSupported = config.supportedKeyTypes.includes(keyType)

    if (isSupported) {
      return {
        isValid: true,
        message: `Key type '${keyType}' is compatible with network '${networkId}'`,
        recommendedWallet: config.recommendedWallet
      }
    } else {
      return {
        isValid: false,
        message: `Key type '${keyType}' is NOT compatible with network '${networkId}'. ` +
                 `Please use one of: ${config.supportedKeyTypes.join(', ')}`,
        recommendedWallet: config.recommendedWallet,
        supportedKeyTypes: config.supportedKeyTypes
      }
    }
  }
}
