import { blake2AsHex } from '@polkadot/util-crypto'
import { hexToU8a, u8aToHex, stringToU8a, isHex } from '@polkadot/util'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { WalletType } from '../key'

export class Ecdsa {
  /**
   * Safely converts hex string to Uint8Array
   */
  private static hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    
    // Validate hex string
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      throw new Error(`Invalid hex string: ${hex}`)
    }
    
    // Ensure even length
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
   * Converts an uncompressed public key to an Ethereum canonical address.
   */
  static publicKeyToAddress(publicKey: Uint8Array): string {
    const pubKeyWithoutPrefix = publicKey.length === 65 
      ? publicKey.slice(1) 
      : publicKey
    
    const hash = keccak_256(pubKeyWithoutPrefix)
    const addressBytes = hash.slice(-20)
    
    return this.bytesToHex(addressBytes)
  }

  /**
   * Generates an ECDSA keypair from a password.
   */
  static fromPassword(password: string): WalletType {
    if (!password || typeof password !== 'string') {
      throw new Error('Invalid password provided')
    }

    const seedHex = blake2AsHex(password, 256)
    const seedBytes = this.hexToBytes(seedHex)
    
    const publicKeyUncompressed = secp256k1.getPublicKey(seedBytes, false)
    const publicKeyCompressed = secp256k1.getPublicKey(seedBytes, true)
    const address = this.publicKeyToAddress(publicKeyUncompressed)
    
    return {
      address: address,
      crypto_type: 'ecdsa',
      public_key: this.bytesToHex(publicKeyCompressed),
      private_key: seedHex,
    }
  }

  /**
   * Signs a message using ECDSA.
   */
  static sign(message: string, privateKey: string): string {
    if (!message) {
      throw new Error('Empty message cannot be signed')
    }

    const messageBytes = new TextEncoder().encode(message)
    const messageHash = keccak_256(messageBytes)
    
    const privateKeyBytes = this.hexToBytes(privateKey)
    const sig = secp256k1.sign(messageHash, privateKeyBytes)
    
    // Create 65-byte recoverable signature (r + s + v)
    const compactSig = sig.toCompactRawBytes()
    const recoverableSig = new Uint8Array(65)
    recoverableSig.set(compactSig, 0)
    recoverableSig[64] = sig.recovery
    
    return this.bytesToHex(recoverableSig)
  }

/**
 * Verifies an ECDSA signature by recovering the address.
 * @param message - The original message (string).
 * @param signature - The signature in hex format (65 bytes).
 * @param address - The expected address in hex format.
 * @returns A boolean indicating whether the signature is valid.
 */
static verify(message: string, signature: string, address: string): boolean {
  if (!message || !signature || !address) {
    throw new Error('Invalid verification parameters')
  }

  try {
    const sigBytes = this.hexToBytes(signature)
    
    if (sigBytes.length !== 65) {
      console.error(`Invalid signature length: expected 65, got ${sigBytes.length}`)
      return false
    }

    const compactSig = sigBytes.slice(0, 64)
    const recoveryByte = sigBytes[64]

    const messageBytes = new TextEncoder().encode(message)
    const messageHash = keccak_256(messageBytes)

    const recoveredPubKey = secp256k1.Signature
      .fromCompact(compactSig)
      .addRecoveryBit(recoveryByte)
      .recoverPublicKey(messageHash)

    const recoveredUncompressed = recoveredPubKey.toRawBytes(false)
    const recoveredAddress = this.publicKeyToAddress(recoveredUncompressed)

    return recoveredAddress.toLowerCase() === address.toLowerCase()
  } catch (e) {
    console.error('Verify error:', e)
    return false
  }
}

}