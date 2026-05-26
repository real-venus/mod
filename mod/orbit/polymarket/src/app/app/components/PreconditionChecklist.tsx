"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadIndexes, getActiveIndexId } from "../lib/indexStore";
import type { SavedIndex } from "../lib/types";

/**
 * Pre-flight checklist shown above the strat index. Mirrors the checklist
 * inside LivePanel but reads the persisted strat (so it doesn't depend on
 * the live-engine local capital state) and can sit at the top of the page.
 *
 * When CLOB isn't authenticated, the row exposes a `refresh` button that
 * triggers `authenticate()` — single-click MetaMask signature → derived
 * CLOB API key → all subsequent live trading calls succeed.
 */
export default function PreconditionChecklist() {
  const { auth, authenticate, loading: authLoading } = useAuth();
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Re-read the active strat from localStorage on a slow interval so edits in
  // CopyIndex propagate up here without a full page reload.
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const activeStrat = useMemo((): SavedIndex | null => {
    if (!mounted) return null;
    const id = getActiveIndexId();
    if (!id) return null;
    return loadIndexes().find((s) => s.id === id) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted]);

  const hasWallet = mounted && auth.connected && !!auth.address;
  const hasCreds = mounted && auth.authenticated && !!auth.clobCreds;
  const hasTraders = (activeStrat?.traders.filter((t) => t.enabled !== false).length ?? 0) > 0;
  const hasRebalance = (activeStrat?.rebalanceMinutes ?? 0) > 0;
  const hasCapital = (activeStrat?.capital ?? 0) > 0;

  const items = [
    { ok: hasWallet, label: "WALLET CONNECTED" },
    {
      ok: hasCreds,
      label: "CLOB AUTHENTICATED",
      action: !hasCreds && hasWallet ? {
        label: authLoading ? "signing…" : "refresh",
        disabled: authLoading,
        onClick: () => { void authenticate(); },
      } : null,
    },
    { ok: !!activeStrat, label: "STRATEGY SELECTED" },
    { ok: hasTraders, label: "TRADERS IN STRATEGY" },
    { ok: hasRebalance, label: "REBALANCE PERIOD SET" },
    { ok: hasCapital, label: "CAPITAL > $0" },
  ] as const;

  const completed = items.filter((i) => i.ok).length;
  const allDone = completed === items.length;

  return (
    <div className="pixel-panel px-4 py-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[15px] text-pixel-gray tracking-[0.15em]">CHECKLIST</span>
        <span
          className={`text-[14px] font-mono ${allDone ? "text-green-400" : "text-pixel-gray"}`}
        >
          {completed}/{items.length} {allDone ? "· ready to go live" : "complete"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 py-0.5">
            <span className={`text-[15px] ${item.ok ? "text-green-400" : "text-red-400/60"}`}>
              {item.ok ? "[x]" : "[ ]"}
            </span>
            <span className={`text-[15px] font-mono ${item.ok ? "text-pixel-white" : "text-pixel-gray"}`}>
              {item.label}
            </span>
            {"action" in item && item.action && (
              <button
                onClick={item.action.onClick}
                disabled={item.action.disabled}
                className="ml-1 text-[13px] font-mono tracking-wider px-2 py-0.5 rounded-full border border-amber-400/50 text-amber-400 hover:text-amber-300 hover:border-amber-300 hover:bg-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Sign a MetaMask message to derive your Polymarket CLOB API key"
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
