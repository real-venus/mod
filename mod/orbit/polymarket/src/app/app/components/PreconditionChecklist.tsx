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

  // Short pill labels + a longer `desc` shown on hover so newcomers can
  // still figure out what each step means. Previous full-sentence labels
  // ("REBALANCE PERIOD SET") broke onto two lines inside the 3-column
  // grid; one-word chips wrap cleanly on any width.
  type Action = {
    label: string;
    disabled: boolean;
    onClick: () => void;
  };
  type Item = {
    ok: boolean;
    label: string;
    desc: string;
    action: Action | null;
  };
  const items: Item[] = [
    { ok: hasWallet, label: "WALLET", desc: "Polygon wallet connected", action: null },
    {
      ok: hasCreds,
      label: "CLOB",
      desc: "Polymarket CLOB API key derived from a MetaMask signature",
      action: !hasCreds && hasWallet ? {
        label: authLoading ? "signing…" : "sign",
        disabled: authLoading,
        onClick: () => { void authenticate(); },
      } : null,
    },
    { ok: !!activeStrat, label: "STRATEGY", desc: "A strat is selected as active", action: null },
    { ok: hasTraders, label: "TRADERS", desc: "At least one enabled trader to mirror", action: null },
    { ok: hasRebalance, label: "INTERVAL", desc: "Poll cadence set (see PARAMETERS → POLL EVERY)", action: null },
    { ok: hasCapital, label: "CAPITAL", desc: "Capital cap > $0 (see WALLET FUNDS panel)", action: null },
  ];

  const completed = items.filter((i) => i.ok).length;
  const total = items.length;
  const allDone = completed === total;
  const pct = (completed / total) * 100;

  return (
    <div className="pixel-panel px-3 py-2 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12px] text-pixel-gray tracking-[0.18em] shrink-0">
          CHECKLIST
        </span>
        <span
          className={`text-[12px] font-mono tracking-wider shrink-0 ${
            allDone ? "text-green-400" : "text-amber-400"
          }`}
        >
          {completed}/{total} {allDone ? "· ready to go live" : "· not ready"}
        </span>
        {/* Thin progress bar — same color as the ratio label so the eye
            picks up completion state without reading the digits. */}
        <div className="flex-1 min-w-[80px] h-1 bg-pixel-border/40 overflow-hidden rounded-sm">
          <div
            className={`h-full transition-all duration-300 ${
              allDone ? "bg-green-400" : "bg-amber-400/70"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Pill chips, one per step. Flex-wraps cleanly on any screen
            width so we never get the 2-line truncation the old 3-col
            grid produced. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {items.map((item) => (
            <span
              key={item.label}
              title={item.desc}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono tracking-wider border whitespace-nowrap ${
                item.ok
                  ? "border-green-400/60 text-green-400 bg-green-400/10"
                  : "border-pixel-border/60 text-pixel-gray bg-pixel-black/40"
              }`}
            >
              <span className="text-[10px]">{item.ok ? "✓" : "○"}</span>
              <span>{item.label}</span>
              {item.action && (
                <button
                  onClick={item.action.onClick}
                  disabled={item.action.disabled}
                  className="ml-0.5 text-[10px] font-mono text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed underline-offset-2 hover:underline"
                  title="Sign a MetaMask message to derive your Polymarket CLOB API key"
                >
                  {item.action.label}
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
