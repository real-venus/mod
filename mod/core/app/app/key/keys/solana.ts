import { blake2AsHex } from '@polkadot/util-crypto'
import { hexToU8a, u8aToHex } from '@polkadot/util'
import { ed25519 } from '@noble/curves/ed25519'
import { base58Encode, base58Decode } from '@polkadot/util-crypto'

export interface SolanaWalletType {
  address: string
  crypto_type: 'solana'
  public_key: string
  private_key: string
}

export class Solana {
  /**
   * Converts hex string to Uint8Array
   */
  private static hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      throw new Error(`Invalid hex string: ${hex}`)
    }
    const paddedHex = cleanHex.length % 2 ? '0' + cleanHex : cleanHex
    const bytes = new Uint8Array(paddedHex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(paddedHex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  /**
   * Converts bytes to hex string with 0x prefix
   */
  private static bytesToHex(bytes: Uint8Array): string {
    return '0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Generates an ed25519 keypair from a password, with base58 Solana address.
   */
  static fromPassword(password: string): SolanaWalletType {
    if (!password || typeof password !== 'string') {
      throw new Error('Invalid password provided')
    }

    const seedHex = blake2AsHex(password, 256)
    const seedBytes = this.hexToBytes(seedHex)
    const publicKey = ed25519.getPublicKey(seedBytes)
    const address = base58Encode(publicKey)

    return {
      address,
      crypto_type: 'solana',
      public_key: this.bytesToHex(publicKey),
      private_key: seedHex,
    }
  }

  /**
   * Signs a message using ed25519.
   */
  static sign(message: string, privateKey: string): string {
    if (!message) {
      throw new Error('Empty message cannot be signed')
    }

    const messageBytes = new TextEncoder().encode(message)
    const privateKeyBytes = this.hexToBytes(privateKey)
    const signature = ed25519.sign(messageBytes, privateKeyBytes)
    return this.bytesToHex(signature)
  }

  /**
   * Verifies an ed25519 signature.
   * @param message - The original message.
   * @param signature - The signature in hex format (64 bytes).
   * @param publicKeyOrAddress - The public key (hex) or Solana address (base58).
   */
  static verify(message: string, signature: string, publicKeyOrAddress: string): boolean {
    if (!message || !signature || !publicKeyOrAddress) {
      throw new Error('Invalid verification parameters')
    }

    try {
      const messageBytes = new TextEncoder().encode(message)
      const sigBytes = this.hexToBytes(signature)

      let pubKeyBytes: Uint8Array
      if (publicKeyOrAddress.startsWith('0x')) {
        pubKeyBytes = this.hexToBytes(publicKeyOrAddress)
      } else {
        // Assume base58 Solana address
        pubKeyBytes = base58Decode(publicKeyOrAddress)
      }

      return ed25519.verify(sigBytes, messageBytes, pubKeyBytes)
    } catch (e) {
      console.error('Solana verify error:', e)
      return false
    }
  }
}
