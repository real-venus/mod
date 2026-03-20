"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useStore } from "@/lib/store";
import { getAvailableWallets, connectWallet, shortAddress, SUPPORTED_WALLETS } from "@/lib/wallet";

const TABS = [
  { id: "subnets", label: "Subnets", icon: "◆" },
  { id: "swap", label: "Swap", icon: "⇄" },
  { id: "leaderboard", label: "Leaderboard", icon: "★" },
  { id: "copytrade", label: "Copy Trade", icon: "⊕" },
  { id: "proxy", label: "Proxy", icon: "◈" },
  { id: "rpc", label: "RPC", icon: "●" },
];

export default function Header() {
  const { wallet, setWallet, disconnectWallet, activeTab, setActiveTab } = useStore();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect(walletKey: string) {
    setConnecting(true);
    try {
      const state = await connectWallet(walletKey);
      setWallet(state);
      toast.success(`Connected: ${shortAddress(state.address)}`);
      setShowWalletModal(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <header className="border-b border-btborder bg-btcard/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-btgreen to-btblue flex items-center justify-center font-bold text-black text-sm">
            BT
          </div>
          <div>
            <h1 className="text-sm font-bold gradient-text">CopyTrade</h1>
            <p className="text-[10px] text-btmuted">Bittensor dTAO</p>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-btgreen/10 text-btgreen border border-btgreen/30"
                  : "text-btmuted hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Wallet */}
        {wallet.connected ? (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-white">{wallet.name}</p>
              <p className="text-[10px] text-btmuted font-mono">{shortAddress(wallet.address)}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-btgreen pulse-dot" />
            <button
              onClick={disconnectWallet}
              className="text-[10px] text-btmuted hover:text-btred transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowWalletModal(true)}
            className="px-4 py-1.5 bg-btgreen/10 text-btgreen border border-btgreen/30 rounded-md text-xs font-medium hover:bg-btgreen/20 transition-all"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-btcard border border-btborder rounded-xl p-6 w-[360px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">Connect Wallet</h2>
              <button onClick={() => setShowWalletModal(false)} className="text-btmuted hover:text-white">
                ✕
              </button>
            </div>

            <p className="text-xs text-btmuted mb-4">
              Connect a Substrate wallet to interact with Bittensor
            </p>

            <div className="space-y-2">
              {SUPPORTED_WALLETS.map((w) => {
                const available = typeof window !== "undefined" && window.injectedWeb3?.[w.key];
                return (
                  <button
                    key={w.key}
                    onClick={() => available && handleConnect(w.key)}
                    disabled={!available || connecting}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                      available
                        ? "border-btborder hover:border-btgreen/50 hover:bg-btgreen/5 cursor-pointer"
                        : "border-btborder/50 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-btdark flex items-center justify-center text-sm">
                      {w.name[0]}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-xs font-medium">{w.name}</p>
                      <p className="text-[10px] text-btmuted">
                        {available ? "Available" : "Not installed"}
                      </p>
                    </div>
                    {available && (
                      <div className="w-2 h-2 rounded-full bg-btgreen" />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-btmuted mt-4 text-center">
              Need a wallet?{" "}
              <a
                href="https://www.subwallet.app/download.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-btgreen hover:underline"
              >
                Get SubWallet
              </a>
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
