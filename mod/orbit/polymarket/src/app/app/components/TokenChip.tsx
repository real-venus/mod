"use client";

import { useAuth } from "../context/AuthContext";

/// Compact local-token generate/regenerate chip for the top bar.
export default function TokenChip() {
  const { generateToken, localToken } = useAuth();

  const label = localToken ? `TOKEN ${localToken.tokenPreview}` : "GEN TOKEN";
  const color = localToken
    ? "border-green-400 text-green-400 hover:bg-green-400/10"
    : "border-pixel-border text-pixel-gray hover:text-green-400 hover:border-green-400";

  const title = localToken
    ? `Local token ${localToken.tokenPreview}... issued ${new Date(localToken.issuedAt).toLocaleString()} · click to regenerate`
    : "Generate a 256-bit local token (stored in this browser, no wallet needed)";

  return (
    <button
      onClick={() => generateToken()}
      title={title}
      className={`pixel-btn text-[11px] px-2 py-1 transition-colors flex items-center gap-1.5 ${color}`}
    >
      <div className={`w-1.5 h-1.5 ${localToken ? "bg-green-400" : "bg-pixel-gray"}`} />
      <span className="font-mono">{label}</span>
    </button>
  );
}
