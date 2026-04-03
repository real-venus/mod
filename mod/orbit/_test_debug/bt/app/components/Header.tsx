"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useStore } from "@/lib/store";
import { getAvailableWallets, connectWallet, shortAddress, SUPPORTED_WALLETS } from "@/lib/wallet";
import { getBalance } from "@/lib/bittensor";

const TABS = [
  { id: "subnets", label: "Subnets", icon: "[S]" },
  { id: "swap", label: "Swap", icon: "[X]" },
  { id: "leaderboard", label: "Board", icon: "[L]" },
  { id: "copytrade", label: "Copy", icon: "[C]" },
  { id: "proxy", label: "Proxy", icon: "[P]" },
  { id: "rpc", label: "RPC", icon: "[R]" },
];

export default function Header() {
  const { wallet, setWallet, disconnectWallet, activeTab, setActiveTab, theme, toggleTheme } = useStore();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect(walletKey: string) {
    setConnecting(true);
    try {
      const state = await connectWallet(walletKey);
      setWallet(state);
      toast.success(`Connected: ${shortAddress(state.address)}`);
      setShowWalletModal(false);

      getBalance(state.address)
        .then((balance) => {
          setWallet({ ...state, balance });
        })
        .catch(() => {});
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <header className="border-b-3 border-btborder bg-btcard sticky top-0 z-50" style={{ borderBottom: "3px solid var(--btborder)" }}>
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-btgreen flex items-center justify-center font-pixel text-[8px] text-black border-2 border-black" style={{ boxShadow: "2px 2px 0px black" }}>
            BT
          </div>
          <div>
            <h1 className="text-[10px] font-pixel gradient-text tracking-wider">COPYTRADE</h1>
            <p className="text-[6px] font-pixel text-btmuted">BITTENSOR dTAO</p>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-1.5 font-pixel text-[7px] pixel-btn ${
                activeTab === tab.id
                  ? "bg-btgreen text-black border-btgreen"
                  : "bg-btcard text-btmuted hover:text-bttext"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>

        {/* Theme toggle + Wallet */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="pixel-btn bg-btcard px-2 py-1.5 font-pixel text-[8px] text-btyellow"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "SUN" : "MON"}
          </button>

          {wallet.connected ? (
            <div className="flex items-center gap-2 pixel-box px-3 py-1.5">
              <div className="text-right">
                <p className="text-[7px] font-pixel text-bttext">{wallet.name}</p>
                <p className="text-[6px] font-pixel text-btmuted">
                  {shortAddress(wallet.address)}
                  {wallet.balance > 0 && (
                    <span className="ml-1 text-btgreen">{wallet.balance.toFixed(2)} TAO</span>
                  )}
                </p>
              </div>
              <div className="w-2 h-2 bg-btgreen pulse-dot" />
              <button
                onClick={disconnectWallet}
                className="text-[8px] font-pixel text-btmuted hover:text-btred"
              >
                [X]
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              className="pixel-btn bg-btgreen text-black px-3 py-1.5 font-pixel text-[7px] border-btgreen"
            >
              CONNECT
            </button>
          )}
        </div>
      </div>

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="pixel-box p-6 w-[360px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[9px] font-pixel text-bttext">CONNECT WALLET</h2>
              <button onClick={() => setShowWalletModal(false)} className="text-btmuted hover:text-btred font-pixel text-[8px]">
                [X]
              </button>
            </div>

            <p className="text-[7px] font-pixel text-btmuted mb-4">
              Select a Substrate wallet
            </p>

            <div className="space-y-2">
              {SUPPORTED_WALLETS.map((w) => {
                const available = typeof window !== "undefined" && window.injectedWeb3?.[w.key];
                return (
                  <button
                    key={w.key}
                    onClick={() => available && handleConnect(w.key)}
                    disabled={!available || connecting}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-2 transition-all font-pixel ${
                      available
                        ? "border-btborder hover:border-btgreen hover:bg-btgreen/10 cursor-pointer"
                        : "border-btborder/50 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="w-8 h-8 bg-btdark border-2 border-btborder flex items-center justify-center text-[8px] font-pixel text-bttext">
                      {w.name[0]}
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[7px] text-bttext">{w.name}</p>
                      <p className="text-[6px] text-btmuted">
                        {available ? ">> READY" : "NOT FOUND"}
                      </p>
                    </div>
                    {available && (
                      <div className="w-2 h-2 bg-btgreen" />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[6px] font-pixel text-btmuted mt-4 text-center">
              Need a wallet?{" "}
              <a
                href="https://www.subwallet.app/download.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-btgreen hover:underline"
              >
                GET SUBWALLET
              </a>
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
