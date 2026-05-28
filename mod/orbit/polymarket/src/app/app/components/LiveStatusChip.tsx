"use client";

// LiveStatusChip — global LIVE indicator that lives in TopBar so the user
// can see at a glance whether the copy engine is running, which strat it's
// running, and switch strats or stop it from anywhere in the app.
//
// States:
//   stopped    → shows nothing (zero footprint when idle)
//   running    → green dot + "LIVE bro" + strat dropdown caret + STOP
//   paused     → amber dot
//   error      → red pulse

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCopyEngine } from "../context/CopyEngineContext";
import { loadIndexes, setActiveIndexId } from "../lib/indexStore";
import type { SavedIndex } from "../lib/types";

export default function LiveStatusChip() {
  const { isLive, engineState, activeStrategyId, stopLive } = useCopyEngine();
  const [strats, setStrats] = useState<SavedIndex[]>([]);
  const [open, setOpen] = useState(false);

  // Refresh the list when the dropdown opens so a newly-created strat shows.
  useEffect(() => {
    if (open) setStrats(loadIndexes());
  }, [open]);

  const activeStrat = useMemo<SavedIndex | null>(() => {
    if (!activeStrategyId) return null;
    return strats.find((s) => s.id === activeStrategyId)
      || loadIndexes().find((s) => s.id === activeStrategyId)
      || null;
  }, [strats, activeStrategyId]);

  if (!isLive) return null;

  const status = engineState?.status || "running";
  const dotCls =
    status === "running" ? "bg-green-400 animate-pulse" :
    status === "paused" ? "bg-amber-400" :
    status === "error" ? "bg-red-400 animate-pulse" :
    "bg-pixel-gray";
  const stratName = activeStrat?.name || "?";
  const traderCount = activeStrat?.traders.filter((t) => t.enabled !== false).length || 0;

  const switchStrat = (id: string) => {
    setActiveIndexId(id);
    // Tell other tabs/components that the active strat changed so they
    // re-read. CopyIndex / LivePanel listen to this event.
    try {
      window.dispatchEvent(new CustomEvent("strat-updated"));
    } catch {}
    setOpen(false);
  };

  return (
    <div className="relative inline-flex items-center gap-1.5 shrink-0">
      <Link
        href="/strats"
        className="inline-flex items-center gap-1.5 rounded-full border border-green-400/60 bg-green-400/10 px-2 py-0.5 text-[11px] font-mono tracking-wider hover:bg-green-400/15 transition-colors"
        title={`Copy engine is running ${stratName} · click to jump to LIVE tab`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
        <span className="text-green-400">LIVE</span>
        <span className="text-pixel-white">{stratName}</span>
        <span className="text-pixel-gray">{traderCount}T</span>
      </Link>

      {/* Strat-switch caret */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Switch active strategy"
        className="text-[10px] text-pixel-gray hover:text-green-400 px-1 py-0.5 border border-pixel-border/50 rounded-full"
      >
        ▾
      </button>

      {/* STOP — explicit user action that also clears the persisted session */}
      <button
        onClick={() => { if (confirm("Stop the live copy engine?")) stopLive(); }}
        title="Stop the live copy engine"
        className="text-[10px] text-red-400 hover:bg-red-400/10 px-1.5 py-0.5 border border-red-400/40 rounded-full font-mono"
      >
        STOP
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-md border border-pixel-border bg-pixel-bg shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-pixel-border/50 text-[10px] tracking-[0.18em] text-pixel-gray">
            SWITCH STRATEGY
          </div>
          {strats.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-pixel-gray">no strats saved</div>
          )}
          {strats.map((s) => {
            const isActive = s.id === activeStrategyId;
            const tn = s.traders.filter((t) => t.enabled !== false).length;
            return (
              <button
                key={s.id}
                onClick={() => switchStrat(s.id)}
                disabled={isActive}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-pixel-white/5 disabled:opacity-50 ${
                  isActive ? "bg-green-400/10 text-green-400" : "text-pixel-white"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-400" : "bg-pixel-gray"}`} />
                <span className="font-mono truncate flex-1">{s.name}</span>
                <span className="text-pixel-gray text-[11px]">{tn}T</span>
              </button>
            );
          })}
          <Link
            href="/strats"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 border-t border-pixel-border/50 text-[11px] text-pixel-gray hover:text-green-400 hover:bg-pixel-white/5"
          >
            manage strats →
          </Link>
        </div>
      )}
    </div>
  );
}
