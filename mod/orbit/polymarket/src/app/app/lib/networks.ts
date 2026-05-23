// EVM network configs for the wallet funding panel. USDC contracts here are
// the canonical bridge/native USDC on each chain (the one most CEX withdrawals
// land in and the one wallets show by default). Polygon uses the bridged USDC.e
// because that's what Polymarket settles in.

export interface NetworkConfig {
  id: string;
  name: string;
  chainId: number;
  chainIdHex: string;
  usdc: string;            // USDC ERC-20 address on this chain (6 decimals)
  rpcUrl: string;          // public RPC for read-only balance lookups
  rpcUrls: string[];       // for wallet_addEthereumChain
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}

export const NETWORKS: NetworkConfig[] = [
  {
    id: "polygon",
    name: "POLYGON",
    chainId: 137,
    chainIdHex: "0x89",
    usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e bridged (Polymarket settlement)
    rpcUrl: "https://polygon-rpc.com",
    rpcUrls: ["https://polygon-rpc.com"],
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  {
    id: "base",
    name: "BASE",
    chainId: 8453,
    chainIdHex: "0x2105",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // native USDC on Base
    rpcUrl: "https://mainnet.base.org",
    rpcUrls: ["https://mainnet.base.org"],
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://basescan.org"],
  },
  {
    id: "ethereum",
    name: "ETHEREUM",
    chainId: 1,
    chainIdHex: "0x1",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // native USDC on mainnet
    rpcUrl: "https://eth.llamarpc.com",
    rpcUrls: ["https://eth.llamarpc.com"],
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://etherscan.io"],
  },
  {
    id: "arbitrum",
    name: "ARBITRUM",
    chainId: 42161,
    chainIdHex: "0xa4b1",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // native USDC
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  {
    id: "optimism",
    name: "OPTIMISM",
    chainId: 10,
    chainIdHex: "0xa",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // native USDC
    rpcUrl: "https://mainnet.optimism.io",
    rpcUrls: ["https://mainnet.optimism.io"],
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
  },
];

export function networkByChainId(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.chainId === chainId);
}

export function networkById(id: string): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.id === id);
}

interface ProviderError {
  code?: number;
  message?: string;
}

/// Switch the wallet to the target network, adding it first if unknown.
/// Throws with a user-readable error if the wallet rejects.
export async function ensureChain(
  ethereum: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  },
  net: NetworkConfig,
): Promise<void> {
  const current = (await ethereum.request({ method: "eth_chainId" })) as string;
  if (parseInt(current, 16) === net.chainId) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: net.chainIdHex }],
    });
  } catch (e: unknown) {
    const code = (e as ProviderError)?.code;
    const message = (e as ProviderError)?.message || "";
    // 4902 = chain not yet added to the wallet.
    if (code === 4902 || /unrecognized chain|not been added/i.test(message)) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: net.chainIdHex,
          chainName: net.name,
          nativeCurrency: net.nativeCurrency,
          rpcUrls: net.rpcUrls,
          blockExplorerUrls: net.blockExplorerUrls,
        }],
      });
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: net.chainIdHex }],
      });
      return;
    }
    if (code === 4001 || /reject|denied|cancel/i.test(message)) {
      throw new Error(`CHAIN SWITCH REJECTED — approve ${net.name} in your wallet`);
    }
    throw new Error(`CHAIN SWITCH FAILED: ${message.slice(0, 200)}`);
  }
}
