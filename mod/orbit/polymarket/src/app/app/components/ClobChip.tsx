"use client";

import { useAuth } from "../context/AuthContext";

/// Compact CLOB auth chip for the top bar. Always rendered; click to
/// sign+derive when possible, otherwise shows the current state.
export default function ClobChip() {
  const { auth, authenticate, loading } = useAuth();

  const canSign = auth.connected && !!auth.address;
  const apiKey = auth.clobCreds?.apiKey || "";

  const label = loading
    ? "SIGNING..."
    : auth.authenticated
      ? `CLOB ${apiKey.slice(0, 6)}...`
      : canSign
        ? "SIGN CLOB"
        : "CLOB";

  const color = auth.authenticated
    ? "border-green-400 text-green-400 hover:bg-green-400/10"
    : canSign
      ? "border-amber-400 text-amber-400 hover:bg-amber-400/10"
      : "border-pixel-border text-pixel-gray cursor-not-allowed";

  const title = auth.authenticated
    ? `CLOB authenticated · click to re-derive · key ${apiKey.slice(0, 12)}...`
    : canSign
      ? "Sign EIP-712 to derive CLOB API key (required for live trading)"
      : "Connect wallet first to sign for CLOB";

  return (
    <button
      onClick={() => { if (canSign && !loading) void authenticate(); }}
      disabled={!canSign || loading}
      title={title}
      className={`pixel-btn text-[13px] px-2 py-1 transition-colors flex items-center gap-1.5 disabled:opacity-60 ${color}`}
    >
      <div
        className={`w-1.5 h-1.5 ${
          auth.authenticated ? "bg-green-400" : canSign ? "bg-amber-400" : "bg-pixel-gray"
        }`}
      />
      <span className="font-mono">{label}</span>
    </button>
  );
}
