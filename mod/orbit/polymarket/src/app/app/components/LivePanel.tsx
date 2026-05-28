"use client";

import { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useCopyEngine } from "../context/CopyEngineContext";
import { loadIndexes, getActiveIndexId, updateIndex } from "../lib/indexStore";
import type { SavedIndex } from "../lib/types";
import type { ExecutionLogEntry } from "../lib/copyEngine";
import WalletFundingPanel from "./WalletFundingPanel";
import LoadedBadge from "./LoadedBadge";
import EnableTradingPanel from "./EnableTradingPanel";
import PolymarketAccountPanel from "./PolymarketAccountPanel";
import ThemeToggle from "./ThemeToggle";

// Live monitoring poll cadence — configurable per-strat via `livePollMinutes`.
// Defaults to 1 minute. The BACKTEST tab has its own `rebalanceMinutes` field
// for historical-simulation aggregation; the two are decoupled so a slow
// backtest cadence doesn't silently throttle real-time copy.
const LIVE_POLL_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 1, label: "1MIN" },
  { minutes: 2, label: "2MIN" },
  { minutes: 5, label: "5MIN" },
  { minutes: 10, label: "10MIN" },
  { minutes: 15, label: "15MIN" },
  { minutes: 30, label: "30MIN" },
  { minutes: 60, label: "1H" },
];
const DEFAULT_LIVE_POLL_MIN = 1;

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

// Past-tense friend of formatCountdown — "5s ago" / "3m ago" / "1h 2m ago".
function formatAgo(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

// Compact rounded stat card — used in the LIVE stats grid. The `tone` knob
// recolors the value (white default, green for "good", amber for "watching",
// red for "warning"). Label stays muted so the number reads first.
function StatCard({
  label,
  value,
  tone = "white",
  title,
  fullWidth,
}: {
  label: string;
  value: ReactNode;
  tone?: "white" | "green" | "amber" | "red";
  title?: string;
  fullWidth?: boolean;
}) {
  const valueCls =
    tone === "green" ? "text-green-400" :
    tone === "amber" ? "text-amber-400" :
    tone === "red" ? "text-red-400" :
    "text-pixel-white";
  return (
    <div
      title={title}
      className={`rounded-md border border-pixel-border/60 bg-pixel-black/40 px-2.5 py-1.5 flex items-baseline justify-between gap-2 ${fullWidth ? "col-span-2 md:col-span-3" : ""}`}
    >
      <span className="text-[11px] text-pixel-gray tracking-[0.18em] uppercase">{label}</span>
      <span className={`text-[15px] font-mono ${valueCls}`}>{value}</span>
    </div>
  );
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
  const { auth, authenticate, loading: authLoading } = useAuth();
  const { engineState, isLive, startLive, stopLive, pauseLive, resumeLive } = useCopyEngine();
  const [confirmed, setConfirmed] = useState(false);
  const [liveCapital, setLiveCapital] = useState(100);
  const [livePollMin, setLivePollMin] = useState(DEFAULT_LIVE_POLL_MIN);
  const [now, setNow] = useState(Date.now());
  // Paginated trade view (under the EXECUTION LOG). Toggle filter shows
  // only actual trade events (COPY_BUY / COPY_SELL / SKIP) instead of the
  // CYCLE_START/END heartbeat noise that dominates a healthy log.
  const [tradesPage, setTradesPage] = useState(0);
  const [tradesFilter, setTradesFilter] = useState<"trades" | "all">("trades");
  const TRADES_PAGE_SIZE = 25;

  // Tick for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load persisted live poll interval from the active strat (or default 1).
  useEffect(() => {
    const id = getActiveIndexId();
    if (!id) return;
    const strat = loadIndexes().find((s) => s.id === id);
    if (strat?.livePollMinutes) setLivePollMin(strat.livePollMinutes);
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
  // Always true now — LIVE is hard-pinned to 1-minute polling. The strat's
  // rebalanceMinutes only affects BACKTEST cadence and isn't a live precondition.
  const hasRebalance = true;
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

    startLive({
      strategyId: activeStrat.id,
      traders: activeStrat.traders.filter((t) => t.enabled !== false),
      capital: liveCapital,
      intervalMs: livePollMin * 60_000,
      creds: auth.clobCreds,
      address: auth.address,
      // Honor the strat's TRADE SIZE floor — was hardcoded to $1 before, which
      // caused every dust mirror to skip with BELOW_MIN_SIZE even when the
      // user had set MIN TRADE to 0.1 in BACKTEST. Falls back to $1.
      minOrderSize: activeStrat.minTrade ?? 1,
      maxSlippageBps: 300,
    });

    updateIndex(activeStrat.id, {
      liveEnabled: true,
      capital: liveCapital,
      livePollMinutes: livePollMin,
      updatedAt: Date.now(),
    });
  }, [isLive, confirmed, auth, activeStrat, liveCapital, livePollMin, startLive, stopLive]);

  const handleCancel = useCallback(() => setConfirmed(false), []);

  const status = engineState?.status || "stopped";
  const nextIn = engineState?.nextCycleAt ? engineState.nextCycleAt - now : 0;

  return (
    <div className="space-y-1">
      {/* ── Header ── */}
      <div className="pixel-panel border-2 border-pixel-border">
        <div className="px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 shrink-0 ${
              isLive && status === "running" ? "bg-green-400 animate-pulse" :
              isLive && status === "paused" ? "bg-amber-400" :
              isLive && status === "error" ? "bg-red-400 animate-pulse" :
              "bg-pixel-gray"
            }`} />
            <span className="text-[16px] text-pixel-white tracking-wider">LIVE COPY</span>
            {isLive && (
              <span className={`text-[13px] font-mono px-1 py-0.5 border ${
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
            <ThemeToggle />
            {/* SCAN EVERY — how often the engine hits Polymarket per trader.
                Disabled mid-run since changing intervals requires a stop/start. */}
            <label className="inline-flex items-center gap-1.5 text-[11px] text-pixel-gray tracking-wider">
              SCAN
              <select
                value={livePollMin}
                disabled={isLive}
                onChange={(e) => setLivePollMin(Number(e.target.value))}
                className="bg-pixel-black/60 border border-pixel-border rounded-[6px] font-mono text-[12px] text-pixel-white px-1.5 py-0.5 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="How often the engine polls each trader. Lower = more real-time, more API hits."
              >
                {LIVE_POLL_OPTIONS.map((o) => (
                  <option key={o.minutes} value={o.minutes}>{o.label}</option>
                ))}
              </select>
            </label>
            {/* Polygon USDC ready-to-trade indicator — visible before GO LIVE */}
            {auth.connected && <LoadedBadge capital={liveCapital} />}
            {isLive && status === "running" && (
              <button
                onClick={pauseLive}
                className="pixel-btn text-[13px] px-1.5 py-0.5 border-amber-400/60 text-amber-400 hover:bg-amber-400/10"
              >
                PAUSE
              </button>
            )}
            {isLive && status === "paused" && (
              <button
                onClick={resumeLive}
                className="pixel-btn text-[13px] px-1.5 py-0.5 border-green-400/60 text-green-400 hover:bg-green-400/10"
              >
                RESUME
              </button>
            )}
            <button
              onClick={confirmed && !isLive ? handleToggle : isLive ? handleToggle : handleToggle}
              disabled={!isLive && !canStart && !confirmed}
              className={`pixel-btn text-[14px] px-2.5 py-1 transition-colors ${
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
            <p className="text-[14px] text-red-400 mb-2">
              THIS WILL PLACE REAL ORDERS ON POLYGON MAINNET WITH YOUR CONNECTED WALLET.
              REAL USDC WILL BE USED. PROCEED?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                disabled={!canStart}
                className="pixel-btn text-[14px] px-3 py-1 border-red-400 text-red-400 hover:bg-red-400/10 disabled:opacity-30"
              >
                CONFIRM START
              </button>
              <button
                onClick={handleCancel}
                className="pixel-btn text-[14px] px-3 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Preconditions ──
          Moved to the TOP so the user knows what's blocking GO LIVE before
          scrolling through funding panels. Compact pill row: each step is
          green-filled when satisfied, amber-outline when actionable, muted
          when stale. The summary count tells you "5/6 ready" at a glance. */}
      {!isLive && (() => {
        const items = [
          { ok: hasWallet, label: "WALLET", action: null as null | { label: string; disabled: boolean; onClick: () => void } },
          {
            ok: hasCreds,
            label: "CLOB",
            // When CLOB isn't authed (and a wallet IS connected) expose a
            // refresh action so the user can sign again without leaving
            // the live panel.
            action: !hasCreds && hasWallet ? {
              label: authLoading ? "signing…" : "sign",
              disabled: authLoading,
              onClick: () => { void authenticate(); },
            } : null,
          },
          { ok: !!activeStrat, label: "STRAT", action: null },
          { ok: hasTraders, label: "TRADERS", action: null },
          { ok: hasRebalance, label: "REBALANCE", action: null },
          { ok: hasCapital, label: "CAPITAL", action: null },
        ];
        const okCount = items.filter((i) => i.ok).length;
        return (
          <div className="pixel-panel border-2 border-pixel-border px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-pixel-gray tracking-[0.18em] shrink-0">CHECKLIST</span>
              <span className={`text-[12px] font-mono tracking-wider shrink-0 ${
                okCount === items.length ? "text-green-400" : "text-amber-400"
              }`}>
                {okCount}/{items.length} {okCount === items.length ? "· ready to go live" : "· not ready"}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                {items.map((item) => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono tracking-wider border ${
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
      })()}

      {/* ── Wallet + Funds + Capital ── */}
      {!isLive && (
        <WalletFundingPanel capital={liveCapital} onCapitalChange={setLiveCapital} />
      )}

      {/* ── Polymarket proxy account (trading address) ──
          Shown even when live so the user can top up the proxy without
          stopping the engine. */}
      {auth.connected && <PolymarketAccountPanel />}

      {/* ── Stats (when live) ──
          Card grid replaces the old text-only flex rows. Each stat now has
          its own rounded mini-panel with a label + big mono value so the
          eye lands on numbers, not labels. LAST SYNC is the most recent
          successful Polymarket data-api pull (engine `lastCycleAt`) —
          tracks freshness directly instead of the cache snapshot age. */}
      {isLive && engineState && (
        <div className="pixel-panel border-2 border-pixel-border p-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            <StatCard
              label="BALANCE"
              value={engineState.balance !== null ? `$${engineState.balance.toFixed(2)}` : "—"}
              tone="white"
            />
            <StatCard
              label="CAPITAL"
              value={`$${liveCapital.toLocaleString()}`}
              tone="white"
            />
            <StatCard
              label="ORDERS"
              value={
                <>
                  <span className="text-green-400">{engineState.totalOrdersPlaced}</span>
                  {engineState.totalOrdersFailed > 0 && (
                    <span className="text-red-400"> / {engineState.totalOrdersFailed}F</span>
                  )}
                </>
              }
            />
            <StatCard
              label="VOLUME"
              value={`$${engineState.totalVolumeMirrored.toFixed(0)}`}
              tone="white"
            />
            <StatCard
              label="CYCLES"
              value={String(engineState.cycleCount)}
              tone="white"
            />
            <StatCard
              label="NEXT IN"
              value={formatCountdown(nextIn)}
              tone="green"
            />
            <StatCard
              label="LAST SYNC"
              value={engineState.lastCycleAt
                ? formatAgo(now - engineState.lastCycleAt)
                : "never"}
              tone={
                engineState.lastCycleAt && (now - engineState.lastCycleAt) < 90_000
                  ? "green"
                  : engineState.lastCycleAt && (now - engineState.lastCycleAt) < 300_000
                    ? "amber"
                    : "red"
              }
              title={
                engineState.lastCycleAt
                  ? `Most recent successful Polymarket data-api fetch at ${new Date(engineState.lastCycleAt).toLocaleTimeString()}`
                  : "No sync yet — first cycle pending"
              }
              fullWidth
            />
          </div>

          {/* ── Skip-floor banner ──
              Pops up when most of what the engine sees is dust. Surfaces
              the exact floor and a one-click "drop to N" action that hot-
              restarts the engine with a lower min so orders start flowing
              without leaving this tab. Threshold tuned to "more than 3
              skips with zero orders" so it never appears for healthy runs. */}
          {(() => {
            const skipCount = engineState.log.filter((e) => e.type === "SKIP").length;
            const ordersCount = engineState.totalOrdersPlaced;
            const noOrdersButSkipping = skipCount > 3 && ordersCount === 0;
            if (!noOrdersButSkipping) return null;
            // Suggest the largest skipped mirror as the new floor — that's
            // the smallest value that would have placed *at least one* order.
            const skippedSizes = engineState.log
              .filter((e) => e.type === "SKIP" && typeof e.mirrorNotional === "number")
              .map((e) => Math.abs(e.mirrorNotional as number));
            const maxSkipped = skippedSizes.length > 0 ? Math.max(...skippedSizes) : 0.1;
            // Round down to a tidy chip value (0.01 / 0.05 / 0.10 / 0.50).
            const tidyFloors = [0.01, 0.05, 0.10, 0.25, 0.5, 1];
            const suggested = tidyFloors.find((f) => f >= maxSkipped) ?? 1;
            const currentFloor = activeStrat?.minTrade ?? 1;
            const applyFloor = (newFloor: number) => {
              if (!activeStrat) return;
              updateIndex(activeStrat.id, { minTrade: newFloor, updatedAt: Date.now() });
              // Re-trigger startLive with the fresh config so the running
              // engine picks up the new floor. handleToggle skips the
              // confirm step when already confirmed/live; we have to stop
              // first then start to swap config cleanly.
              stopLive();
              setTimeout(() => {
                if (!auth.clobCreds || !auth.address) return;
                startLive({
                  strategyId: activeStrat.id,
                  traders: activeStrat.traders.filter((t) => t.enabled !== false),
                  capital: liveCapital,
                  intervalMs: livePollMin * 60_000,
                  creds: auth.clobCreds,
                  address: auth.address,
                  minOrderSize: newFloor,
                  maxSlippageBps: 300,
                });
              }, 100);
            };
            return (
              <div className="mt-2 px-3 py-2 border border-amber-400/40 bg-amber-400/5 rounded">
                <div className="text-[12px] text-amber-400 font-mono mb-1.5">
                  {skipCount} skipped · 0 orders · mirrors averaging $
                  {(skippedSizes.reduce((s, v) => s + v, 0) / Math.max(skippedSizes.length, 1)).toFixed(2)}
                  {" "}vs floor ${currentFloor.toFixed(2)}
                </div>
                <div className="text-[11px] text-pixel-gray font-mono mb-1.5">
                  Your capital is too thin OR the floor is too high. Drop the floor to start filling:
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0.01, 0.05, 0.10, 0.25, 0.50].map((f) => (
                    <button
                      key={f}
                      onClick={() => applyFloor(f)}
                      className={`pixel-btn text-[11px] px-2 py-0.5 ${
                        f === suggested
                          ? "border-green-400 text-green-400 bg-green-400/10"
                          : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                      }`}
                      title={f === suggested ? "Recommended — clears the largest skipped mirror" : `Drop floor to $${f.toFixed(2)} and restart`}
                    >
                      ${f.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {engineState.error && (
            <div className="mt-2 px-2 py-1 border border-red-400/40 bg-red-400/5 text-[14px] text-red-400 font-mono rounded">
              {engineState.error}
            </div>
          )}
        </div>
      )}

      {/* ── Trades / Execution Log (filterable + paginated) ──
          The full engine log is dominated by CYCLE_START/END heartbeats — the
          "TRADES" view filters to just the entries you actually copy or skip,
          which is what the user usually wants when monitoring. Pagination
          keeps the panel a fixed height instead of growing across the page. */}
      {isLive && engineState && engineState.log.length > 0 && (() => {
        const filtered = engineState.log.filter((e) =>
          tradesFilter === "trades"
            ? e.type === "COPY_BUY" || e.type === "COPY_SELL" || e.type === "SKIP"
            : true,
        );
        // Newest-first so the latest mirror lands at the top.
        const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);
        const totalPages = Math.max(1, Math.ceil(sorted.length / TRADES_PAGE_SIZE));
        const safePage = Math.min(tradesPage, totalPages - 1);
        const start = safePage * TRADES_PAGE_SIZE;
        const pageEntries = sorted.slice(start, start + TRADES_PAGE_SIZE);
        return (
          <div className="pixel-panel border-2 border-pixel-border">
            <div className="px-3 py-1.5 border-b border-pixel-border flex items-center gap-2 flex-wrap">
              <span className="text-[14px] text-pixel-gray tracking-wider shrink-0">
                {tradesFilter === "trades" ? "TRADES" : "EXECUTION LOG"}
              </span>
              <span className="text-[12px] text-pixel-gray font-mono shrink-0">
                {sorted.length} {tradesFilter === "trades" ? "trade events" : "entries"}
              </span>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { setTradesFilter("trades"); setTradesPage(0); }}
                  className={`pixel-btn text-[11px] px-2 py-0.5 ${
                    tradesFilter === "trades"
                      ? "border-green-400 text-green-400 bg-green-400/10"
                      : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                  }`}
                  title="Show only copy events (BUY / SELL / SKIP)"
                >
                  TRADES
                </button>
                <button
                  onClick={() => { setTradesFilter("all"); setTradesPage(0); }}
                  className={`pixel-btn text-[11px] px-2 py-0.5 ${
                    tradesFilter === "all"
                      ? "border-green-400 text-green-400 bg-green-400/10"
                      : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                  }`}
                  title="Show every log entry, including cycle heartbeats"
                >
                  ALL
                </button>
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {pageEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="px-3 py-1 border-b border-pixel-border/20 flex items-start gap-2 text-[14px] font-mono hover:bg-pixel-white/5"
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
              {pageEntries.length === 0 && (
                <div className="px-3 py-3 text-center text-[12px] text-pixel-gray">
                  No {tradesFilter === "trades" ? "trade events" : "log entries"} yet.
                </div>
              )}
            </div>
            {totalPages > 1 && (
              <div className="px-3 py-1.5 border-t border-pixel-border/40 flex items-center justify-between">
                <span className="text-[11px] text-pixel-gray font-mono">
                  {start + 1}-{Math.min(start + TRADES_PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTradesPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="pixel-btn text-[11px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    PREV
                  </button>
                  <span className="text-[11px] text-pixel-gray font-mono px-1">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setTradesPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="pixel-btn text-[11px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Empty state when live but no log ── */}
      {isLive && engineState && engineState.log.length === 0 && (
        <div className="pixel-panel border-2 border-pixel-border px-3 py-4 text-center">
          <span className="text-[15px] text-pixel-gray">WAITING FOR FIRST CYCLE...</span>
        </div>
      )}
    </div>
  );
}
