"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useCopyEngine } from "../context/CopyEngineContext";
import { loadIndexes, getActiveIndexId, updateIndex } from "../lib/indexStore";
import type { SavedIndex } from "../lib/types";
import type { ExecutionLogEntry } from "../lib/copyEngine";
import WalletFundingPanel from "./WalletFundingPanel";

const REBALANCE_MS: Record<number, number> = {
  15: 900_000,
  60: 3_600_000,
  240: 14_400_000,
  1440: 86_400_000,
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "NOW";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function LogIcon({ type }: { type: ExecutionLogEntry["type"] }) {
  switch (type) {
    case "COPY_BUY": return <span className="text-red-400">BUY</span>;
    case "COPY_SELL": return <span className="text-green-400">SELL</span>;
    case "SKIP": return <span className="text-pixel-gray">SKIP</span>;
    case "ERROR": return <span className="text-red-400">ERR</span>;
    case "BALANCE": return <span className="text-amber-400">BAL</span>;
    case "CYCLE_START": return <span className="text-pixel-gray">---</span>;
    case "CYCLE_END": return <span className="text-green-400">END</span>;
    default: return <span className="text-pixel-gray">???</span>;
  }
}

export default function LivePanel() {
  const { auth } = useAuth();
  const { engineState, isLive, startLive, stopLive, pauseLive, resumeLive } = useCopyEngine();
  const [confirmed, setConfirmed] = useState(false);
  const [liveCapital, setLiveCapital] = useState(100);
  const [now, setNow] = useState(Date.now());

  // Tick for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeStrat = useMemo((): SavedIndex | null => {
    const id = getActiveIndexId();
    if (!id) return null;
    return loadIndexes().find((s) => s.id === id) || null;
  }, []);

  // Preconditions
  const hasWallet = auth.connected && !!auth.address;
  const hasCreds = auth.authenticated && !!auth.clobCreds;
  const hasTraders = (activeStrat?.traders.filter((t) => t.enabled !== false).length ?? 0) > 0;
  const hasRebalance = (activeStrat?.rebalanceMinutes ?? 0) > 0;
  const hasCapital = liveCapital > 0;
  const canStart = hasWallet && hasCreds && hasTraders && hasRebalance && hasCapital;

  const handleToggle = useCallback(() => {
    if (isLive) {
      stopLive();
      if (activeStrat) updateIndex(activeStrat.id, { liveEnabled: false, updatedAt: Date.now() });
      return;
    }

    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    if (!auth.clobCreds || !auth.address || !activeStrat) return;

    const intervalMs = REBALANCE_MS[activeStrat.rebalanceMinutes ?? 0];
    if (!intervalMs) return;

    startLive({
      strategyId: activeStrat.id,
      traders: activeStrat.traders.filter((t) => t.enabled !== false),
      capital: liveCapital,
      intervalMs,
      creds: auth.clobCreds,
      address: auth.address,
      minOrderSize: 1,
      maxSlippageBps: 300,
    });

    updateIndex(activeStrat.id, { liveEnabled: true, capital: liveCapital, updatedAt: Date.now() });
  }, [isLive, confirmed, auth, activeStrat, liveCapital, startLive, stopLive]);

  const handleCancel = useCallback(() => setConfirmed(false), []);

  const status = engineState?.status || "stopped";
  const nextIn = engineState?.nextCycleAt ? engineState.nextCycleAt - now : 0;

  return (
    <div className="space-y-2">
      {/* ── Header ── */}
      <div className="pixel-panel border-2 border-pixel-border">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 shrink-0 ${
              isLive && status === "running" ? "bg-green-400 animate-pulse" :
              isLive && status === "paused" ? "bg-amber-400" :
              isLive && status === "error" ? "bg-red-400 animate-pulse" :
              "bg-pixel-gray"
            }`} />
            <span className="text-[14px] text-pixel-white tracking-wider">LIVE COPY</span>
            {isLive && (
              <span className={`text-[11px] font-mono px-1 py-0.5 border ${
                status === "running" ? "border-green-400/40 text-green-400" :
                status === "paused" ? "border-amber-400/40 text-amber-400" :
                status === "error" ? "border-red-400/40 text-red-400" :
                "border-pixel-border text-pixel-gray"
              }`}>
                {status.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isLive && status === "running" && (
              <button
                onClick={pauseLive}
                className="pixel-btn text-[11px] px-1.5 py-0.5 border-amber-400/60 text-amber-400 hover:bg-amber-400/10"
              >
                PAUSE
              </button>
            )}
            {isLive && status === "paused" && (
              <button
                onClick={resumeLive}
                className="pixel-btn text-[11px] px-1.5 py-0.5 border-green-400/60 text-green-400 hover:bg-green-400/10"
              >
                RESUME
              </button>
            )}
            <button
              onClick={confirmed && !isLive ? handleToggle : isLive ? handleToggle : handleToggle}
              disabled={!isLive && !canStart && !confirmed}
              className={`pixel-btn text-[12px] px-2.5 py-1 transition-colors ${
                isLive
                  ? "border-red-400 text-red-400 hover:bg-red-400/10"
                  : "border-green-400 text-green-400 hover:bg-green-400/10 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
            >
              {isLive ? "STOP" : "GO LIVE"}
            </button>
          </div>
        </div>

        {/* Confirmation warning */}
        {confirmed && !isLive && (
          <div className="px-3 py-2 border-t border-red-400/30 bg-red-400/5">
            <p className="text-[12px] text-red-400 mb-2">
              THIS WILL PLACE REAL ORDERS ON POLYGON MAINNET WITH YOUR CONNECTED WALLET.
              REAL USDC WILL BE USED. PROCEED?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                disabled={!canStart}
                className="pixel-btn text-[12px] px-3 py-1 border-red-400 text-red-400 hover:bg-red-400/10 disabled:opacity-30"
              >
                CONFIRM START
              </button>
              <button
                onClick={handleCancel}
                className="pixel-btn text-[12px] px-3 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Wallet + Funds + Capital ── */}
      {!isLive && (
        <WalletFundingPanel capital={liveCapital} onCapitalChange={setLiveCapital} />
      )}

      {/* ── Preconditions ── */}
      {!isLive && (
        <div className="pixel-panel border-2 border-pixel-border px-3 py-2">
          <span className="text-[11px] text-pixel-gray tracking-wider block mb-1.5">CHECKLIST</span>
          {[
            { ok: hasWallet, label: "WALLET CONNECTED" },
            { ok: hasCreds, label: "CLOB AUTHENTICATED" },
            { ok: !!activeStrat, label: "STRATEGY SELECTED" },
            { ok: hasTraders, label: "TRADERS IN STRATEGY" },
            { ok: hasRebalance, label: "REBALANCE PERIOD SET" },
            { ok: hasCapital, label: "CAPITAL > $0" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 py-0.5">
              <span className={`text-[12px] ${item.ok ? "text-green-400" : "text-red-400/60"}`}>
                {item.ok ? "[x]" : "[ ]"}
              </span>
              <span className={`text-[12px] font-mono ${item.ok ? "text-pixel-white" : "text-pixel-gray"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats (when live) ── */}
      {isLive && engineState && (
        <div className="pixel-panel border-2 border-pixel-border px-3 py-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-[11px] text-pixel-gray">BALANCE</span>
              <span className="text-[12px] text-pixel-white font-mono">
                {engineState.balance !== null ? `$${engineState.balance.toFixed(2)}` : "---"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-pixel-gray">CAPITAL</span>
              <span className="text-[12px] text-pixel-white font-mono">${liveCapital.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-pixel-gray">ORDERS</span>
              <span className="text-[12px] font-mono">
                <span className="text-green-400">{engineState.totalOrdersPlaced}</span>
                {engineState.totalOrdersFailed > 0 && (
                  <span className="text-red-400"> / {engineState.totalOrdersFailed}F</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-pixel-gray">VOLUME</span>
              <span className="text-[12px] text-pixel-white font-mono">
                ${engineState.totalVolumeMirrored.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-pixel-gray">CYCLES</span>
              <span className="text-[12px] text-pixel-white font-mono">{engineState.cycleCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-pixel-gray">NEXT IN</span>
              <span className="text-[12px] text-green-400 font-mono">{formatCountdown(nextIn)}</span>
            </div>
          </div>
          {engineState.error && (
            <div className="mt-2 px-2 py-1 border border-red-400/40 bg-red-400/5 text-[12px] text-red-400 font-mono">
              {engineState.error}
            </div>
          )}
        </div>
      )}

      {/* ── Execution Log ── */}
      {isLive && engineState && engineState.log.length > 0 && (
        <div className="pixel-panel border-2 border-pixel-border">
          <div className="px-3 py-1.5 border-b border-pixel-border flex items-center justify-between">
            <span className="text-[12px] text-pixel-gray tracking-wider">EXECUTION LOG</span>
            <span className="text-[11px] text-pixel-gray font-mono">{engineState.log.length} entries</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {engineState.log.map((entry) => (
              <div
                key={entry.id}
                className="px-3 py-1 border-b border-pixel-border/20 flex items-start gap-2 text-[12px] font-mono hover:bg-pixel-white/5"
              >
                <span className="text-pixel-gray shrink-0 w-[52px]">{formatTime(entry.timestamp)}</span>
                <span className="shrink-0 w-[28px]"><LogIcon type={entry.type} /></span>
                <div className="min-w-0 flex-1">
                  {entry.market && (
                    <span className="text-pixel-white truncate block">{entry.market}</span>
                  )}
                  {entry.mirrorNotional !== undefined && entry.mirrorNotional > 0 && (
                    <span className={entry.side === "BUY" ? "text-red-400" : "text-green-400"}>
                      {entry.side === "BUY" ? "-" : "+"}${entry.mirrorNotional.toFixed(2)}
                    </span>
                  )}
                  {entry.reason && (
                    <span className="text-pixel-gray"> {entry.reason}</span>
                  )}
                  {entry.orderResult && !entry.orderResult.success && entry.orderResult.errorMsg && (
                    <span className="text-red-400/70 block truncate">{entry.orderResult.errorMsg}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state when live but no log ── */}
      {isLive && engineState && engineState.log.length === 0 && (
        <div className="pixel-panel border-2 border-pixel-border px-3 py-4 text-center">
          <span className="text-[13px] text-pixel-gray">WAITING FOR FIRST CYCLE...</span>
        </div>
      )}
    </div>
  );
}
