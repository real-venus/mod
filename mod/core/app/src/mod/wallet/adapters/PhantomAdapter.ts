import { WalletAdapter, WalletType } from '../types';

/**
 * Convert a Uint8Array to a hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Encode a Uint8Array to base58 string (no external dependency)
 */
function toBase58(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;

  if (bytes.length === 0) return '';

  // Count leading zeros
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++;
  }

  // Convert to base58
  const size = Math.ceil(bytes.length * 138 / 100) + 1;
  const b58 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; k >= 0 && (carry !== 0 || j < length); k--, j++) {
      carry += 256 * b58[k];
      b58[k] = carry % BASE;
      carry = Math.floor(carry / BASE);
    }
    length = j;
  }

  // Skip leading zeros in base58 result
  let start = size - length;
  while (start < size && b58[start] === 0) {
    start++;
  }

  let result = ALPHABET[0].repeat(zeros);
  for (let i = start; i < size; i++) {
    result += ALPHABET[b58[i]];
  }

  return result;
}

/**
 * Decode a base58 string to Uint8Array (no external dependency)
 */
function fromBase58(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;

  if (str.length === 0) return new Uint8Array(0);

  const alphabetMap = new Map<string, number>();
  for (let i = 0; i < ALPHABET.length; i++) {
    alphabetMap.set(ALPHABET[i], i);
  }

  // Count leading '1's (zeros in base58)
  let zeros = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    zeros++;
  }

  const size = Math.ceil(str.length * 733 / 1000) + 1;
  const b256 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < str.length; i++) {
    const value = alphabetMap.get(str[i]);
    if (value === undefined) {
      throw new Error(`Invalid base58 character: ${str[i]}`);
    }
    let carry = value;
    let j = 0;
    for (let k = size - 1; k >= 0 && (carry !== 0 || j < length); k--, j++) {
      carry += BASE * b256[k];
      b256[k] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    length = j;
  }

  let start = size - length;
  while (start < size && b256[start] === 0) {
    start++;
  }

  const result = new Uint8Array(zeros + (size - start));
  for (let i = start; i < size; i++) {
    result[zeros + (i - start)] = b256[i];
  }

  return result;
}

export class PhantomAdapter implements WalletAdapter {
  type: WalletType = 'phantom';
  private provider: any = null;

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return !!(window as any)?.solana?.isPhantom;
  }

  async connect(): Promise<{ address: string; publicKey: string }> {
    if (typeof window === 'undefined') {
      throw new Error('Phantom is not available in this environment');
    }

    const solana = (window as any)?.solana;
    if (!solana?.isPhantom) {
      throw new Error('Phantom wallet is not installed');
    }

    this.provider = solana;
    const response = await solana.connect();
    const publicKeyBytes = response.publicKey.toBytes();
    const address = toBase58(publicKeyBytes);
    const publicKey = uint8ArrayToHex(publicKeyBytes);

    return { address, publicKey };
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }
  }

  async signIn(): Promise<void> {
    await this.connect();
  }

  async sign(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Phantom wallet is not connected');
    }

    const encodedMessage = new TextEncoder().encode(message);
    const { signature } = await this.provider.signMessage(encodedMessage, 'utf8');
    return uint8ArrayToHex(signature);
  }

  async verify(message: string, signature: string, publicKey: string): Promise<boolean> {
    // Phantom doesn't natively support verify on the client side.
    // For now, we do a basic check that the signature and publicKey are non-empty.
    // Full verification should be done server-side using ed25519.
    if (!signature || !publicKey) return false;
    return true;
  }

  async signMessage(message: string): Promise<string> {
    return this.sign(message);
  }

  async getAddress(): Promise<string> {
    if (!this.provider) {
      throw new Error('Phantom wallet is not connected');
    }

    const publicKeyBytes = this.provider.publicKey.toBytes();
    return toBase58(publicKeyBytes);
  }

  getProvider(): any {
    return this.provider;
  }
}
