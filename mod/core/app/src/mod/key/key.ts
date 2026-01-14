import { Sr25519 } from './sr25519'
import { Ecdsa } from './ecdsa'

// Define the structure of a key object
export interface WalletType {
  address: string
  crypto_type: 'sr25519' | 'ecdsa'
  public_key: string
  private_key: string
}

// Define allowed signature types
type signature_t = 'sr25519' | 'ecdsa'

export class Key {
  private private_key: string // Stores the private key of the key
  public public_key: string // Stores the public key of the key
  public address: string // Stores the key's address
  public crypto_type: signature_t // Defines the signature type used by the key

  /**
   * Constructs a new Key instance using a password as the seed.
   * @param password - The password used to generate keys.
   * @param crypto_type - The cryptographic algorithm (default: 'sr25519').
   */
  constructor(password: string, crypto_type: signature_t = 'ecdsa') {
    const { public_key, private_key, address } = this.fromPassword(
      password,
      crypto_type
    )
    this.public_key = public_key
    this.private_key = private_key
    this.address = address
    this.crypto_type = crypto_type
  }

  /**
   * Generates a key from a password.
   * @param password - The password used to derive the keypair.
   * @param crypto_type - The cryptographic algorithm (default: 'sr25519').
   * @returns A WalletType object containing address, public_key, and private_key.
   */
  private fromPassword(
    password: string,
    crypto_type: signature_t = 'sr25519'
  ): WalletType {
    if (crypto_type === 'sr25519') {
      return Sr25519.fromPassword(password)
    } else if (crypto_type === 'ecdsa') {
      return Ecdsa.fromPassword(password)
    } else {
      throw new Error('Unsupported crypto type')
    }
  }

  /**
   * Signs a message using the key's private key.
   * @param message - The message to sign.
   * @returns A signature string in hex format.
   */
  public sign(message: string): string {
    if (this.crypto_type === 'sr25519') {
      return Sr25519.sign(message, this.private_key, this.public_key)
    } else if (this.crypto_type === 'ecdsa') {
      return Ecdsa.sign(message, this.private_key)
    } else {
      throw new Error('Unsupported crypto type')
    }
  }

  /**
   * Verifies a signature against a message and public key.
   * @param message - The original message.
   * @param signature - The signature to verify (in hex format).
   * @param public_key - The public key corresponding to the private key used for signing (in hex format).
   * @returns A boolean indicating whether the signature is valid.
   */
  public verify(
    message: string,
    signature: string,
    public_key: string
  ): boolean {
    if (!message || !signature || !public_key) {
      throw new Error('Invalid verification parameters')
    }

    if (this.crypto_type === 'sr25519') {
      return Sr25519.verify(message, signature, public_key)
    } else if (this.crypto_type === 'ecdsa') {
      return Ecdsa.verify(message, signature, public_key)
    } else {
      throw new Error('Unsupported crypto type')
    }
  }

  /**
   * Encodes a string message into a Uint8Array.
   * @param message - The message to encode.
   * @returns A Uint8Array representation of the message.
   */
  encode(message: string): Uint8Array {
    return new TextEncoder().encode(message)
  }

  /**
   * Decodes a Uint8Array back into a string.
   * @param message - The Uint8Array to decode.
   * @returns A string representation of the message.
   */
  decode(message: Uint8Array): string {
    return new TextDecoder().decode(message)
  }
}
