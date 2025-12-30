import { createHash } from 'crypto';
import {Key} from '@/bloc/key';
import { web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import { stringToU8a, u8aToHex } from '@polkadot/util'

export interface AuthData {
  data: string;
  time: string;
  key: string;
  signature: string;
}
export interface AuthHeaders {
  token: string;
}

export class Auth {
  private key: Key;
  private maxAge: number;
  private signatureKeys: string[];

  /**
   * Initialize the Auth class
   * @param key - The key to use for signing
   * @param maxAge - Maximum staleness allowed for timestamps (in seconds)
   * @param signatureKeys - The keys to use for signing
   */
  constructor(
    key: Key | undefined,
    maxAge: number = 3600,
    signatureKeys: string[] = ['data', 'time']
  ) {
    if (!key) {
      throw new Error('Key is required for Auth');
    }
    this.key = key;
    this.maxAge = maxAge;
    this.signatureKeys = signatureKeys;
  }

  /**
   * Generate authentication headers with signature
   * @param data - The data to sign
   * @param key - Optional key override
   * @returns Authentication headers with signature
   */

  public base64urlEncode(data: string | Record<string, unknown> | Uint8Array): string {
    let bytes: Uint8Array;

    if (typeof data === "string") {
      bytes = new TextEncoder().encode(data);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else {
      // dict → compact JSON (separators=(',', ':'))
      const json = JSON.stringify(data);
      bytes = new TextEncoder().encode(json);
    }

    // Convert bytes → base64
    const base64 = Buffer.from(bytes).toString("base64");

    // base64 → base64url (RFC 4648)
    return base64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

public base64urlDecode(data: string): Uint8Array {
  // Restore padding
  const padding = "=".repeat((4 - (data.length % 4)) % 4);

  const base64 = (data + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return new Uint8Array(Buffer.from(base64, "base64"));
}

  public hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  public signatureData(data: any): string {
    let signatureData: Record<string, string> = {};
    this.signatureKeys.forEach(k => {
      if (k in data) {
        signatureData[k] = data[k as keyof typeof data] as string;
      }
    })
    return JSON.stringify(signatureData); // Ensure it's a plain object

  }

  public async signWithInjector(signMessage: string, walletAddress: string): Promise<string> {
          const extensions = await web3Enable('MOD')
          if (extensions.length === 0) {
            throw new Error('No wallet extension found')
          }
          
          const injector = await web3FromAddress(walletAddress)
          if (!injector.signer.signRaw) {
            throw new Error('Wallet does not support signing')
          }
          
          const signRaw = injector.signer.signRaw
          const { signature: sig } = await signRaw({
            address: walletAddress,
            data: u8aToHex(stringToU8a(signMessage)),
            type: 'bytes'
          })
          return sig;
        }
          
  public token(data: any = '', walletAddress?: any): string {

    const authData: AuthData = {
      data: data,
      time: String(this.time()), // Unix timestamp in seconds
      key: walletAddress || this.key.address,
      signature: '',
    };

    // Create signature data object with only the specified keys
    let signatureData: string = this.signatureData(authData);
    if (walletAddress) {
      authData.signature = this.signWithInjector(signatureData, walletAddress) as unknown as string;
    } else {
      authData.signature = this.key.sign(signatureData);
    }
    const verified = this.key.verify( signatureData, authData.signature, authData.key);
    if (!verified) {
      throw new Error('Signature verification failed');
    }
    return this.base64urlEncode(JSON.stringify( authData));
  }

  public generate(data: any, walletAddress?: any): AuthHeaders {
    return {token: this.token(data, walletAddress)};
  }

  public time(): number {
    return Date.now() / 1000; // Returns current timestamp in seconds
  }

  public token2data(token: string): AuthData {
    const decoded = this.base64urlDecode(token);
    const jsonString = new TextDecoder().decode(decoded);
    return JSON.parse(jsonString) as AuthData;
  }

  public verify(headers: AuthHeaders, data?: any): boolean {
    // Check staleness
    const authData = this.token2data(headers.token);

    if (!authData.signature) {
      throw new Error('Missing signature');
    }
    const staleness = Math.abs(this.time() - parseFloat(authData.time));
    if (staleness > this.maxAge) {
      throw new Error(`Token is stale: ${staleness}s > ${this.maxAge}s`);
    }
    
    // Create signature data object for verification
    const signatureData: Record<string, string> = {};
    this.signatureKeys.forEach(k => {
      if (k in headers) {
        signatureData[k] = headers[k as keyof AuthHeaders] as string;
      }
    });

    const signatureDataString = JSON.stringify(signatureData); // Ensure it's a plain object

    let params = {
      message: signatureDataString,
      signature: authData.signature,
      public_key: authData.key,
    };

    let verified = this.key.verify(params.message, params.signature, params.public_key);

    // get boolean value of verified
    verified = Boolean(verified);
    return verified;
  }

  /**
   * Test the authentication flow
   * @param keyName - Name of the test key
   * @returns Test results
   */
  public static async test(
    key: Key,
  ): Promise<{ headers: boolean; verified: boolean }> {
    const data = { fn: 'test', params: { a: 1, b: 2 } };
    const auth = new Auth(key);
    
    // Generate headers
    const headers = auth.generate(data);
    
    // Verify headers without data
    auth.verify(headers);
    
    // Verify headers with data
    const verifiedHeaders = auth.verify(headers);
    
    return { 
      headers: verifiedHeaders,
      verified: true
    };
  }
}

export default Auth;
