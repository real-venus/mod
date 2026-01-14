import {
  blake2AsHex,
  sr25519PairFromSeed,
  encodeAddress,
  decodeAddress,
  sr25519Sign,
  sr25519Verify,
} from '@polkadot/util-crypto'
import { hexToU8a, u8aToHex } from '@polkadot/util'
import { WalletType } from './key'

export class Sr25519 {
  /**
   * Generates an SR25519 keypair from a password.
   * @param password - The password used to derive the keypair.
   * @returns A WalletType object containing address, public_key, and private_key.
   */
  static fromPassword(password: string): WalletType {
    if (!password || typeof password !== 'string') {
      throw new Error('Invalid password provided')
    }

    const seedHex = blake2AsHex(password, 256)
    const seedBytes = hexToU8a(seedHex)
    const keyPair = sr25519PairFromSeed(seedBytes)
    const address = encodeAddress(keyPair.publicKey, 42)

    return {
      address,
      crypto_type: 'sr25519',
      public_key: u8aToHex(keyPair.publicKey),
      private_key: u8aToHex(keyPair.secretKey),
    }
  }

  /**
   * Signs a message using SR25519.
   * @param message - The message to sign.
   * @param private_key - The private key in hex format.
   * @param public_key - The public key in hex format.
   * @returns A signature string in hex format.
   */
  static sign(message: string, private_key: string, public_key: string): string {
    if (!message) {
      throw new Error('Empty message cannot be signed')
    }

    const messageBytes = new TextEncoder().encode(message)
    const signature = sr25519Sign(messageBytes, {
      publicKey: hexToU8a(public_key),
      secretKey: hexToU8a(private_key),
    })
    return u8aToHex(signature)
  }

  /**
   * Verifies an SR25519 signature.
   * @param message - The original message.
   * @param signature - The signature to verify (in hex format).
   * @param public_key - The public key (in hex or SS58 format).
   * @returns A boolean indicating whether the signature is valid.
   */
  static verify(message: string, signature: string, public_key: string): boolean {
    if (!message || !signature || !public_key) {
      throw new Error('Invalid verification parameters')
    }

    const messageBytes = new TextEncoder().encode(message)
    const resolvedPublicKey = this.resolvePublicKey(public_key)

    return sr25519Verify(
      messageBytes,
      hexToU8a(signature),
      hexToU8a(resolvedPublicKey)
    )
  }

  /**
   * Resolves a public key from SS58 or hex format to hex.
   * @param public_key - The public key to resolve.
   * @returns The public key in hex format.
   */
  private static resolvePublicKey(public_key: string): string {
    if ((public_key.startsWith('5') || public_key.startsWith('H')) && public_key.length === 48) {
      const publicKeyBytes = decodeAddress(public_key, false, 42)
      return u8aToHex(publicKeyBytes)
    } else if (public_key.startsWith('0x')) {
      return public_key
    } else {
      throw new Error('Invalid public key format')
    }
  }
}
