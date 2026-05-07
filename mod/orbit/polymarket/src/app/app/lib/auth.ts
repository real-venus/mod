import { ClobCredentials } from "./types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

const CLOB_BASE = "https://clob.polymarket.com";

export function detectWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address || "---";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  if (!window.ethereum) {
    throw new Error("NO WALLET DETECTED");
  }

  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("NO ACCOUNTS FOUND");
  }

  const chainIdHex = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;

  return {
    address: accounts[0],
    chainId: parseInt(chainIdHex, 16),
  };
}

// EIP-712 domain and types for Polymarket CLOB API key derivation
const DERIVE_DOMAIN = {
  name: "ClobAuthDomain",
  version: "1",
  chainId: 137,
};

const DERIVE_TYPES = {
  ClobAuth: [
    { name: "address", type: "address" },
    { name: "timestamp", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "message", type: "string" },
  ],
};

export async function deriveClobApiKey(address: string): Promise<ClobCredentials> {
  if (!window.ethereum) throw new Error("NO WALLET");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = 0;

  const message = {
    address,
    timestamp,
    nonce,
    message: "This message attests that I control the given wallet",
  };

  const msgParams = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      ...DERIVE_TYPES,
    },
    primaryType: "ClobAuth",
    domain: DERIVE_DOMAIN,
    message,
  });

  const signature = (await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [address, msgParams],
  })) as string;

  // Derive API key from CLOB
  const res = await fetch(`${CLOB_BASE}/auth/derive-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      timestamp,
      nonce,
      message: message.message,
      signature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DERIVE FAILED: ${err}`);
  }

  const data = await res.json();
  return {
    apiKey: data.apiKey,
    secret: data.secret,
    passphrase: data.passphrase,
  };
}

export async function createClobApiKey(address: string): Promise<ClobCredentials> {
  if (!window.ethereum) throw new Error("NO WALLET");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = 0;

  const message = {
    address,
    timestamp,
    nonce,
    message: "This message attests that I control the given wallet",
  };

  const msgParams = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      ...DERIVE_TYPES,
    },
    primaryType: "ClobAuth",
    domain: DERIVE_DOMAIN,
    message,
  });

  const signature = (await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [address, msgParams],
  })) as string;

  const res = await fetch(`${CLOB_BASE}/auth/api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      timestamp,
      nonce,
      message: message.message,
      signature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CREATE KEY FAILED: ${err}`);
  }

  const data = await res.json();
  return {
    apiKey: data.apiKey,
    secret: data.secret,
    passphrase: data.passphrase,
  };
}
