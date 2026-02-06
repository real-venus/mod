import { Eip1193Provider } from 'ethers';

interface PhantomSolana {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toBytes(): Uint8Array; toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  publicKey: { toBytes(): Uint8Array; toString(): string };
}

declare global {
  interface Window {
    solana?: PhantomSolana;
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean;
      request(args: { method: string; params?: any[] }): Promise<any>;
      on(event: string, handler: (...args: any[]) => void): void;
      removeListener(event: string, handler: (...args: any[]) => void): void;
    };
    injectedWeb3?: Record<string, any>;
  }
}

export {};
