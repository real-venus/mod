"use client";

import { usePolygonUsdc } from "../lib/usePolygonUsdc";

interface Props {
  capital: number;
}

/// "How much can I trade with right now?" — Polygon USDC balance shown
/// inline with the GO LIVE control. Color reflects readiness vs the
/// configured capital cap so the user sees at a glance whether the wallet
/// is funded enough before flipping live.
export default function LoadedBadge({ capital }: Props) {
  const { balance, loading, error, refresh } = usePolygonUsdc();

  const ready = balance !== null && balance >= capital && capital > 0;
  const partial = balance !== null && balance > 0 && balance < capital;
  const empty = balance !== null && balance <= 0;

  const color = error
    ? "border-red-400 text-red-400 hover:bg-red-400/10"
    : ready
      ? "border-green-400 text-green-400 hover:bg-green-400/10"
      : partial
        ? "border-amber-400 text-amber-400 hover:bg-amber-400/10"
        : empty
          ? "border-red-400/70 text-red-400/80 hover:bg-red-400/10"
          : "border-pixel-border text-pixel-gray hover:text-pixel-white";

  const balStr = balance === null ? "—" : `$${balance.toFixed(2)}`;
  const label = error
    ? "BAL ERR ↻"
    : loading && balance === null
      ? "LOADING..."
      : ready
        ? `LOADED ${balStr} ✓`
        : partial
          ? `LOADED ${balStr} / $${capital}`
          : empty
            ? "EMPTY — FUND BELOW"
            : `LOADED ${balStr}`;

  const tooltip = [
    `Polygon USDC balance for the connected wallet.`,
    `Live: ${balance === null ? "(loading)" : `$${balance.toFixed(2)}`}`,
    `Cap:  $${capital.toLocaleString()}`,
    error ? `Error: ${error}` : "Click to refresh.",
  ].join("\n");

  return (
    <button
      onClick={refresh}
      title={tooltip}
      className={`pixel-btn font-mono text-[13px] px-2.5 py-1 transition-colors flex items-center gap-1.5 ${color}`}
    >
      <div className={`w-1.5 h-1.5 shrink-0 ${
        error ? "bg-red-400" :
        ready ? "bg-green-400 animate-pulse" :
        partial ? "bg-amber-400" :
        empty ? "bg-red-400/70" : "bg-pixel-gray animate-pulse"
      }`} />
      <span>{label}</span>
    </button>
  );
}
