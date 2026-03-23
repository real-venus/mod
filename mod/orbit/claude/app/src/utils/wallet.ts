import { ethers } from "ethers";

export interface WalletHistory {
  transactions: Transaction[];
  lastFetched: number;
  address: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number;
  blockNumber: number;
  status: "success" | "failed" | "pending";
  gasUsed?: string;
  gasPrice?: string;
  type?: "send" | "receive" | "contract";
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "claude_wallet_history";

/**
 * Get cached wallet history from localStorage
 */
export function getCachedHistory(address: string): WalletHistory | null {
  try {
    const cached = localStorage.getItem(`${STORAGE_KEY}_${address.toLowerCase()}`);
    if (!cached) return null;

    const data: WalletHistory = JSON.parse(cached);

    // Check if cache is still valid
    if (Date.now() - data.lastFetched > CACHE_DURATION) {
      return null;
    }

    return data;
  } catch (e) {
    console.error("Failed to get cached history:", e);
    return null;
  }
}

/**
 * Save wallet history to localStorage
 */
export function cacheHistory(address: string, transactions: Transaction[]): void {
  try {
    const data: WalletHistory = {
      transactions,
      lastFetched: Date.now(),
      address: address.toLowerCase(),
    };
    localStorage.setItem(`${STORAGE_KEY}_${address.toLowerCase()}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to cache history:", e);
  }
}

/**
 * Clear cached history for an address
 */
export function clearCachedHistory(address: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${address.toLowerCase()}`);
  } catch (e) {
    console.error("Failed to clear cache:", e);
  }
}

/**
 * Format address to short version (0x1234...5678)
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return "";
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format ETH value with proper decimals
 */
export function formatEth(value: string | bigint, decimals = 4): string {
  try {
    const formatted = typeof value === "string" ? value : ethers.formatEther(value);
    return parseFloat(formatted).toFixed(decimals);
  } catch (e) {
    return "0.0000";
  }
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(chainId: number, hash: string, type: "tx" | "address" = "tx"): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    5: "https://goerli.etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    8453: "https://basescan.org",
    84532: "https://sepolia.basescan.org",
    137: "https://polygonscan.com",
    80001: "https://mumbai.polygonscan.com",
  };

  const baseUrl = explorers[chainId] || "https://etherscan.io";
  return `${baseUrl}/${type}/${hash}`;
}

/**
 * Get network name from chain ID
 */
export function getNetworkName(chainId: number): string {
  const networks: Record<number, string> = {
    1: "Ethereum Mainnet",
    5: "Goerli Testnet",
    11155111: "Sepolia Testnet",
    8453: "Base Mainnet",
    84532: "Base Sepolia",
    137: "Polygon Mainnet",
    80001: "Mumbai Testnet",
    42161: "Arbitrum One",
    421614: "Arbitrum Sepolia",
    10: "Optimism Mainnet",
    420: "Optimism Goerli",
  };

  return networks[chainId] || `Unknown Network (${chainId})`;
}

/**
 * Get gas cost in ETH
 */
export function calculateGasCost(gasUsed?: string, gasPrice?: string): string {
  if (!gasUsed || !gasPrice) return "0";

  try {
    const cost = BigInt(gasUsed) * BigInt(gasPrice);
    return ethers.formatEther(cost);
  } catch (e) {
    return "0";
  }
}

/**
 * Check if address is valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch (e) {
    return false;
  }
}

/**
 * Get time ago string
 */
export function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Export transactions to CSV
 */
export function exportToCSV(transactions: Transaction[], address: string): void {
  const headers = ["Hash", "From", "To", "Value (ETH)", "Type", "Status", "Block", "Timestamp", "Gas Used", "Gas Price"];

  const rows = transactions.map(tx => [
    tx.hash,
    tx.from,
    tx.to || "",
    tx.value,
    tx.type || "unknown",
    tx.status,
    tx.blockNumber.toString(),
    new Date(tx.timestamp * 1000).toISOString(),
    tx.gasUsed || "",
    tx.gasPrice || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${formatAddress(address)}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export transactions to JSON
 */
export function exportToJSON(transactions: Transaction[], address: string): void {
  const data = {
    address,
    exportedAt: new Date().toISOString(),
    transactionCount: transactions.length,
    transactions,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${formatAddress(address)}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("Failed to copy to clipboard:", e);
    return false;
  }
}

/**
 * Get token balance with proper decimals
 */
export async function getTokenBalance(
  provider: ethers.BrowserProvider,
  tokenAddress: string,
  walletAddress: string,
  decimals: number = 18
): Promise<string> {
  try {
    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const balance = await contract.balanceOf(walletAddress);
    return ethers.formatUnits(balance, decimals);
  } catch (e) {
    console.error("Failed to get token balance:", e);
    return "0";
  }
}

/**
 * Common token addresses by chain
 */
export const COMMON_TOKENS: Record<number, Array<{
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}>> = {
  1: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, name: "USD Coin" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6, name: "Tether USD" },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, name: "Wrapped BTC" },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
  ],
  8453: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, name: "USD Coin" },
  ],
  84532: [
    { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", symbol: "USDC", decimals: 6, name: "USD Coin" },
  ],
  137: [
    { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", decimals: 6, name: "USD Coin" },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6, name: "Tether USD" },
  ],
};
