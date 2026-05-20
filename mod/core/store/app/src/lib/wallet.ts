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

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
}

export async function connectMetaMask(): Promise<{ address: string; chainId: number }> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: parseInt(chainIdHex, 16) };
}

export async function personalSign(message: string, address: string): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  return (await window.ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
}

export function buildSiweMessage(opts: {
  domain: string;
  address: string;
  origin: string;
  nonce: string;
  chainId: number;
  statement?: string;
}): string {
  const issuedAt = new Date().toISOString();
  const statement = opts.statement || "Sign in to mod store.";
  return [
    `${opts.domain} wants you to sign in with your Ethereum account:`,
    opts.address,
    "",
    statement,
    "",
    `URI: ${opts.origin}`,
    `Version: 1`,
    `Chain ID: ${opts.chainId}`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
