"use client";

import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { useNetwork } from "../context/NetworkContext";
import { shortAddress } from "../lib/wallet";
import { CHAINS } from "../lib/chains";

const NETWORK_OPTIONS = [
  { chainId: 137, label: "POLYGON", color: "#8247e5" },
  { chainId: 8453, label: "BASE", color: "#0052ff" },
  { chainId: 42161, label: "ARBITRUM", color: "#28a0f0" },
  { chainId: 1, label: "ETHEREUM", color: "#627eea" },
];

export default function Header() {
  const { wallet, availableWallets, connect, disconnect } = useWallet();
  const { chainId, setChainId } = useNetwork();
  const [dateStr, setDateStr] = useState("----.--.--");

  useEffect(() => {
    setDateStr(new Date().toISOString().split("T")[0]);
  }, []);

  return (
    <header className="border-b border-ibm-green/20 bg-ibm-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-ibm-green/60 flex items-center justify-center">
            <span className="text-ibm-green text-xs font-bold glow-text">PC</span>
          </div>
          <div className="flex flex-col">
            <span className="text-ibm-green text-sm font-semibold tracking-wider glow-text">
              POLYCOPY
            </span>
            <span className="text-ibm-gray-light text-[10px] tracking-widest uppercase">
              Multi-Chain Copy Trading
            </span>
          </div>
        </div>

        {/* Network Selector */}
        <div className="hidden md:flex items-center gap-1">
          {NETWORK_OPTIONS.map((net) => (
            <button
              key={net.chainId}
              onClick={() => setChainId(net.chainId)}
              className={`px-3 py-1 text-[10px] tracking-wider transition-all border ${
                chainId === net.chainId
                  ? "border-opacity-60 bg-opacity-10"
                  : "border-transparent text-ibm-gray hover:text-ibm-white"
              }`}
              style={
                chainId === net.chainId
                  ? {
                      borderColor: net.color,
                      backgroundColor: net.color + "15",
                      color: net.color,
                    }
                  : undefined
              }
            >
              {net.label}
            </button>
          ))}
        </div>

        {/* System Status */}
        <div className="hidden lg:flex items-center gap-4 text-[11px] text-ibm-gray-light">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-ibm-green animate-pulse" />
            <span>ONLINE</span>
          </div>
          <span className="text-ibm-border">|</span>
          <span>{dateStr}</span>
        </div>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {wallet.connected ? (
            <div className="flex items-center gap-2">
              {wallet.chainId && CHAINS[wallet.chainId] && (
                <span className="text-[10px] px-2 py-0.5 border border-ibm-blue/40 text-ibm-blue">
                  {CHAINS[wallet.chainId].shortName}
                </span>
              )}
              <div className="panel-glow bg-ibm-panel px-3 py-1.5 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 16 16" className="text-ibm-amber">
                    <path fill="currentColor" d="M8 1L2 6v4l6 5 6-5V6L8 1zm0 2l4 3.3v2.4L8 12 4 8.7V6.3L8 3z" />
                  </svg>
                  <span className="text-ibm-amber text-[11px] font-medium glow-amber">
                    {wallet.walletType === "metamask" ? "ECDSA" : "ED25519"}
                  </span>
                </div>
                <span className="text-ibm-border">|</span>
                <span className="text-ibm-green text-[11px] font-medium glow-text">
                  {shortAddress(wallet.address || "")}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(wallet.address || "")}
                  className="text-ibm-gray-light hover:text-ibm-green transition-colors"
                  title="Copy address"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12 2H6a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2zm0 10H6V4h6v8z" />
                    <path d="M4 6H2v8a2 2 0 002 2h6v-2H4V6z" />
                  </svg>
                </button>
                <button
                  onClick={disconnect}
                  className="text-ibm-gray-light hover:text-ibm-red transition-colors ml-1"
                  title="Disconnect"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1a6 6 0 100 12A6 6 0 008 2zM5.5 5l2.5 3-2.5 3h1l2-2.5L10.5 11h1L9 8l2.5-3h-1L8.5 7.5 6.5 5h-1z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {availableWallets.metamask && (
                <button
                  onClick={() => connect("metamask")}
                  className="panel-glow bg-ibm-panel hover:bg-ibm-dark px-3 py-1.5 text-ibm-green text-[11px] font-medium transition-all hover:shadow-[0_0_10px_#42be6533]"
                >
                  METAMASK
                </button>
              )}
              {availableWallets.phantom && (
                <button
                  onClick={() => connect("phantom")}
                  className="panel-glow bg-ibm-panel hover:bg-ibm-dark px-3 py-1.5 text-ibm-amber text-[11px] font-medium transition-all hover:shadow-[0_0_10px_#f1c21b33]"
                >
                  PHANTOM
                </button>
              )}
              {!availableWallets.metamask && !availableWallets.phantom && (
                <button
                  onClick={() => connect("metamask")}
                  className="panel-glow bg-ibm-panel hover:bg-ibm-dark px-3 py-1.5 text-ibm-green text-[11px] font-medium transition-all"
                >
                  CONNECT WALLET
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
