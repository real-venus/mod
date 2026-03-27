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
  getNativeSymbol,
  getTimeAgo,
  exportToCSV,
  copyToClipboard as utilCopyToClipboard,
  switchNetwork,
  EVM_NETWORKS,
  NETWORK_LOGOS,
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
  inline?: boolean;
  isOwner?: boolean;
  ownerAddress?: string | null;
  onNetworkChange?: () => void;
}

export default function WalletModal({
  address,
  walletType,
  onClose,
  onDisconnect,
  inline = false,
  isOwner = false,
  ownerAddress = null,
  onNetworkChange,
}: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "tokens">("overview");
  const [balance, setBalance] = useState<string>("0.00");
  const [network, setNetwork] = useState<string>("Unknown");
  const [chainId, setChainId] = useState<number>(0);
  const [nativeSymbol, setNativeSymbol] = useState<string>("ETH");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "send" | "receive">("all");
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [showTestnets, setShowTestnets] = useState(false);

  // Load wallet data
  useEffect(() => {
    loadWalletData();

    // Listen for network changes from wallet
    const ethereum = (window as any).ethereum;
    if (ethereum?.on) {
      const handleChainChanged = () => loadWalletData();
      ethereum.on("chainChanged", handleChainChanged);
      return () => ethereum.removeListener("chainChanged", handleChainChanged);
    }
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
      const cid = Number(net.chainId);
      setChainId(cid);
      setNetwork(getNetworkName(cid));
      setNativeSymbol(getNativeSymbol(cid));
      const currentNet = EVM_NETWORKS.find(n => n.chainId === cid);
      if (currentNet) setShowTestnets(currentNet.testnet);

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
      const fromBlock = Math.max(0, currentBlock - 10000);

      const txs: Transaction[] = [];

      const blockPromises = [];
      const blocksToCheck = 50;

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

      txs.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(txs);
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

  const handleCopy = async (text: string, label?: string) => {
    await utilCopyToClipboard(text);
    setCopied(label || text);
    setTimeout(() => setCopied(null), 1500);
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

  const handleSwitchNetwork = async (targetChainId: number) => {
    if (targetChainId === chainId) {
      setShowNetworkSelector(false);
      return;
    }
    setSwitchingNetwork(true);
    const ok = await switchNetwork(targetChainId);
    setSwitchingNetwork(false);
    setShowNetworkSelector(false);
    if (ok) {
      loadWalletData();
      onNetworkChange?.();
    }
  };

  const walletIcon = walletType === "metamask" ? "🦊" : walletType === "subwallet" ? "◆" : walletType === "password" ? "🔑" : "💾";

  const tabColors: Record<string, string> = {
    overview: "var(--crt-blue)",
    transactions: "var(--crt-amber)",
    tokens: "var(--crt-green)",
  };

  const content = (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header: Balance + Address + Copy + Close */}
      {!inline && (
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{
            borderBottom: "1px solid rgba(0,170,255,0.12)",
            background: "linear-gradient(180deg, rgba(0,170,255,0.06) 0%, transparent 100%)",
          }}
        >
          {/* Left: balance */}
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[28px] font-bold font-mono tabular-nums"
              style={{
                color: "var(--crt-green)",
                textShadow: "0 0 30px rgba(51,255,51,0.2), 0 0 8px rgba(51,255,51,0.1)",
                letterSpacing: "-1px",
              }}
            >
              {parseFloat(balance).toFixed(4)}
            </span>
            <span className="text-[11px] font-bold" style={{ color: "var(--crt-green)", opacity: 0.4 }}>
              {nativeSymbol}
            </span>
          </div>

          {/* Right: address copy + close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(address, "address")}
              className="flex items-center gap-2 px-3 py-2 transition-all"
              style={{
                border: copied === "address" ? "1px solid var(--crt-green)" : "1px solid rgba(255,255,255,0.08)",
                background: copied === "address" ? "rgba(51,255,51,0.08)" : "transparent",
                borderRadius: "2px",
              }}
              onMouseEnter={(e) => {
                if (copied !== "address") {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,170,255,0.3)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,170,255,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (copied !== "address") {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
              title={copied === "address" ? "Copied!" : `Copy: ${address}`}
            >
              <span className="text-[11px] font-bold font-mono" style={{ color: copied === "address" ? "var(--crt-green)" : "var(--crt-amber)", letterSpacing: "0.5px" }}>
                {copied === "address" ? "COPIED" : `${address?.slice(0, 6)}··${address?.slice(-4)}`}
              </span>
              <svg className="w-3.5 h-3.5" style={{ color: copied === "address" ? "var(--crt-green)" : "var(--text-tertiary)", opacity: copied === "address" ? 1 : 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {copied === "address" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[12px] transition-all"
              style={{
                color: "var(--text-tertiary)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "2px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,51,51,0.4)";
                (e.currentTarget as HTMLElement).style.color = "var(--crt-red)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,51,51,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex shrink-0 px-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {(["overview", "transactions", "tokens"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-4 py-3 text-[10px] transition-all relative"
            style={{
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
              letterSpacing: "2px",
              opacity: activeTab === tab ? 1 : 0.5,
            }}
          >
            {tab.toUpperCase()}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-4 right-4 h-[2px]"
                style={{
                  background: tabColors[tab],
                  boxShadow: `0 0 8px ${tabColors[tab]}`,
                  borderRadius: "1px",
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3">
              <span className="w-2 h-2 rounded-full led-pulse" style={{ background: "var(--crt-blue)", boxShadow: "0 0 8px var(--crt-blue)" }} />
              <p className="text-[11px] tracking-[2px]" style={{ color: "var(--crt-blue)" }}>
                LOADING WALLET DATA
              </p>
              <span className="w-2 h-2 rounded-full led-pulse" style={{ background: "var(--crt-blue)", boxShadow: "0 0 8px var(--crt-blue)" }} />
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {!loading && activeTab === "overview" && (
          <div className="space-y-4">
            {/* Address Card */}
            <div
              className="p-4 space-y-3"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.015)",
                borderRadius: "3px",
              }}
            >
              <div className="text-[9px] flex items-center gap-2 tracking-[2px]" style={{ color: "var(--text-tertiary)" }}>
                <span style={{ color: "var(--crt-blue)", fontSize: "6px" }}>&#9632;</span> ADDRESS
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 px-3 py-2.5 font-mono text-[11px] overflow-hidden text-ellipsis"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    color: "var(--text-primary)",
                    letterSpacing: "0.3px",
                    borderRadius: "2px",
                  }}
                >
                  {address}
                </div>
                <button
                  onClick={() => handleCopy(address, "address")}
                  className="shrink-0 px-3 py-2.5 text-[9px] transition-all tracking-wider"
                  style={{
                    border: copied === "address" ? "1px solid var(--crt-green)" : "1px solid rgba(255,255,255,0.08)",
                    color: copied === "address" ? "var(--crt-green)" : "var(--text-tertiary)",
                    background: copied === "address" ? "rgba(51,255,51,0.08)" : "transparent",
                    borderRadius: "2px",
                  }}
                >
                  {copied === "address" ? "COPIED" : "COPY"}
                </button>
              </div>
            </div>

            {/* Network & Type Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                className="p-4 transition-all text-left w-full"
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.015)",
                  borderRadius: "3px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,176,0,0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              >
                <div className="text-[9px] mb-2.5 tracking-[2px] flex items-center justify-between" style={{ color: "var(--text-tertiary)" }}>
                  <span>NETWORK</span>
                  <span className="text-[8px]" style={{ color: "var(--crt-amber)" }}>SWITCH ▾</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-[22px] h-[22px] flex items-center justify-center shrink-0"
                    style={{ color: NETWORK_LOGOS[chainId]?.color || "var(--crt-amber)" }}
                    dangerouslySetInnerHTML={{
                      __html: `<svg viewBox="0 0 24 24" width="22" height="22">${NETWORK_LOGOS[chainId]?.svg || '<circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.3"/>'}</svg>`
                    }}
                  />
                  <div className="text-[14px] font-bold" style={{ color: "var(--crt-amber)" }}>{network}</div>
                </div>
                <div className="text-[10px] mt-1.5 font-mono" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>Chain ID: {chainId}</div>
              </button>
              <div
                className="p-4 transition-all"
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.015)",
                  borderRadius: "3px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(51,255,51,0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              >
                <div className="text-[9px] mb-2.5 tracking-[2px]" style={{ color: "var(--text-tertiary)" }}>WALLET TYPE</div>
                <div className="text-[14px] font-bold" style={{ color: "var(--crt-green)" }}>{walletType?.toUpperCase()}</div>
                <div className="text-[10px] mt-1.5" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>{walletIcon} Connected</div>
              </div>
            </div>

            {/* Inline Network Selector */}
            {showNetworkSelector && (
              <div
                className="p-4 space-y-3"
                style={{
                  border: "1px solid rgba(255,176,0,0.15)",
                  background: "rgba(255,176,0,0.02)",
                  borderRadius: "3px",
                }}
              >
                <div className="text-[9px] tracking-[2px] flex items-center justify-between" style={{ color: "var(--text-tertiary)" }}>
                  <span>SELECT NETWORK</span>
                  <button
                    onClick={() => setShowNetworkSelector(false)}
                    className="text-[9px] px-2 py-0.5 transition-all"
                    style={{ color: "var(--crt-amber)", border: "1px solid rgba(255,176,0,0.15)", borderRadius: "2px" }}
                  >
                    CLOSE
                  </button>
                </div>

                {/* Mainnet / Testnet Toggle */}
                <div className="flex" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                  <button
                    onClick={() => setShowTestnets(false)}
                    className="flex-1 py-2 text-[9px] tracking-[2px] transition-all"
                    style={{
                      color: !showTestnets ? "var(--crt-amber)" : "var(--text-tertiary)",
                      background: !showTestnets ? "rgba(255,176,0,0.1)" : "transparent",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      fontWeight: !showTestnets ? "bold" : "normal",
                      opacity: !showTestnets ? 1 : 0.5,
                    }}
                  >
                    MAINNET
                  </button>
                  <button
                    onClick={() => setShowTestnets(true)}
                    className="flex-1 py-2 text-[9px] tracking-[2px] transition-all"
                    style={{
                      color: showTestnets ? "var(--crt-amber)" : "var(--text-tertiary)",
                      background: showTestnets ? "rgba(255,176,0,0.1)" : "transparent",
                      fontWeight: showTestnets ? "bold" : "normal",
                      opacity: showTestnets ? 1 : 0.5,
                    }}
                  >
                    TESTNET
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {EVM_NETWORKS.filter(n => n.testnet === showTestnets).map(n => (
                    <button
                      key={n.chainId}
                      onClick={() => handleSwitchNetwork(n.chainId)}
                      disabled={switchingNetwork}
                      className="p-3 text-center transition-all flex flex-col items-center gap-2"
                      style={{
                        border: n.chainId === chainId ? `1px solid ${NETWORK_LOGOS[n.chainId]?.color || "rgba(255,176,0,0.3)"}40` : "1px solid rgba(255,255,255,0.06)",
                        background: n.chainId === chainId ? `${NETWORK_LOGOS[n.chainId]?.color || "rgba(255,176,0,"}10` : "rgba(0,0,0,0.15)",
                        borderRadius: "4px",
                        opacity: switchingNetwork ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (n.chainId !== chainId) {
                          e.currentTarget.style.borderColor = `${NETWORK_LOGOS[n.chainId]?.color || "#ffb000"}40`;
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (n.chainId !== chainId) {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                          e.currentTarget.style.background = "rgba(0,0,0,0.15)";
                        }
                      }}
                    >
                      <span
                        className="w-[28px] h-[28px] flex items-center justify-center"
                        style={{ color: NETWORK_LOGOS[n.chainId]?.color || "#888" }}
                        dangerouslySetInnerHTML={{
                          __html: `<svg viewBox="0 0 24 24" width="28" height="28">${NETWORK_LOGOS[n.chainId]?.svg || '<circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.3"/>'}</svg>`
                        }}
                      />
                      <div className="text-[10px] font-bold tracking-wide" style={{ color: n.chainId === chainId ? NETWORK_LOGOS[n.chainId]?.color || "var(--crt-amber)" : "var(--text-secondary)" }}>
                        {n.name}
                      </div>
                      <div className="text-[8px] font-mono" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>{n.symbol}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seed Phrase */}
            {walletType === "local" && (
              <div
                className="p-4"
                style={{
                  border: "1px solid rgba(255,176,0,0.12)",
                  background: "rgba(255,176,0,0.02)",
                  borderRadius: "3px",
                }}
              >
                <button
                  onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                  className="flex items-center gap-2 text-[10px] transition-all w-full tracking-wider"
                  style={{ color: "var(--crt-amber)" }}
                >
                  <span style={{ fontSize: "12px", transition: "transform 0.15s" }}>
                    {showSeedPhrase ? "▾" : "▸"}
                  </span>
                  {showSeedPhrase ? "HIDE SEED PHRASE" : "SHOW SEED PHRASE"}
                </button>
                {showSeedPhrase && (
                  <div className="mt-3 space-y-3">
                    <div
                      className="px-3 py-2 text-[10px] tracking-wider"
                      style={{
                        background: "rgba(255,51,51,0.06)",
                        border: "1px solid rgba(255,51,51,0.2)",
                        color: "var(--crt-red)",
                        borderRadius: "2px",
                      }}
                    >
                      KEEP THIS SECRET — NEVER SHARE
                    </div>
                    <div
                      className="p-3 font-mono text-[11px] break-all leading-relaxed"
                      style={{
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,51,51,0.1)",
                        color: "var(--text-primary)",
                        borderRadius: "2px",
                      }}
                    >
                      {getSeedPhrase()}
                    </div>
                    <button
                      onClick={() => handleCopy(getSeedPhrase(), "seed")}
                      className="text-[9px] px-3 py-1.5 transition-all tracking-wider"
                      style={{
                        border: copied === "seed" ? "1px solid var(--crt-green)" : "1px solid rgba(255,51,51,0.25)",
                        color: copied === "seed" ? "var(--crt-green)" : "var(--crt-red)",
                        borderRadius: "2px",
                      }}
                    >
                      {copied === "seed" ? "COPIED" : "COPY SEED"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={loadWalletData}
                className="flex-1 py-3 text-[10px] transition-all tracking-[1.5px]"
                style={{
                  background: "var(--crt-blue)",
                  color: "#000",
                  fontWeight: "bold",
                  borderRadius: "2px",
                  boxShadow: "0 2px 12px rgba(0,170,255,0.2)",
                  border: "none",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 20px rgba(0,170,255,0.35)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,170,255,0.2)"; }}
              >
                REFRESH
              </button>
              <button
                onClick={onDisconnect}
                className="flex-1 py-3 text-[10px] transition-all tracking-[1.5px]"
                style={{
                  background: "transparent",
                  color: "var(--crt-red)",
                  border: "1px solid rgba(255,51,51,0.25)",
                  fontWeight: "bold",
                  borderRadius: "2px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,51,51,0.1)";
                  e.currentTarget.style.borderColor = "rgba(255,51,51,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,51,51,0.25)";
                }}
              >
                DISCONNECT
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
                    className="text-[9px] px-3 py-1.5 transition-all tracking-wider"
                    style={{
                      border: txFilter === filter ? "1px solid var(--crt-blue)" : "1px solid rgba(255,255,255,0.06)",
                      color: txFilter === filter ? "var(--crt-blue)" : "var(--text-tertiary)",
                      background: txFilter === filter ? "rgba(0,170,255,0.08)" : "transparent",
                      borderRadius: "2px",
                    }}
                  >
                    {filter.toUpperCase()}
                  </button>
                ))}
              </div>
              {transactions.length > 0 && (
                <button
                  onClick={handleExport}
                  className="text-[9px] px-3 py-1.5 transition-all tracking-wider"
                  style={{
                    border: "1px solid rgba(255,176,0,0.15)",
                    color: "var(--crt-amber)",
                    borderRadius: "2px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,176,0,0.35)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,176,0,0.15)"; }}
                >
                  EXPORT CSV
                </button>
              )}
            </div>

            {/* Transaction List */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-[32px] mb-4" style={{ opacity: 0.08 }}>&#9744;</div>
                <p className="text-[10px] tracking-[2px]" style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>
                  {transactions.length === 0 ? "NO TRANSACTIONS FOUND" : "NO TRANSACTIONS MATCH FILTER"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map(tx => (
                  <div
                    key={tx.hash}
                    className="p-4 transition-all"
                    style={{
                      border: "1px solid rgba(255,255,255,0.05)",
                      background: "rgba(255,255,255,0.015)",
                      borderRadius: "3px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = tx.type === "send" ? "rgba(255,51,51,0.15)" : "rgba(51,255,51,0.15)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.015)";
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-8 h-8 flex items-center justify-center text-[13px] font-bold"
                          style={{
                            background: tx.type === "send" ? "rgba(255,51,51,0.08)" : "rgba(51,255,51,0.08)",
                            border: `1px solid ${tx.type === "send" ? "rgba(255,51,51,0.2)" : "rgba(51,255,51,0.2)"}`,
                            color: tx.type === "send" ? "var(--crt-red)" : "var(--crt-green)",
                            borderRadius: "2px",
                          }}
                        >
                          {tx.type === "send" ? "↑" : "↓"}
                        </span>
                        <div>
                          <div className="text-[11px] font-bold tracking-wider" style={{ color: "var(--text-primary)" }}>
                            {tx.type === "send" ? "SENT" : "RECEIVED"}
                          </div>
                          <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
                            {new Date(tx.timestamp * 1000).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-bold font-mono tabular-nums" style={{ color: "var(--crt-blue)" }}>
                          {parseFloat(tx.value).toFixed(6)}
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: "var(--crt-blue)", opacity: 0.45 }}>ETH</div>
                      </div>
                    </div>

                    <div
                      className="space-y-1.5 pt-3"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="flex justify-between text-[9px]">
                        <span className="tracking-wider" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>HASH</span>
                        <button
                          onClick={() => handleCopy(tx.hash)}
                          className="font-mono transition-colors"
                          style={{ color: "var(--text-secondary)", opacity: 0.7 }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--crt-blue)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                        >
                          {tx.hash.slice(0, 16)}...{tx.hash.slice(-8)}
                        </button>
                      </div>

                      <div className="flex justify-between text-[9px]">
                        <span className="tracking-wider" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
                          {tx.type === "send" ? "TO" : "FROM"}
                        </span>
                        <span className="font-mono" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                          {(tx.type === "send" ? tx.to : tx.from)?.slice(0, 12)}...
                          {(tx.type === "send" ? tx.to : tx.from)?.slice(-6)}
                        </span>
                      </div>

                      <div className="flex justify-between text-[9px] items-center">
                        <span className="tracking-wider" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>STATUS</span>
                        <span
                          className="px-2 py-0.5"
                          style={{
                            color: tx.status === "success" ? "var(--crt-green)" : "var(--crt-red)",
                            border: `1px solid ${tx.status === "success" ? "rgba(51,255,51,0.15)" : "rgba(255,51,51,0.15)"}`,
                            fontSize: "8px",
                            letterSpacing: "1px",
                            borderRadius: "2px",
                          }}
                        >
                          {tx.status.toUpperCase()}
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
            {tokens.length > 0 ? (
              <div className="space-y-2">
                {tokens.map(token => (
                  <div
                    key={token.address}
                    className="p-4 transition-all"
                    style={{
                      border: "1px solid rgba(255,255,255,0.05)",
                      background: "rgba(255,255,255,0.015)",
                      borderRadius: "3px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(51,255,51,0.15)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.015)";
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 flex items-center justify-center text-[11px] font-bold"
                          style={{
                            background: "rgba(51,255,51,0.06)",
                            border: "1px solid rgba(51,255,51,0.18)",
                            color: "var(--crt-green)",
                            borderRadius: "2px",
                          }}
                        >
                          {token.symbol.slice(0, 2)}
                        </span>
                        <div>
                          <div className="text-[12px] font-bold tracking-wider" style={{ color: "var(--crt-green)" }}>
                            {token.symbol}
                          </div>
                          <div className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                            {token.address?.slice(0, 10)}...{token.address?.slice(-6)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[16px] font-bold font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
                          {parseFloat(token.balance).toFixed(4)}
                        </div>
                        {token.usdValue && (
                          <div className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
                            ${token.usdValue}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="text-[32px] mb-4" style={{ opacity: 0.06 }}>&#9673;</div>
                <p className="text-[10px] tracking-[2px]" style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>
                  NO ERC20 TOKENS FOUND
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 animate-fadeIn"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      {/* Sidebar */}
      <div
        className="fixed top-0 right-0 z-50 h-full w-[680px] max-w-[92vw] flex flex-col animate-slideIn"
        style={{
          background: "var(--bg-primary)",
          borderLeft: "1px solid rgba(0,170,255,0.2)",
          boxShadow: "-12px 0 60px rgba(0,0,0,0.5), -2px 0 20px rgba(0,170,255,0.08)",
        }}
      >
        {content}
      </div>
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0.8; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideIn {
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out forwards;
        }
      `}</style>
    </>
  );
}
