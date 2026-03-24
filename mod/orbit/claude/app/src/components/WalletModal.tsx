"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getCachedHistory,
  cacheHistory,
  formatAddress,
  formatEth,
  getExplorerUrl,
  getNetworkName,
  getTimeAgo,
  exportToCSV,
  copyToClipboard as utilCopyToClipboard,
  COMMON_TOKENS,
  type Transaction,
} from "../utils/wallet";

// Transaction type imported from utils/wallet.ts

interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
  address?: string;
  usdValue?: string;
}

interface WalletModalProps {
  address: string;
  walletType: "metamask" | "subwallet" | "local" | "password" | null;
  onClose: () => void;
  onDisconnect: () => void;
}

export default function WalletModal({
  address,
  walletType,
  onClose,
  onDisconnect,
}: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "tokens">("overview");
  const [balance, setBalance] = useState<string>("0.00");
  const [network, setNetwork] = useState<string>("Unknown");
  const [chainId, setChainId] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "send" | "receive">("all");
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);

  // Load wallet data
  useEffect(() => {
    loadWalletData();
  }, [address]);

  const loadWalletData = async () => {
    if (address === "local") return;

    // Try to load from cache first
    const cached = getCachedHistory(address);
    if (cached) {
      setTransactions(cached.transactions);
    }

    setLoading(true);
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(ethereum);

      // Get balance
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));

      // Get network info
      const net = await provider.getNetwork();
      setNetwork(net.name || `Chain ${net.chainId}`);
      setChainId(Number(net.chainId));

      // Load transaction history
      await loadTransactionHistory(provider);

      // Load token balances
      await loadTokenBalances(provider);
    } catch (e) {
      console.error("Failed to load wallet data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionHistory = async (provider: ethers.BrowserProvider) => {
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks

      // Get sent transactions
      const sentFilter = {
        fromBlock,
        toBlock: currentBlock,
        address: null,
        topics: null,
      };

      const txs: Transaction[] = [];

      // Note: For production, you'd want to use an indexer API like Etherscan or Alchemy
      // For now, we'll show a simpler approach with recent blocks
      const blockPromises = [];
      const blocksToCheck = 50; // Check last 50 blocks for demo

      for (let i = 0; i < blocksToCheck; i++) {
        blockPromises.push(provider.getBlock(currentBlock - i, true));
      }

      const blocks = await Promise.all(blockPromises);

      for (const block of blocks) {
        if (!block || !block.transactions) continue;

        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue;

          const txData = tx as any;
          const isFromUser = txData.from?.toLowerCase() === address.toLowerCase();
          const isToUser = txData.to?.toLowerCase() === address.toLowerCase();

          if (isFromUser || isToUser) {
            const receipt = await provider.getTransactionReceipt(txData.hash);

            txs.push({
              hash: txData.hash,
              from: txData.from,
              to: txData.to || null,
              value: ethers.formatEther(txData.value || "0"),
              timestamp: block.timestamp,
              blockNumber: block.number,
              status: receipt?.status === 1 ? "success" : "failed",
              gasUsed: receipt?.gasUsed?.toString(),
              gasPrice: txData.gasPrice?.toString(),
              type: isFromUser ? "send" : "receive",
            });
          }
        }
      }

      // Sort by timestamp descending
      txs.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(txs);

      // Cache the results
      cacheHistory(address, txs);
    } catch (e) {
      console.error("Failed to load transaction history:", e);
    }
  };

  const loadTokenBalances = async (provider: ethers.BrowserProvider) => {
    try {
      const tokensToCheck = COMMON_TOKENS[chainId] || [];
      const balances: TokenBalance[] = [];

      const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
      ];

      for (const token of tokensToCheck) {
        try {
          const contract = new ethers.Contract(token.address, erc20Abi, provider);
          const balance = await contract.balanceOf(address);
          const formattedBalance = ethers.formatUnits(balance, token.decimals);

          if (parseFloat(formattedBalance) > 0) {
            balances.push({
              symbol: token.symbol,
              balance: formattedBalance,
              decimals: token.decimals,
              address: token.address,
            });
          }
        } catch (e) {
          // Token doesn't exist on this network or other error
          console.log(`Failed to load ${token.symbol}:`, e);
        }
      }

      setTokens(balances);
    } catch (e) {
      console.error("Failed to load token balances:", e);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (txFilter === "all") return true;
    return tx.type === txFilter;
  });

  const handleCopy = async (text: string) => {
    await utilCopyToClipboard(text);
  };

  const handleExport = () => {
    exportToCSV(transactions, address);
  };

  const getSeedPhrase = () => {
    if (walletType === "local") {
      return localStorage.getItem("claude_jobs_seed") || "No seed phrase found";
    }
    return "Not available for this wallet type";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div
        className="border-2 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--crt-blue)",
          boxShadow: "0 0 40px rgba(0,170,255,0.3)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2" style={{ borderColor: "var(--crt-blue)" }}>
          <div className="flex items-center gap-3">
            <span className="text-[14px]" style={{ color: "var(--crt-blue)" }}>💎</span>
            <h2 className="text-[11px]" style={{ color: "var(--crt-blue)", letterSpacing: "2px" }}>
              WALLET MANAGER
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[11px] hover:text-crt-red transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {(["overview", "transactions", "tokens"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 px-4 py-3 text-[9px] transition-all"
              style={{
                color: activeTab === tab ? "var(--crt-blue)" : "var(--text-tertiary)",
                background: activeTab === tab ? "rgba(0,170,255,0.1)" : "transparent",
                borderBottom: activeTab === tab ? "2px solid var(--crt-blue)" : "2px solid transparent",
                letterSpacing: "1px",
              }}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8">
              <p className="text-[9px] animate-pulse" style={{ color: "var(--crt-blue)" }}>
                LOADING WALLET DATA...
              </p>
            </div>
          )}

          {/* Overview Tab */}
          {!loading && activeTab === "overview" && (
            <div className="space-y-4">
              {/* Wallet Info */}
              <div className="border p-4 space-y-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between items-center">
                  <span className="text-[7px]" style={{ color: "var(--text-tertiary)" }}>ADDRESS:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono" style={{ color: "var(--text-primary)" }}>
                      {address}
                    </span>
                    <button
                      onClick={() => handleCopy(address)}
                      className="text-[7px] px-2 py-1 border hover:border-crt-blue transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.2)" }}
                    >
                      COPY
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[7px]" style={{ color: "var(--text-tertiary)" }}>NETWORK:</span>
                  <span className="text-[8px]" style={{ color: "var(--crt-amber)" }}>
                    {network} (Chain ID: {chainId})
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[7px]" style={{ color: "var(--text-tertiary)" }}>WALLET TYPE:</span>
                  <span className="text-[8px]" style={{ color: "var(--crt-green)" }}>
                    {walletType?.toUpperCase()}
                  </span>
                </div>

                {walletType === "local" && (
                  <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                      className="text-[7px] text-crt-amber hover:text-crt-amber/80 transition-colors"
                    >
                      {showSeedPhrase ? "HIDE SEED PHRASE" : "SHOW SEED PHRASE"}
                    </button>
                    {showSeedPhrase && (
                      <div className="mt-2 p-3 border-2 border-crt-red/50" style={{ background: "rgba(255,51,51,0.05)" }}>
                        <div className="text-[6px] text-crt-red mb-2">⚠ KEEP THIS SECRET ⚠</div>
                        <div className="text-[7px] font-mono break-all" style={{ color: "var(--text-primary)" }}>
                          {getSeedPhrase()}
                        </div>
                        <button
                          onClick={() => handleCopy(getSeedPhrase())}
                          className="text-[7px] mt-2 px-2 py-1 border border-crt-red/50 hover:border-crt-red transition-colors"
                        >
                          COPY
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="border p-4 space-y-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="text-[7px] mb-3" style={{ color: "var(--text-tertiary)" }}>ACTIONS</div>
                <button
                  onClick={loadWalletData}
                  className="pixel-btn w-full text-[8px] py-2"
                >
                  REFRESH DATA
                </button>
                <button
                  onClick={onDisconnect}
                  className="pixel-btn pixel-btn-red w-full text-[8px] py-2"
                >
                  DISCONNECT WALLET
                </button>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {!loading && activeTab === "transactions" && (
            <div className="space-y-4">
              {/* Filter & Export */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(["all", "send", "receive"] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setTxFilter(filter)}
                      className={`text-[7px] px-3 py-1 border transition-colors ${
                        txFilter === filter
                          ? "border-crt-blue text-crt-blue"
                          : "border-crt-green/20 text-crt-green/50"
                      }`}
                    >
                      {filter.toUpperCase()}
                    </button>
                  ))}
                </div>
                {transactions.length > 0 && (
                  <button
                    onClick={handleExport}
                    className="text-[7px] px-3 py-1 border hover:border-crt-amber transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.2)", color: "var(--crt-amber)" }}
                  >
                    EXPORT CSV
                  </button>
                )}
              </div>

              {/* Transaction List */}
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[9px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                    {transactions.length === 0 ? "No transactions found" : "No transactions match filter"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTransactions.map(tx => (
                    <div
                      key={tx.hash}
                      className="border p-3 hover:border-crt-blue/50 transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{
                            color: tx.type === "send" ? "var(--crt-red)" : "var(--crt-green)"
                          }}>
                            {tx.type === "send" ? "↑" : "↓"}
                          </span>
                          <span className="text-[8px]" style={{ color: "var(--text-primary)" }}>
                            {tx.type === "send" ? "SENT" : "RECEIVED"}
                          </span>
                          <span
                            className={`text-[7px] px-2 py-0.5 border ${
                              tx.status === "success"
                                ? "border-crt-green/30 text-crt-green"
                                : "border-crt-red/30 text-crt-red"
                            }`}
                          >
                            {tx.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold" style={{ color: "var(--crt-blue)" }}>
                          {parseFloat(tx.value).toFixed(6)} ETH
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[7px]">
                          <span style={{ color: "var(--text-tertiary)" }}>HASH:</span>
                          <button
                            onClick={() => handleCopy(tx.hash)}
                            className="font-mono hover:text-crt-blue transition-colors"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {tx.hash.slice(0, 16)}...{tx.hash.slice(-8)}
                          </button>
                        </div>

                        <div className="flex justify-between text-[7px]">
                          <span style={{ color: "var(--text-tertiary)" }}>
                            {tx.type === "send" ? "TO:" : "FROM:"}
                          </span>
                          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
                            {(tx.type === "send" ? tx.to : tx.from)?.slice(0, 12)}...
                            {(tx.type === "send" ? tx.to : tx.from)?.slice(-6)}
                          </span>
                        </div>

                        <div className="flex justify-between text-[7px]">
                          <span style={{ color: "var(--text-tertiary)" }}>TIME:</span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {new Date(tx.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tokens Tab */}
          {!loading && activeTab === "tokens" && (
            <div className="space-y-4">
              {/* ERC20 Tokens */}
              {tokens.length > 0 ? (
                <div className="space-y-2">
                  {tokens.map(token => (
                    <div
                      key={token.address}
                      className="border p-4 hover:border-crt-green/50 transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[12px]">●</span>
                          <div>
                            <div className="text-[9px]" style={{ color: "var(--crt-green)" }}>
                              {token.symbol}
                            </div>
                            <div className="text-[7px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                              {token.address?.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>
                            {parseFloat(token.balance).toFixed(4)}
                          </div>
                          {token.usdValue && (
                            <div className="text-[7px]" style={{ color: "var(--text-tertiary)" }}>
                              ${token.usdValue}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[9px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                    No ERC20 tokens found
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="text-[6px] text-center" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
            WALLET MANAGER v1.0 • POWERED BY ETHERS.JS
          </div>
        </div>
      </div>
    </div>
  );
}
