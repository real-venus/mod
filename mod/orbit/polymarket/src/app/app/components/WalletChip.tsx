"use client";

import { useAuth } from "../context/AuthContext";
import { shortAddress } from "../lib/auth";

/// Compact wallet connect/disconnect chip for the top bar.
export default function WalletChip() {
  const { auth, hasWallet, connect, disconnect, loading } = useAuth();

  const handleClick = () => {
    if (loading) return;
    if (auth.connected) disconnect();
    else void connect();
  };

  const label = loading
    ? "..."
    : auth.connected && auth.address
      ? shortAddress(auth.address)
      : hasWallet
        ? "CONNECT"
        : "NO WALLET";

  const color = auth.connected
    ? "border-green-400 text-green-400 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400"
    : hasWallet
      ? "border-pixel-border text-pixel-gray hover:text-green-400 hover:border-green-400"
      : "border-pixel-border text-pixel-gray cursor-not-allowed";

  // Trading-ready status folded into the dot:
  //   • bright green = connected AND CLOB authenticated (trades will go through)
  //   • amber        = connected, CLOB not yet enabled (read-only)
  //   • gray         = no wallet / disconnected
  const dotColor = !auth.connected
    ? "bg-pixel-gray"
    : auth.authenticated
      ? "bg-green-400"
      : "bg-amber-400";

  const title = auth.connected
    ? auth.authenticated
      ? `Connected ${auth.address} · trading enabled · click to disconnect`
      : `Connected ${auth.address} · trading not yet enabled · click to disconnect`
    : hasWallet
      ? "Connect MetaMask"
      : "Install a wallet extension first";

  return (
    <button
      onClick={handleClick}
      disabled={!hasWallet && !auth.connected}
      title={title}
      className={`pixel-btn text-[13px] px-2 py-1 transition-colors flex items-center gap-1.5 disabled:opacity-60 ${color}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className="font-mono">{label}</span>
    </button>
  );
}
