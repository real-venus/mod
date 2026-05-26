"use client";

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { fetchPositions, fetchWalletTradesUntil, formatVolume, formatPnl, fetchTradersPage, TopTrader } from "../lib/polymarket";
import { PolymarketPosition, PolymarketTrade, SavedIndex } from "../lib/types";
import { shortAddress } from "@/lib/auth";
import { useFilterParams } from "../context/FiltersContext";
import { useAuth } from "../context/AuthContext";
import PnlChart from "./PnlChart";
import type { CurvePoint } from "./PnlChart";
import { computeFifoTrades, buildPnlCurve, buildCombinedPnlCurve, aggregateToRebalanceWindows } from "../lib/pnlEngine";
import { loadIndexes, saveIndex, deleteIndex, updateIndex, getActiveIndexId, setActiveIndexId } from "../lib/indexStore";
import LivePanel from "./LivePanel";
import StratPicker from "./StratPicker";
import WalletFundingPanel from "./WalletFundingPanel";

interface TraderSummary {
  address: string;
  positions: number;
  filteredPositions: number;
  totalPnl: number;
  loaded: boolean;
}

interface BacktestDay {
  date: string;
  buys: number;
  sells: number;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  cumFlow: number;
  trades: number;
}

interface SimulatedTrade {
  timestamp: number;
  market: string;
  conditionId: string;
  side: "BUY" | "SELL";
  traderSize: number;
  traderPrice: number;
  traderNotional: number;
  mirrorNotional: number;
  mirrorSize: number;
  fee: number;
  gas: number;
  netCost: number;
}

interface TraderBacktest {
  address: string;
  trades: number;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  openValue: number;
  estimatedPnl: number;
  totalFees: number;
  totalGas: number;
  pnlAfterCosts: number;
  days: BacktestDay[];
  simulatedTrades: SimulatedTrade[];
}

// Polymarket fee structure (Polygon CLOB)
// Taker fee: ~2% on matched notional; maker rebate not applicable for copy-trading
// Gas: ~0.01 MATIC per tx on Polygon ≈ $0.005 per trade at typical MATIC prices
// Note: fees are estimated on a simulated copy basis — not the trader's raw volume,
// because your copy position scales to your capital, not theirs.
const TAKER_FEE_BPS = 200; // 2% = 200 bps
const GAS_PER_TRADE_USD = 0.005;
const DEFAULT_CAPITAL = 1000;

// Deterministic per-trade sample filter. Same (samplePct, key) always returns
// the same boolean — keeps the chart + feed in lockstep without re-sampling
// every render. Uses FNV-1a so a one-char tweak to the key reshuffles cleanly.
function keepInSample(samplePct: number, key: string): boolean {
  if (samplePct >= 100) return true;
  if (samplePct <= 0) return false;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100) < samplePct;
}

function computeBacktest(
  trades: PolymarketTrade[],
  positions: PolymarketPosition[],
  windowDays: number,
  address: string,
  capital: number = DEFAULT_CAPITAL,
  rebalancePeriodHours: number = 0,
  rebalanceHour: number = 0,
): TraderBacktest {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const replay = rebalancePeriodHours > 0
    ? aggregateToRebalanceWindows(trades, rebalancePeriodHours, rebalanceHour)
    : trades;
  const allWindowTrades = replay
    .filter((t) => t.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Filter out SELLs without a prior BUY in the window (copy-trader wouldn't hold those)
  const windowInv = new Map<string, number>();
  const windowTrades = allWindowTrades.filter((t) => {
    const key = t.conditionId || t.market;
    if (t.side === "BUY") {
      windowInv.set(key, (windowInv.get(key) || 0) + t.size);
      return true;
    }
    const inv = windowInv.get(key) || 0;
    if (inv <= 1e-9) return false;
    const sold = Math.min(t.size, inv);
    windowInv.set(key, inv - sold);
    return true;
  });

  let buyVolume = 0;
  let sellVolume = 0;

  const dayMap = new Map<string, { buys: number; sells: number; buyVol: number; sellVol: number }>();

  for (const t of windowTrades) {
    const d = new Date(t.timestamp);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    const day = dayMap.get(key) || { buys: 0, sells: 0, buyVol: 0, sellVol: 0 };

    const vol = t.price * t.size;
    if (t.side === "BUY") {
      buyVolume += vol;
      day.buys++;
      day.buyVol += vol;
    } else {
      sellVolume += vol;
      day.sells++;
      day.sellVol += vol;
    }
    dayMap.set(key, day);
  }

  let cumFlow = 0;
  const days: BacktestDay[] = [];
  for (const [date, d] of dayMap) {
    const netFlow = d.sellVol - d.buyVol;
    cumFlow += netFlow;
    days.push({
      date,
      buys: d.buys,
      sells: d.sells,
      buyVolume: Math.round(d.buyVol * 100) / 100,
      sellVolume: Math.round(d.sellVol * 100) / 100,
      netFlow: Math.round(netFlow * 100) / 100,
      cumFlow: Math.round(cumFlow * 100) / 100,
      trades: d.buys + d.sells,
    });
  }

  // Daily rebalancing: assume all positions are closed, only count realized P&L
  const openValue = 0; // positions.reduce((s, p) => s + p.value, 0);
  const netFlow = sellVolume - buyVolume;
  const estimatedPnl = netFlow; // + openValue;

  // Fee/gas cost estimation — scaled to simulated capital.
  // copyRatio = how much of the trader's volume you'd replicate with your capital.
  // Use max(buy, sell) to prevent blow-up when a trader mostly sells old positions.
  const traderVol = Math.max(buyVolume, sellVolume, 1);
  const copyRatio = capital / traderVol;
  const totalNotional = (buyVolume + sellVolume) * copyRatio;
  // Polymarket fee uses min(price, 1-price) per trade; approximate as avg ~40% of notional
  const totalFees = windowTrades.reduce((sum, t) => {
    const mirrorShares = t.size * copyRatio;
    return sum + mirrorShares * Math.min(t.price, 1 - t.price) * (TAKER_FEE_BPS / 10_000);
  }, 0);
  const totalGas = windowTrades.length * GAS_PER_TRADE_USD;
  // Scale PnL to simulated capital (matches the ROI metric)
  const scaledPnl = estimatedPnl * copyRatio;
  const pnlAfterCosts = scaledPnl - totalFees - totalGas;

  // Build individual simulated trades scaled to user's capital
  const simulatedTrades: SimulatedTrade[] = windowTrades.map((t) => {
    const traderNotional = t.price * t.size;
    const mirrorNotional = Math.round(traderNotional * copyRatio * 100) / 100;
    const mirrorSize = Math.round(t.size * copyRatio * 100) / 100;
    const fee = Math.round(mirrorSize * Math.min(t.price, 1 - t.price) * (TAKER_FEE_BPS / 10_000) * 100) / 100;
    const gas = GAS_PER_TRADE_USD;
    const netCost = t.side === "BUY"
      ? Math.round((mirrorNotional + fee + gas) * 100) / 100
      : Math.round((mirrorNotional - fee - gas) * 100) / 100;
    return {
      timestamp: t.timestamp,
      market: t.market,
      conditionId: t.conditionId,
      side: t.side,
      traderSize: t.size,
      traderPrice: t.price,
      traderNotional: Math.round(traderNotional * 100) / 100,
      mirrorNotional,
      mirrorSize,
      fee,
      gas,
      netCost,
    };
  });

  return {
    address,
    trades: windowTrades.length,
    buyVolume: Math.round(buyVolume * 100) / 100,
    sellVolume: Math.round(sellVolume * 100) / 100,
    netFlow: Math.round(netFlow * 100) / 100,
    openValue: Math.round(openValue * 100) / 100,
    estimatedPnl: Math.round(estimatedPnl * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    totalGas: Math.round(totalGas * 100) / 100,
    pnlAfterCosts: Math.round(pnlAfterCosts * 100) / 100,
    days,
    simulatedTrades,
  };
}

/* ── Add Trader Bar ── */
function AddTraderBar({ watchlist, onAdd }: { watchlist: string[]; onAdd: (addr: string) => void }) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<TopTrader[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [coldCache, setColdCache] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  const isAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim());

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || isAddress(q)) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetchTradersPage({ search: q, pageSize: 5, pool: 2000 });
      if (res.cold) { setColdCache(true); setResults([]); return; }
      setColdCache(false);
      setResults(res.traders.filter((t) => !watchlist.includes(t.address)));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [watchlist]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim() || isAddress(input)) { setResults([]); return; }
    debounceRef.current = setTimeout(() => doSearch(input), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, doSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = () => {
    const v = input.trim();
    if (!v) return;
    if (isAddress(v)) {
      if (watchlist.includes(v.toLowerCase()) || watchlist.includes(v)) return;
      onAdd(v);
      setInput("");
      setResults([]);
    }
  };

  const handlePick = (addr: string) => {
    onAdd(addr);
    setInput("");
    setResults([]);
    setFocused(false);
  };

  const alreadyAdded = isAddress(input.trim()) && (watchlist.includes(input.trim().toLowerCase()) || watchlist.includes(input.trim()));

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-pixel-gray tracking-wider shrink-0">ADD TRADER</span>
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="0x... ADDRESS OR SEARCH NAME"
            className="pixel-input-sm w-full font-mono text-[14px] pr-16"
            spellCheck={false}
          />
          {searching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-green-400 animate-pulse">...</span>
          )}
          {isAddress(input.trim()) && !alreadyAdded && (
            <button
              onClick={handleSubmit}
              className="absolute right-1 top-1/2 -translate-y-1/2 pixel-btn text-[12px] px-2 py-0 border-green-400 text-green-400 hover:bg-green-400/10"
            >
              ADD
            </button>
          )}
          {alreadyAdded && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-pixel-gray">ALREADY ADDED</span>
          )}
        </div>
      </div>

      {focused && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 pixel-panel border-2 border-pixel-border bg-pixel-black max-h-[200px] overflow-y-auto">
          {results.map((t) => (
            <button
              key={t.address}
              onClick={() => handlePick(t.address)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-pixel-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-mono text-pixel-white">{shortAddress(t.address)}</span>
                <span className={`text-[13px] font-mono ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatPnl(t.pnl)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-pixel-gray font-mono">
                <span>VOL {formatVolume(t.volume)}</span>
                <span>{t.recentTrades || t.positions} trades</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {focused && coldCache && input.trim() && !isAddress(input.trim()) && (
        <div className="absolute z-50 left-0 right-0 mt-1 pixel-panel border-2 border-pixel-border bg-pixel-black px-3 py-2">
          <span className="text-[13px] text-pixel-gray">TRADER CACHE WARMING — PASTE 0x ADDRESS DIRECTLY</span>
        </div>
      )}
    </div>
  );
}

interface CopyIndexProps {
  searchFilter: string;
  compact?: boolean;
  onClose?: () => void;
}

// Labeled input/select group used across the backtest controls. Renders a
// small uppercase label above a bordered chip that can hold inputs, selects,
// and adornments (prefix/suffix).
function Field({
  label,
  prefix,
  suffix,
  children,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-pixel-gray tracking-[0.18em] leading-none">{label}</span>
      <div className="inline-flex items-center gap-1 h-[28px] px-2 border border-pixel-border bg-pixel-black/60 hover:border-pixel-white/30 focus-within:border-green-400/70 transition-colors">
        {prefix && <span className="text-[12px] text-pixel-gray font-mono">{prefix}</span>}
        {children}
        {suffix && <span className="text-[12px] text-pixel-gray font-mono tracking-wider ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

export default function CopyIndex({ searchFilter, compact, onClose }: CopyIndexProps) {
  const router = useRouter();
  const filterQs = useFilterParams({ excludeSearch: true });
  const { localToken, auth } = useAuth();

  // ── Strategy management ──
  const [savedIndexes, setSavedIndexes] = useState<SavedIndex[]>([]);
  const [activeIndex, setActiveIndex] = useState<SavedIndex | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const chartPanelRef = useRef<HTMLDivElement>(null);

  // ── Data state ──
  const [traderData, setTraderData] = useState<Map<string, PolymarketPosition[]>>(new Map());
  const [traderTrades, setTraderTrades] = useState<Map<string, PolymarketTrade[]>>(new Map());
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Backtest ──
  const [backtestDays, setBacktestDays] = useState(3);
  const [backtestDaysInput, setBacktestDaysInput] = useState("3");
  const [capital, setCapital] = useState(DEFAULT_CAPITAL);
  const [minTrade, setMinTrade] = useState(1);
  const [maxTrade, setMaxTrade] = useState(100);
  const [maxTradesPerHour, setMaxTradesPerHour] = useState(10);
  // SAMPLE %: deterministically thin the in-window trades to this fraction.
  // 100 = keep all (default), 50 = keep ~half, 10 = keep ~tenth. Curve, feed,
  // and fee/gas/total stats all derive from the sampled set.
  const [samplePct, setSamplePct] = useState(100);
  // Per-trade replay is the only mode now — `rebalancePeriod`/`rebalanceHour`
  // are kept for backwards compat with persisted SavedIndex but always loaded
  // as 0/0 going forward. The aggregation path in computeBacktest stays no-op
  // unless an older strat still has a non-zero value.
  const [rebalancePeriod, setRebalancePeriod] = useState<number>(0); // hours (0 = per-trade)
  const [rebalanceHour, setRebalanceHour] = useState<number>(0); // 0-23 (unused when per-trade)
  const [rebalanceMinutes, setRebalanceMinutes] = useState<number>(1); // minutes between live polls
  const [customDaysInput, setCustomDaysInput] = useState("");
  const [expandedTrader, setExpandedTrader] = useState<string | null>(null);
  const [showSimTrades, setShowSimTrades] = useState<Record<string, boolean>>({});
  const [simTradeLimit, setSimTradeLimit] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Weights (local state, persisted on change) ──
  const [traderWeights, setTraderWeights] = useState<Record<string, number>>({});

  // ── Mode toggle (STRATS = manage, BACKTEST = test, LIVE = copy) ──
  const [mode, setMode] = useState<"STRATS" | "BACKTEST" | "LIVE">("STRATS");

  // Derive watchlist from active strategy (only enabled traders)
  const watchlist = useMemo(
    () => (activeIndex ? activeIndex.traders.filter((t) => t.enabled !== false).map((t) => t.address) : []),
    [activeIndex],
  );
  // Full list including hidden traders (for the editor panel)
  const allTraderAddrs = useMemo(
    () => (activeIndex ? activeIndex.traders.map((t) => t.address) : []),
    [activeIndex],
  );
  const watchlistKey = watchlist.join(",");

  // ── Init: load or auto-create a single default strat ──
  useEffect(() => {
    let indexes = loadIndexes();

    // Auto-migrate legacy flat watchlist (first load only)
    if (indexes.length === 0) {
      try {
        const legacy = localStorage.getItem("poly8bit_watchlist");
        if (legacy) {
          const addrs = JSON.parse(legacy) as string[];
          if (addrs.length > 0) {
            const now = Date.now();
            const migrated: SavedIndex = {
              id: now.toString(36),
              name: "Default",
              traders: addrs.map((a) => ({ address: a, weight: 1 / addrs.length })),
              backtestDays: 3,
              createdAt: now,
              updatedAt: now,
            };
            saveIndex(migrated);
            indexes = [migrated];
          }
        }
      } catch {}
    }

    // Always ensure at least one strat exists
    if (indexes.length === 0) {
      const now = Date.now();
      const def: SavedIndex = {
        id: now.toString(36),
        name: "Default",
        traders: [],
        backtestDays: 3,
        createdAt: now,
        updatedAt: now,
      };
      saveIndex(def);
      indexes = [def];
    }

    setSavedIndexes(indexes);
    const activeId = getActiveIndexId();
    const found = activeId ? indexes.find((i) => i.id === activeId) : null;
    const active = found || indexes[0];
    setActiveIndex(active);
    setActiveIndexId(active.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Load weights + backtest days from active strategy
  useEffect(() => {
    if (!activeIndex) {
      setTraderWeights({});
      setBacktestDays(3);
      setBacktestDaysInput("3");
      return;
    }
    const w: Record<string, number> = {};
    for (const t of activeIndex.traders) w[t.address] = Math.round(t.weight * 100);
    setTraderWeights(w);
    if (activeIndex.backtestDays) {
      setBacktestDays(activeIndex.backtestDays);
      setBacktestDaysInput(String(activeIndex.backtestDays));
      if (![3, 7, 14, 30].includes(activeIndex.backtestDays)) {
        setCustomDaysInput(String(activeIndex.backtestDays));
      } else {
        setCustomDaysInput("");
      }
    }
    setCapital(activeIndex.capital ?? DEFAULT_CAPITAL);
    setMinTrade(activeIndex.minTrade ?? 1);
    setMaxTrade(activeIndex.maxTrade ?? 100);
    setMaxTradesPerHour(activeIndex.maxTradesPerHour ?? 10);
    // Force per-trade replay on load — REBALANCE/AT selects were removed,
    // and any non-zero persisted value would silently aggregate trades into
    // windows with no way to undo from the UI.
    setRebalancePeriod(0);
    setRebalanceHour(0);
    setRebalanceMinutes(activeIndex.rebalanceMinutes ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex?.id]);

  // ── Persist helper ──
  const persistIndex = useCallback((idx: SavedIndex) => {
    const updated = { ...idx, updatedAt: Date.now() };
    updateIndex(updated.id, updated);
    setActiveIndex(updated);
    setSavedIndexes(loadIndexes());
    // Broadcast so the /traders page (and any other listener) re-reads the
    // active strat — keeps the +ADD/✓ toggle in sync across surfaces.
    window.dispatchEvent(new Event("strat-updated"));
  }, []);

  // ── Strategy CRUD ──
  const createStrategy = (name: string) => {
    const now = Date.now();
    const idx: SavedIndex = {
      id: now.toString(36),
      name: name.trim() || "Untitled",
      traders: [],
      backtestDays: 3,
      createdAt: now,
      updatedAt: now,
    };
    saveIndex(idx);
    setActiveIndex(idx);
    setActiveIndexId(idx.id);
    setSavedIndexes(loadIndexes());
    setCreatingNew(false);
    setNewName("");
  };

  const selectStrategy = (id: string) => {
    const fresh = loadIndexes().find((i) => i.id === id);
    if (!fresh) return;
    setActiveIndex(fresh);
    setActiveIndexId(id);
  };

  const handleDeleteStrategy = (id: string) => {
    deleteIndex(id);
    const remaining = loadIndexes();
    setSavedIndexes(remaining);
    if (activeIndex?.id === id) {
      const next = remaining[0] || null;
      setActiveIndex(next);
      setActiveIndexId(next?.id ?? null);
    }
    setConfirmDeleteId(null);
  };

  const handleRename = (id: string, name: string) => {
    if (!name.trim()) { setRenamingId(null); return; }
    const idx = loadIndexes().find((i) => i.id === id);
    if (idx) persistIndex({ ...idx, name: name.trim() });
    setRenamingId(null);
  };

  // ── Weight updates (persist immediately) ──
  const updateWeight = (addr: string, pct: number) => {
    setTraderWeights((prev) => ({ ...prev, [addr]: pct }));
    if (activeIndex) {
      const traders = activeIndex.traders.map((t) =>
        t.address === addr ? { ...t, weight: pct / 100 } : t,
      );
      updateIndex(activeIndex.id, { traders, updatedAt: Date.now() });
    }
  };

  // ── Bulk weight operations ──
  const equalizeWeights = () => {
    if (!activeIndex || activeIndex.traders.length === 0) return;
    // Only equalize enabled traders; leave disabled at 0
    const enabled = activeIndex.traders.filter((t) => t.enabled !== false);
    const n = enabled.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    const enabledAddrs = new Set(enabled.map((t) => t.address));
    const newWeights: Record<string, number> = {};
    let ei = 0;
    const traders = activeIndex.traders.map((t) => {
      if (!enabledAddrs.has(t.address)) {
        newWeights[t.address] = 0;
        return { ...t, weight: 0 };
      }
      const w = base + (ei < remainder ? 1 : 0);
      ei++;
      newWeights[t.address] = w;
      return { ...t, weight: w / 100 };
    });
    setTraderWeights(newWeights);
    persistIndex({ ...activeIndex, traders });
  };

  const normalizeWeights = () => {
    if (!activeIndex || activeIndex.traders.length === 0) return;
    const enabled = activeIndex.traders.filter((t) => t.enabled !== false);
    const enabledAddrs = new Set(enabled.map((t) => t.address));
    const sum = enabled.reduce((s, t) => s + (traderWeights[t.address] || 0), 0);
    if (sum <= 0) { equalizeWeights(); return; }
    const newWeights: Record<string, number> = {};
    let assigned = 0;
    let ei = 0;
    const traders = activeIndex.traders.map((t) => {
      if (!enabledAddrs.has(t.address)) {
        newWeights[t.address] = 0;
        return { ...t, weight: 0 };
      }
      const raw = traderWeights[t.address] || 0;
      const w = ei < enabled.length - 1
        ? Math.round((raw / sum) * 100)
        : 100 - assigned;
      assigned += w;
      ei++;
      newWeights[t.address] = w;
      return { ...t, weight: w / 100 };
    });
    setTraderWeights(newWeights);
    persistIndex({ ...activeIndex, traders });
  };

  // ── Backtest days (persist to strategy) ──
  const updateBacktestDays = (days: number) => {
    setBacktestDays(days);
    if (activeIndex) {
      updateIndex(activeIndex.id, { backtestDays: days, updatedAt: Date.now() });
    }
  };

  const handleCustomDays = (val: string) => {
    setCustomDaysInput(val);
    const n = parseInt(val, 10);
    if (n > 0 && n <= 365) {
      updateBacktestDays(n);
    }
  };

  // ── Capital (persist to strategy) ──
  const capitalLabel = capital >= 1000 ? `$${Math.round(capital / 1000)}K` : `$${capital}`;
  const updateCapital = (amt: number) => {
    const clamped = Math.max(1, Math.round(amt));
    setCapital(clamped);
    if (activeIndex) {
      updateIndex(activeIndex.id, { capital: clamped, updatedAt: Date.now() });
    }
  };
  const capitalPresets = [1000, 5000, 10000, 50000];

  // ── Trade size limits (persist to strategy) ──
  const updateMinTrade = (amt: number) => {
    const clamped = Math.max(0, amt);
    setMinTrade(clamped);
    if (activeIndex) {
      updateIndex(activeIndex.id, { minTrade: clamped, updatedAt: Date.now() });
    }
  };

  const updateMaxTrade = (amt: number) => {
    const clamped = Math.max(1, amt);
    setMaxTrade(clamped);
    if (activeIndex) {
      updateIndex(activeIndex.id, { maxTrade: clamped, updatedAt: Date.now() });
    }
  };

  const updateMaxTradesPerHour = (max: number) => {
    const clamped = Math.max(1, max);
    setMaxTradesPerHour(clamped);
    if (activeIndex) {
      updateIndex(activeIndex.id, { maxTradesPerHour: clamped, updatedAt: Date.now() });
    }
  };

  // ── Poll interval (persist to strategy) ──
  const updateRebalanceMinutes = (minutes: number) => {
    setRebalanceMinutes(minutes);
    if (activeIndex) {
      updateIndex(activeIndex.id, { rebalanceMinutes: minutes, updatedAt: Date.now() });
    }
  };

  // ── Data fetching ──
  const fetchAll = useCallback(async (addresses: string[]) => {
    if (addresses.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadedCount(0);

    const cutoffSec = Math.floor((Date.now() - 90 * 86400_000) / 1000);
    let done = 0;
    const promises = addresses.map(async (addr) => {
      try {
        const [positions, trades] = await Promise.all([
          fetchPositions(addr),
          fetchWalletTradesUntil(addr, cutoffSec, undefined, 2000),
        ]);
        done++;
        setLoadedCount(done);
        return { addr, positions, trades };
      } catch {
        done++;
        setLoadedCount(done);
        return { addr, positions: [] as PolymarketPosition[], trades: [] as PolymarketTrade[] };
      }
    });

    await Promise.allSettled(
      promises.map(async (p) => {
        const result = await p;
        setTraderData((prev) => {
          const next = new Map(prev);
          next.set(result.addr, result.positions);
          return next;
        });
        setTraderTrades((prev) => {
          const next = new Map(prev);
          next.set(result.addr, result.trades);
          return next;
        });
        return result;
      }),
    );

    setLoading(false);
  }, []);

  // Re-fetch when watchlist addresses actually change or when manually refreshed
  useEffect(() => {
    if (watchlist.length === 0) {
      setLoading(false);
      return;
    }
    fetchAll(watchlist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistKey, refreshKey]);

  // Listen for external strategy updates (e.g. trader added from the leaderboard)
  useEffect(() => {
    const handler = () => {
      const indexes = loadIndexes();
      setSavedIndexes(indexes);
      const aid = getActiveIndexId();
      const found = aid ? indexes.find((i) => i.id === aid) : indexes[0];
      if (found) {
        setActiveIndex(found);
        const current = new Set(watchlist);
        const newAddrs = found.traders.map((t) => t.address).filter((a) => !current.has(a));
        if (newAddrs.length > 0) fetchAll(newAddrs);
      }
    };
    window.addEventListener("strat-updated", handler);
    return () => window.removeEventListener("strat-updated", handler);
  }, [watchlist, fetchAll]);

  // ── Add / remove traders (auto-equalize weights) ──
  const addTrader = (addr: string) => {
    if (!activeIndex) return;
    if (activeIndex.traders.some((t) => t.address === addr)) return;
    const n = activeIndex.traders.length + 1;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    const newWeights: Record<string, number> = {};
    const traders = [...activeIndex.traders, { address: addr, weight: 0 }].map((t, i) => {
      const w = base + (i < remainder ? 1 : 0);
      newWeights[t.address] = w;
      return { ...t, weight: w / 100 };
    });
    setTraderWeights((prev) => ({ ...prev, ...newWeights }));
    persistIndex({ ...activeIndex, traders });
    fetchAll([addr]);
  };

  const removeTrader = (addr: string) => {
    if (!activeIndex) return;
    const remaining = activeIndex.traders.filter((t) => t.address !== addr);
    // Re-normalize remaining weights
    if (remaining.length > 0) {
      const sum = remaining.reduce((s, t) => s + (traderWeights[t.address] || 0), 0);
      const newWeights: Record<string, number> = {};
      let assigned = 0;
      const traders = remaining.map((t, i) => {
        const raw = traderWeights[t.address] || 0;
        const w = sum > 0
          ? (i < remaining.length - 1 ? Math.round((raw / sum) * 100) : 100 - assigned)
          : Math.floor(100 / remaining.length) + (i < 100 % remaining.length ? 1 : 0);
        assigned += w;
        newWeights[t.address] = w;
        return { ...t, weight: w / 100 };
      });
      setTraderWeights(newWeights);
      persistIndex({ ...activeIndex, traders });
    } else {
      setTraderWeights({});
      persistIndex({ ...activeIndex, traders: [] });
    }
    setTraderData((prev) => { const m = new Map(prev); m.delete(addr); return m; });
    setTraderTrades((prev) => { const m = new Map(prev); m.delete(addr); return m; });
  };

  const toggleTrader = (addr: string) => {
    if (!activeIndex) return;
    const traders = activeIndex.traders.map((t) =>
      t.address === addr ? { ...t, enabled: t.enabled === false ? true : false } : t
    );
    persistIndex({ ...activeIndex, traders });
  };

  const goToTrader = (addr: string) => {
    router.push(`/traders/${addr}${filterQs ? `?${filterQs}` : ""}`);
  };


  // ── Backtests ──
  const backtests = useMemo((): TraderBacktest[] => {
    return watchlist.map((addr) => {
      const trades = traderTrades.get(addr) || [];
      const positions = traderData.get(addr) || [];
      return computeBacktest(trades, positions, backtestDays, addr, capital, rebalancePeriod, rebalanceHour);
    }).sort((a, b) => b.estimatedPnl - a.estimatedPnl);
  }, [watchlist, traderTrades, traderData, backtestDays, capital, rebalancePeriod, rebalanceHour]);

  const totalBacktestPnl = backtests.reduce((s, b) => s + b.estimatedPnl, 0);
  // Only sum weights of enabled traders
  const enabledSet = new Set(watchlist);
  const totalWeight = Object.entries(traderWeights)
    .filter(([addr]) => enabledSet.has(addr))
    .reduce((s, [, w]) => s + w, 0);

  // Aggregate fee/gas totals (already scaled to $1K copy per trader)
  const totalFees = backtests.reduce((s, b) => s + b.totalFees, 0);
  const totalGas = backtests.reduce((s, b) => s + b.totalGas, 0);
  const totalCosts = totalFees + totalGas;
  const totalTradeCount = backtests.reduce((s, b) => s + b.trades, 0);
  const totalScaledPnl = backtests.reduce((s, b) => s + b.pnlAfterCosts + b.totalFees + b.totalGas, 0);

  // Fee burden: what % of scaled gross PnL is eaten by fees
  const feeBurdenPct = totalScaledPnl > 0 ? (totalCosts / totalScaledPnl) * 100 : 0;
  const feesExceedPnl = totalScaledPnl > 0 && totalCosts > totalScaledPnl;
  const feesWarning = feeBurdenPct > 50 || feesExceedPnl || (totalScaledPnl <= 0 && totalCosts > 5);

  // Weighted gross PnL (raw, trader-scale — for display)
  const weightedBacktestPnl = useMemo(() => {
    if (totalWeight <= 0) return totalBacktestPnl;
    return backtests.reduce((s, bt) => {
      const w = (traderWeights[bt.address] || 0) / totalWeight;
      return s + bt.estimatedPnl * w;
    }, 0);
  }, [backtests, traderWeights, totalWeight, totalBacktestPnl]);

  // Weighted net PnL after costs (scaled to $1K)
  const weightedPnlAfterCosts = useMemo(() => {
    if (totalWeight <= 0) return backtests.reduce((s, b) => s + b.pnlAfterCosts, 0);
    return backtests.reduce((s, bt) => {
      const w = (traderWeights[bt.address] || 0) / totalWeight;
      return s + bt.pnlAfterCosts * w;
    }, 0);
  }, [backtests, traderWeights, totalWeight]);

  // ROI per trader as percentage of the capital allocated to this trader.
  // pnlAfterCosts is already scaled to user capital, so ROI% = pnl / capital * 100.
  const roiPerTrader = (bt: TraderBacktest) => capital > 0 ? (bt.pnlAfterCosts / capital) * 100 : 0;
  const tradersWithBuys = backtests.filter((bt) => bt.buyVolume > 0);
  // Combined ROI (%): weighted P&L over total capital, expressed as percent
  const combinedRoi1k = useMemo(() => {
    if (tradersWithBuys.length === 0 || capital <= 0) return 0;
    if (totalWeight <= 0) {
      // Equal weight: average of per-trader ROI%
      return tradersWithBuys.reduce((s, bt) => s + (bt.pnlAfterCosts / capital) * 100, 0) / tradersWithBuys.length;
    }
    return tradersWithBuys.reduce((s, bt) => {
      const w = (traderWeights[bt.address] || 0) / totalWeight;
      return s + ((bt.pnlAfterCosts / capital) * 100) * w;
    }, 0);
  }, [tradersWithBuys, traderWeights, totalWeight, capital]);

  // ── Combined FIFO PnL curve (scaled to user's capital) ──
  const combinedCurveData = useMemo((): { combined: CurvePoint[]; perTrader: { address: string; points: CurvePoint[]; weight: number }[] } => {
    if (watchlist.length === 0 || loading) return { combined: [], perTrader: [] };
    const cutoffMs = Date.now() - backtestDays * 24 * 60 * 60 * 1000;
    const traderCurves: { address: string; points: CurvePoint[]; weight: number }[] = [];

    for (const addr of watchlist) {
      const rawTrades = traderTrades.get(addr) || [];
      const positions = traderData.get(addr) || [];
      if (rawTrades.length === 0) continue;

      const replayTradesRaw = rebalancePeriod > 0
        ? aggregateToRebalanceWindows(rawTrades, rebalancePeriod, rebalanceHour)
        : rawTrades;
      // Apply SAMPLE % only to in-window trades — pre-window trades stay
      // intact so FIFO basis tracking still sees the prior inventory.
      const replayTrades = samplePct >= 100
        ? replayTradesRaw
        : replayTradesRaw.filter((t, i) =>
            t.timestamp < cutoffMs ||
            keepInSample(samplePct, `${addr}:${t.timestamp}:${i}`),
          );
      const annotated = computeFifoTrades(replayTrades, positions, cutoffMs);
      const curve = buildPnlCurve(annotated, positions, cutoffMs);
      if (curve.length === 0) continue;

      // Scale PnL curve to user's capital allocation for this trader.
      // Use max(buyVol, sellVol) as denominator — prevents amplification when
      // a trader mostly sells old positions in the window (tiny buyVol but huge PnL).
      const wFrac = totalWeight > 0 ? (traderWeights[addr] || 0) / totalWeight : 1 / watchlist.length;
      const windowTrades = replayTrades.filter((t) => t.timestamp >= cutoffMs);
      const buyVol = windowTrades.filter((t) => t.side === "BUY").reduce((s, t) => s + t.price * t.size, 0);
      const sellVol = windowTrades.filter((t) => t.side === "SELL").reduce((s, t) => s + t.price * t.size, 0);
      const traderVol = Math.max(buyVol, sellVol, 1);
      const capitalScale = (capital * wFrac) / traderVol;
      traderCurves.push({ address: addr, points: curve, weight: capitalScale });
    }

    return { combined: buildCombinedPnlCurve(traderCurves), perTrader: traderCurves };
  }, [watchlist, traderTrades, traderData, backtestDays, traderWeights, totalWeight, capital, loading, rebalancePeriod, rebalanceHour, samplePct]);

  const combinedPnlCurve = combinedCurveData.combined;

  // Chart-derived summary numbers. `weightedPnlAfterCosts` / `combinedRoi1k`
  // use cashflow-only `estimatedPnl = sellVol - buyVol`, which under-reports
  // performance whenever the window has more buys than sells (those buys are
  // open positions with MTM value that the chart picks up but the cashflow
  // proxy doesn't). Header + snapshot now match the curve.
  const chartGrossPnl = combinedPnlCurve.length > 0
    ? combinedPnlCurve[combinedPnlCurve.length - 1].pnl
    : 0;
  const chartNetPnl = chartGrossPnl - totalCosts;
  const chartRoi = capital > 0 ? (chartNetPnl / capital) * 100 : 0;

  // ── Persist backtest snapshot to SavedIndex for leaderboard ──
  // (Moved below combinedPnlCurve so it can reference chart-derived values.)
  useEffect(() => {
    if (!activeIndex || backtests.length === 0 || loading) return;
    const snap = {
      lastPnl: Math.round(chartGrossPnl * 100) / 100,
      lastPnlAfterCosts: Math.round(chartNetPnl * 100) / 100,
      lastRoi1k: Math.round(chartRoi * 100) / 100,
      lastTradeCount: totalTradeCount,
      lastBacktestAt: Date.now(),
    };
    updateIndex(activeIndex.id, snap);
  }, [activeIndex, chartGrossPnl, chartNetPnl, chartRoi, totalTradeCount, loading, backtests.length]);

  // Per-trader scaled MTM P&L from curves (consistent with chart)
  const traderCurvePnl = useMemo(() => {
    const map = new Map<string, number>();
    for (const tc of combinedCurveData.perTrader) {
      if (tc.points.length === 0) continue;
      const lastPnl = tc.points[tc.points.length - 1].pnl;
      map.set(tc.address, Math.round(lastPnl * tc.weight * 100) / 100);
    }
    return map;
  }, [combinedCurveData]);

  // ── Linked trades: every trade with its running P&L impact ──
  interface LinkedTrade {
    ts: number;
    market: string;
    trader: string;
    side: "BUY" | "SELL";
    amount: number;       // scaled to user capital ($)
    price: number;        // trade price (0-1)
    fee: number;          // trading fee ($)
    realized: number;     // realized PnL on SELL (scaled)
    runningPnl: number;   // combined running P&L after this trade
    pnlDelta: number;     // change in P&L from previous trade
  }

  const linkedTrades = useMemo((): LinkedTrade[] => {
    if (watchlist.length === 0 || loading) return [];
    const cutoffMs = Date.now() - backtestDays * 86400_000;

    // Build from raw trades directly (not curve points) to use conditionId for filtering
    type RawEntry = {
      ts: number; market: string; conditionId: string; trader: string;
      side: "BUY" | "SELL"; size: number; price: number; realized: number; scale: number;
    };
    const allEntries: RawEntry[] = [];

    for (const addr of watchlist) {
      const rawTrades = traderTrades.get(addr) || [];
      const positions = traderData.get(addr) || [];
      if (rawTrades.length === 0) continue;

      const replayTrades = rebalancePeriod > 0
        ? aggregateToRebalanceWindows(rawTrades, rebalancePeriod, rebalanceHour)
        : rawTrades;
      // Strict-in-window FIFO: a copy-trader starting at cutoffMs has no
      // pre-window inventory, so SELLs that would consume pre-window basis
      // shouldn't appear in the feed (they're not actually replicable).
      const inWindowAll = replayTrades.filter((t) => t.timestamp >= cutoffMs);
      // Apply SAMPLE % so the feed matches the chart's sampled trade set.
      const inWindowTrades = samplePct >= 100
        ? inWindowAll
        : inWindowAll.filter((t, i) =>
            keepInSample(samplePct, `${addr}:${t.timestamp}:${i}`),
          );
      if (inWindowTrades.length === 0) continue;
      const annotated = computeFifoTrades(inWindowTrades, positions, cutoffMs);
      const windowAnnotated = annotated.filter((t) => t.side === "BUY" || t.hasBasis);
      if (windowAnnotated.length === 0) continue;

      const wFrac = totalWeight > 0 ? (traderWeights[addr] || 0) / totalWeight : 1 / watchlist.length;
      const buyVol = windowAnnotated.filter((t) => t.side === "BUY").reduce((s, t) => s + t.price * t.size, 0);
      const sellVol = windowAnnotated.filter((t) => t.side === "SELL").reduce((s, t) => s + t.price * t.size, 0);
      const traderVol = Math.max(buyVol, sellVol, 1);
      const scale = (capital * wFrac) / traderVol;

      for (const t of windowAnnotated) {
        allEntries.push({
          ts: t.timestamp, market: t.market, conditionId: t.conditionId || t.market,
          trader: addr, side: t.side, size: t.size, price: t.price,
          realized: t.realized, scale,
        });
      }
    }

    allEntries.sort((a, b) => a.ts - b.ts);

    // Compute derived fields per trade (no running P&L yet — that comes after filters)
    const derived = allEntries.map((t) => {
      const realizedScaled = t.side === "SELL" ? Math.round(t.realized * t.scale * 100) / 100 : 0;
      const amount = Math.round(t.price * t.size * t.scale * 100) / 100;
      const scaledShares = t.price > 0 ? amount / t.price : 0;
      const fee = Math.round(scaledShares * Math.min(t.price, 1 - t.price) * (TAKER_FEE_BPS / 10_000) * 100) / 100;
      return {
        ts: t.ts,
        market: t.market,
        trader: t.trader,
        side: t.side,
        amount,
        price: t.price,
        fee,
        realized: realizedScaled,
        pnlDelta: realizedScaled,
      };
    });

    // Show every trade that contributes to the chart's P&L — no size/per-hour gating here.
    let runningPnl = 0;
    return derived.map((t) => {
      runningPnl = Math.round((runningPnl + t.realized) * 100) / 100;
      return { ...t, runningPnl };
    });
  }, [watchlist, traderTrades, traderData, backtestDays, traderWeights, totalWeight, capital, loading, rebalancePeriod, rebalanceHour, samplePct]);

  // ── Chart ↔ Trade feed hover linking ──
  const [chartHighlight, setChartHighlight] = useState<number | null>(null);
  const [tradeHighlight, setTradeHighlight] = useState<number | null>(null);
  const [indexTradeLimit, setIndexTradeLimit] = useState(100);
  const [feedOrder, setFeedOrder] = useState<"newest" | "oldest">("newest");

  const findCurveIdx = useCallback((ts: number): number | null => {
    if (combinedPnlCurve.length === 0) return null;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < combinedPnlCurve.length; i++) {
      const d = Math.abs(combinedPnlCurve[i].ts - ts);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [combinedPnlCurve]);

  const handleChartHover = useCallback((idx: number | null) => {
    if (idx === null || combinedPnlCurve.length === 0 || linkedTrades.length === 0) {
      setTradeHighlight(null);
      return;
    }
    const ts = combinedPnlCurve[idx].ts;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < linkedTrades.length; i++) {
      const d = Math.abs(linkedTrades[i].ts - ts);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    setTradeHighlight(best);
  }, [combinedPnlCurve, linkedTrades]);

  // ── Backtest date range ──
  const backtestDateRange = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.now() - backtestDays * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return { from: fmt(from), to: fmt(now) };
  }, [backtestDays]);

  // ── Trader summaries (all traders including hidden, for editor panel) ──
  const traderSummaries: (TraderSummary & { enabled: boolean })[] = useMemo(() => {
    return allTraderAddrs.map((addr) => {
      const positions = traderData.get(addr) || [];
      const q = searchFilter.trim().toLowerCase();
      const filtered = q ? positions.filter((p) => p.market.toLowerCase().includes(q)) : positions;
      const isEnabled = activeIndex?.traders.find((t) => t.address === addr)?.enabled !== false;
      return {
        address: addr,
        positions: positions.length,
        filteredPositions: filtered.length,
        totalPnl: filtered.reduce((s, p) => s + p.pnlUsd, 0),
        loaded: traderData.has(addr),
        enabled: isEnabled,
      };
    });
  }, [allTraderAddrs, traderData, searchFilter, activeIndex]);


  // ══════════════════════════════════════════
  // ── RENDER ──
  // ══════════════════════════════════════════

  return (
    <div className="space-y-2">
      {/* ── Header: key + tabs + close ── */}
      <div className="pixel-panel px-3 py-2 space-y-2">
        {/* Key + token row — KEY is the connected wallet's 0x address (the
            identity that signs the CLOB EIP-712 auth + is recovered by the
            backend), TOKEN is the local strat-encryption preview. */}
        <div className="flex items-center justify-between gap-2">
          {auth.address || localToken ? (
            <div className="flex items-center gap-3 text-[16px] font-mono min-w-0 flex-1">
              {localToken && (
                <div className="flex items-center gap-1.5 shrink-0 px-1.5 py-0.5 border border-green-400/40 bg-green-400/5">
                  <div className="w-1.5 h-1.5 bg-green-400" />
                  <span className="text-pixel-gray text-[14px]">TOKEN</span>
                  <span className="text-green-400">{localToken.tokenPreview}</span>
                </div>
              )}
              <span className="text-pixel-gray shrink-0">KEY</span>
              {auth.address ? (
                <span
                  className={`truncate ${auth.authenticated ? "text-green-400" : "text-amber-400"}`}
                  title={auth.authenticated ? "Wallet signed for CLOB" : "Wallet connected — not yet signed for CLOB"}
                >
                  {auth.address}
                </span>
              ) : (
                <span className="text-pixel-gray truncate">NOT CONNECTED</span>
              )}
            </div>
          ) : (
            <span className="text-[16px] text-pixel-gray tracking-wider font-mono">NO KEY</span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="pixel-btn text-[15px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white shrink-0 ml-2"
              title="Close"
            >
              X
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 border-t border-pixel-border/40 pt-2">
          {(
            [
              { id: "STRATS", label: "STRATS", disabled: false },
              { id: "BACKTEST", label: "BACKTEST", disabled: watchlist.length === 0 },
              { id: "LIVE", label: "LIVE", disabled: watchlist.length === 0 },
            ] as { id: typeof mode; label: string; disabled: boolean }[]
          ).map((t) => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                disabled={t.disabled}
                style={{ fontFamily: '"Press Start 2P", monospace', letterSpacing: "0.08em" }}
                className={`relative text-[15px] px-4 py-2 transition-all uppercase ${
                  active
                    ? "text-green-400"
                    : "text-pixel-gray hover:text-pixel-white"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {t.label}
                <span
                  className={`absolute left-2 right-2 -bottom-0.5 h-[3px] transition-all ${
                    active ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Wallet/funding (always visible on STRATS tab) ── */}
      {mode === "STRATS" && <WalletFundingPanel />}

      {/* ── Strat Leaderboard (full picker on STRATS tab only) ── */}
      {mode === "STRATS" && <StratPicker onStratChange={() => setRefreshKey((v) => v + 1)} />}

      {/* ── Compact active-strat header (non-STRATS tabs) ── */}
      {mode !== "STRATS" && activeIndex && (
        <div className="pixel-panel px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[14px] text-pixel-gray tracking-wider shrink-0">STRAT</span>
            <div className="w-2 h-2 bg-green-400 shrink-0" />
            <span className="text-[15px] font-mono text-green-400 font-bold truncate">{activeIndex.name}</span>
            <span className="text-[15px] text-pixel-gray shrink-0">{activeIndex.traders.length}T</span>
            {activeIndex.lastPnlAfterCosts !== undefined && (
              <span className={`text-[15px] font-mono shrink-0 ${activeIndex.lastPnlAfterCosts >= 0 ? "text-green-400" : "text-red-400"}`}>
                {activeIndex.lastPnlAfterCosts >= 0 ? "+" : ""}${activeIndex.lastPnlAfterCosts.toFixed(0)}
              </span>
            )}
          </div>
          <button
            onClick={() => setMode("STRATS")}
            className="text-[14px] text-pixel-gray hover:text-green-400 transition-colors px-2 py-1 border border-pixel-border hover:border-green-400 font-mono shrink-0"
            title="Switch strat"
          >
            CHANGE →
          </button>
        </div>
      )}

      {/* ── Add trader bar (STRATS + BACKTEST only) ── */}
      {(mode === "STRATS" || mode === "BACKTEST") && (
        <div className="pixel-panel px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AddTraderBar watchlist={watchlist} onAdd={addTrader} />
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[13px] font-mono">
              {loading && (
                <span className="text-[12px] text-green-400 animate-pulse">
                  {loadedCount}/{watchlist.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Trader editor panel (STRATS tab only) ── */}
      {mode === "STRATS" && allTraderAddrs.length > 0 && (
        <div className="pixel-panel px-3 py-2 space-y-1">
          {/* Toolbar: count + actions + weight sum */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-pixel-gray tracking-wider">{watchlist.length}/{allTraderAddrs.length} ACTIVE</span>
              <button
                onClick={equalizeWeights}
                className="pixel-btn text-[13px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-green-400 hover:border-green-400 transition-colors"
                title="Equalize all weights"
              >
                EQ
              </button>
              {totalWeight !== 100 && totalWeight > 0 && (
                <button
                  onClick={normalizeWeights}
                  className="pixel-btn text-[13px] px-2 py-1 border-amber-400/60 text-amber-400 hover:bg-amber-400/10 transition-colors"
                  title="Normalize weights to 100%"
                >
                  NORM
                </button>
              )}
            </div>
            <span className={`text-[15px] font-mono ${
              totalWeight === 100 ? "text-pixel-gray" : totalWeight > 0 ? "text-amber-400" : "text-pixel-gray"
            }`}>
              {totalWeight}%
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center text-[12px] text-pixel-gray tracking-wider px-0.5 border-t border-pixel-border pt-1">
            <span className="w-5 shrink-0" />
            <span className="w-5 shrink-0" />
            <span className="flex-1">ADDRESS</span>
            <span className="w-16 text-right">P&L</span>
            <span className="flex-1 text-center">WEIGHT</span>
            <span className="w-5" />
          </div>

          {/* Trader rows */}
          <div className="space-y-0">
            {traderSummaries.map((t, i) => {
              const curvePnl = traderCurvePnl.get(t.address);
              const displayPnl = curvePnl ?? t.totalPnl;
              const pnlColor = displayPnl > 0 ? "text-green-400"
                : displayPnl < 0 ? "text-red-400" : "text-pixel-gray-light";
              const w = traderWeights[t.address] || 0;
              return (
                <div key={t.address} className={`flex items-center gap-0.5 px-0.5 py-1 hover:bg-pixel-white/5 transition-colors group border-b border-pixel-border/20 last:border-b-0 ${t.enabled ? "" : "opacity-40"}`}>
                  {/* Toggle enabled/disabled */}
                  <button
                    onClick={() => toggleTrader(t.address)}
                    className="w-4 shrink-0 flex items-center justify-center"
                    title={t.enabled ? "Hide trader" : "Show trader"}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${t.enabled ? "bg-green-400" : "bg-pixel-gray"}`} />
                  </button>
                  <span className="text-[12px] text-pixel-gray font-mono w-5 shrink-0 text-center">{i + 1}</span>
                  <button
                    onClick={() => goToTrader(t.address)}
                    className="flex-1 text-left text-[15px] font-mono text-pixel-white hover:text-green-400 transition-colors truncate"
                  >
                    {shortAddress(t.address)}
                  </button>
                  <span className={`w-16 text-right text-[15px] font-mono ${pnlColor}`}>
                    {curvePnl !== undefined ? formatPnl(curvePnl) : t.loaded ? formatPnl(t.totalPnl) : "..."}
                  </span>
                  {/* Weight slider + value */}
                  <div className="flex-1 flex items-center gap-1 px-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={w}
                      onChange={(e) => updateWeight(t.address, parseInt(e.target.value, 10))}
                      className="flex-1 h-[4px] appearance-none bg-pixel-border rounded cursor-grab accent-green-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:cursor-grab"
                    />
                    <span className="text-[14px] font-mono text-pixel-gray w-9 text-right shrink-0">{w}%</span>
                  </div>
                  <button
                    onClick={() => removeTrader(t.address)}
                    className="w-5 text-center text-[13px] text-pixel-gray hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove trader"
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active view ── */}
      {activeIndex && (
        <>
          {/* Empty trader state */}
          {watchlist.length === 0 && (
            <div className="pixel-panel p-4 text-center space-y-2">
              <div className="text-[14px] text-pixel-gray">NO TRADERS YET</div>
              <div className="text-[12px] text-pixel-gray-light">
                ADD TRADERS ABOVE OR FROM THE{" "}
                <button onClick={() => router.push("/traders")} className="text-pixel-white hover:text-green-400 transition-colors">
                  TRADERS
                </button>{" "}TAB.
              </div>
            </div>
          )}

          {/* ── Backtest panel ── */}
          {watchlist.length > 0 && mode === "BACKTEST" && (
            <div className="pixel-panel px-3 py-2.5 space-y-3">
              {/* ── Row 1: title + date range · RUN · P&L stats ─────── */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-[14px] text-pixel-white tracking-[0.2em]">BACKTEST</span>
                  <span className="text-[12px] text-pixel-gray/70 font-mono tracking-wider">
                    {backtestDateRange.from} → {backtestDateRange.to}
                  </span>
                  <button
                    onClick={() => {
                      const v = parseInt(backtestDaysInput, 10);
                      if (!isNaN(v) && v > 0 && v <= 365) updateBacktestDays(v);
                      setRefreshKey((k) => k + 1);
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-mono tracking-[0.15em] px-3 h-[24px] border border-green-400 text-green-400 hover:bg-green-400/10 active:bg-green-400/20 transition-colors"
                    title="Run backtest with current settings"
                  >
                    ▶ RUN
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[13px] font-mono">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[12px] text-pixel-gray tracking-[0.15em]">P&L</span>
                    <span className={chartNetPnl >= 0 ? "text-green-400" : "text-red-400"}>
                      {formatPnl(chartNetPnl)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[12px] text-pixel-gray tracking-[0.15em]">ROI</span>
                    <span className={chartRoi >= 0 ? "text-green-400" : "text-red-400"}>
                      {chartRoi >= 0 ? "+" : ""}{chartRoi.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Row 2: labeled field cards for parameters ───────── */}
              <div className="flex items-end gap-2 flex-wrap">
                <Field label="WINDOW" suffix="DAYS">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={backtestDaysInput}
                    onChange={(e) => setBacktestDaysInput(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(backtestDaysInput, 10);
                      if (!isNaN(v) && v > 0 && v <= 365) {
                        updateBacktestDays(v);
                        setBacktestDaysInput(String(v));
                      } else {
                        setBacktestDaysInput(String(backtestDays));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseInt(backtestDaysInput, 10);
                        if (!isNaN(v) && v > 0 && v <= 365) {
                          updateBacktestDays(v);
                          setRefreshKey((k) => k + 1);
                        }
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent w-10 text-right font-mono text-[14px] text-pixel-white outline-none"
                  />
                </Field>

                <Field label="CAPITAL" prefix="$">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={capital}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(v) && v > 0) updateCapital(v);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent w-16 text-right font-mono text-[14px] text-pixel-white outline-none"
                  />
                </Field>

                <Field label="TRADE SIZE" prefix="$">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minTrade}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(v) && v >= 0) updateMinTrade(v);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent w-10 text-right font-mono text-[14px] text-pixel-white outline-none"
                  />
                  <span className="text-pixel-gray/60 mx-0.5">–</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxTrade}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(v) && v > 0) updateMaxTrade(v);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent w-10 text-right font-mono text-[14px] text-pixel-white outline-none"
                  />
                </Field>

                <Field label="THROTTLE" suffix="/HR">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxTradesPerHour}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(v) && v > 0) updateMaxTradesPerHour(v);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent w-8 text-right font-mono text-[14px] text-pixel-white outline-none"
                  />
                </Field>

                <Field label="SAMPLE" suffix="%">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={samplePct}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(v) && v >= 1 && v <= 100) setSamplePct(v);
                      else if (e.target.value === "") setSamplePct(1);
                    }}
                    onFocus={(e) => e.target.select()}
                    title="Deterministically keep this % of in-window trades — the curve, feed, and stats all update."
                    className="bg-transparent w-8 text-right font-mono text-[14px] text-pixel-white outline-none"
                  />
                </Field>
              </div>

              {/* ── Row 3: live poll interval ────────────────────────
                  Backtest is always per-trade replay now (matches live).
                  The REBALANCE/AT selects were removed — they conflated
                  position-rebalancing with trade-mirroring. */}
              <div className="flex items-end gap-2 flex-wrap">
                <Field label="POLL INTERVAL">
                  <select
                    value={rebalanceMinutes}
                    onChange={(e) => updateRebalanceMinutes(Number(e.target.value))}
                    className="bg-transparent font-mono text-[13px] text-pixel-white outline-none cursor-pointer pr-1"
                  >
                    <option value={1}>1MIN</option>
                    <option value={2}>2MIN</option>
                    <option value={5}>5MIN</option>
                    <option value={10}>10MIN</option>
                    <option value={15}>15MIN</option>
                    <option value={60}>1H</option>
                    <option value={240}>4H</option>
                    <option value={1440}>24H</option>
                  </select>
                </Field>
              </div>

              {/* Fee/gas cost summary — derived from linkedTrades + chart for consistency */}
              {(() => {
                const feedFees = linkedTrades.reduce((s, t) => s + t.fee, 0);
                const feedGas = linkedTrades.length * GAS_PER_TRADE_USD;
                const feedCosts = feedFees + feedGas;
                const chartPnl = combinedPnlCurve.length > 0 ? combinedPnlCurve[combinedPnlCurve.length - 1].pnl : 0;
                const feedPnl = linkedTrades.length > 0 ? linkedTrades[linkedTrades.length - 1].runningPnl : 0;
                const grossPnl = chartPnl || feedPnl;
                const netPnl = grossPnl - feedCosts;
                const costWarning = feedCosts > 5 && (grossPnl <= 0 || feedCosts > grossPnl * 0.5);
                return (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-3 text-[13px] font-mono border-t border-pixel-border/40 pt-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] text-pixel-gray tracking-[0.15em]">FEES</span>
                          <span className="text-amber-400">${feedFees.toFixed(2)}</span>
                        </div>
                        <span className="text-pixel-border/60">·</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] text-pixel-gray tracking-[0.15em]">GAS</span>
                          <span className="text-amber-400">${feedGas.toFixed(2)}</span>
                        </div>
                        <span className="text-pixel-border/60">·</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] text-pixel-gray tracking-[0.15em]">TOTAL</span>
                          <span className="text-amber-400">${feedCosts.toFixed(2)}</span>
                          <span className="text-[12px] text-pixel-gray/70">({linkedTrades.length} TXS)</span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12px] text-pixel-gray tracking-[0.15em]">GROSS</span>
                        <span className={grossPnl >= 0 ? "text-green-400/70" : "text-red-400/70"}>
                          {formatPnl(grossPnl)}
                        </span>
                      </div>
                    </div>

                    {costWarning && !loading && (
                      <div className="px-3 py-2 border border-amber-400/40 bg-amber-400/5">
                        <div className="text-[13px] text-amber-400 font-mono">
                          {feedCosts > grossPnl && grossPnl > 0
                            ? `FEES ($${feedCosts.toFixed(0)}) EXCEED GROSS P&L (${formatPnl(grossPnl)}) — COPYING ${watchlist.length} TRADERS AT ${linkedTrades.length} TXS IS UNPROFITABLE AFTER COSTS`
                            : grossPnl <= 0
                              ? `STRAT IS NEGATIVE AND INCURS $${feedCosts.toFixed(0)} IN FEES/GAS ACROSS ${linkedTrades.length} TXS`
                              : `FEES CONSUME ${Math.round((feedCosts / grossPnl) * 100)}% OF GROSS PROFIT — CONSIDER FEWER TRADERS OR HIGHER-CONVICTION PICKS`
                          }
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* PnL chart */}
              <div ref={chartPanelRef}>
              {combinedPnlCurve.length >= 2 ? (
                <PnlChart
                  points={combinedPnlCurve}
                  dayLabel={`${backtestDays}D INDEX`}
                  tradesInWindow={combinedPnlCurve.filter((p) => p.side !== "MARK").map((p) => ({ timestamp: p.ts }))}
                  highlightIndex={chartHighlight}
                  onHoverChange={handleChartHover}
                  linkedTrades={linkedTrades}
                  shortAddress={shortAddress}
                />
              ) : !loading && watchlist.length > 0 ? (
                <div className="p-6 text-center">
                  <span className="text-[13px] text-pixel-gray">NOT ENOUGH TRADE DATA FOR PNL CURVE</span>
                </div>
              ) : loading ? (
                <div className="p-6 text-center">
                  <span className="text-[13px] text-pixel-gray animate-pulse">LOADING...</span>
                </div>
              ) : null}
              </div>
            </div>
          )}

          {/* ── Trade feed — every trade with its P&L impact, linked to chart ── */}
          {mode === "BACKTEST" && (() => {
            const ordered = feedOrder === "newest" ? [...linkedTrades].reverse() : linkedTrades;
            const finalPnl = linkedTrades.length > 0 ? linkedTrades[linkedTrades.length - 1].runningPnl : 0;
            const n = linkedTrades.length;

            return (
              <div className="pixel-panel overflow-hidden">
                <div className="px-4 py-2.5 border-b-2 border-pixel-border flex items-center justify-between">
                  <span className="text-[14px] text-pixel-gray-light tracking-wider">TRADE FEED</span>
                  <div className="flex items-center gap-3 text-[13px] font-mono">
                    <span className="text-pixel-gray">{linkedTrades.length} TRADES</span>
                    {linkedTrades.length > 0 && (
                      <span className={finalPnl >= 0 ? "text-green-400" : "text-red-400"}>
                        {finalPnl >= 0 ? "+" : ""}${finalPnl.toFixed(2)}
                      </span>
                    )}
                    <button
                      onClick={() => setFeedOrder((o) => (o === "newest" ? "oldest" : "newest"))}
                      className="pixel-btn text-[13px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-green-400 hover:border-green-400 transition-colors"
                      title="Toggle sort order"
                    >
                      {feedOrder === "newest" ? "NEW→OLD" : "OLD→NEW"}
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="p-8 text-center">
                    <div className="text-[14px] text-pixel-white animate-pulse">LOADING...</div>
                  </div>
                ) : linkedTrades.length > 0 ? (
                  <>
                    <div className="overflow-auto max-h-[480px]">
                      <table className="pixel-table" style={{ minWidth: "100%", tableLayout: "auto" }}>
                        <thead className="sticky top-0 bg-pixel-black z-10">
                          <tr>
                            <th className="whitespace-nowrap">WHEN</th>
                            <th className="whitespace-nowrap">TRADER</th>
                            <th className="whitespace-nowrap">SIDE</th>
                            <th className="text-right whitespace-nowrap">AMOUNT</th>
                            <th className="text-right whitespace-nowrap">PRICE</th>
                            <th className="text-right whitespace-nowrap">FEE</th>
                            <th className="text-right whitespace-nowrap">IMPACT</th>
                            <th className="text-right whitespace-nowrap">TOTAL P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordered.map((t, di) => {
                            const origIdx = feedOrder === "newest" ? n - 1 - di : di;
                            const isHighlighted = tradeHighlight === origIdx;
                            const d = new Date(t.ts);
                            const when = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                            return (
                              <tr
                                key={`${t.trader}-${t.ts}-${di}`}
                                className={`transition-colors cursor-pointer ${
                                  isHighlighted
                                    ? "bg-pixel-white/10"
                                    : "hover:bg-pixel-white/5"
                                }`}
                                onClick={() => {
                                  const idx = findCurveIdx(t.ts);
                                  setChartHighlight(idx);
                                  setTradeHighlight(origIdx);
                                  chartPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                onMouseEnter={() => {
                                  setChartHighlight(findCurveIdx(t.ts));
                                  setTradeHighlight(origIdx);
                                }}
                                onMouseLeave={() => {
                                  setChartHighlight(null);
                                  setTradeHighlight(null);
                                }}
                              >
                                <td title={t.market} className="whitespace-nowrap">
                                  <div className="text-[13px] text-pixel-gray-light font-mono">{when}</div>
                                </td>
                                <td>
                                  <button
                                    onClick={() => goToTrader(t.trader)}
                                    className="text-[13px] font-mono text-pixel-gray-light hover:text-green-400 transition-colors"
                                  >
                                    {shortAddress(t.trader)}
                                  </button>
                                </td>
                                <td>
                                  <span className={`pixel-badge ${
                                    t.side === "BUY"
                                      ? "border-green-400/60 text-green-400"
                                      : "border-red-400/60 text-red-400"
                                  }`}>
                                    {t.side}
                                  </span>
                                </td>
                                <td className="text-right text-pixel-white font-mono whitespace-nowrap">
                                  {t.amount < 0.01
                                    ? `${(t.amount * 100).toFixed(2)}¢`
                                    : t.amount < 1
                                      ? `$${t.amount.toFixed(2)}`
                                      : `$${t.amount.toFixed(0)}`
                                  }
                                </td>
                                <td className="text-right text-pixel-gray-light font-mono whitespace-nowrap">
                                  {Math.round(t.price * 100)}c
                                </td>
                                <td className="text-right text-amber-400/70 font-mono whitespace-nowrap">
                                  ${t.fee.toFixed(2)}
                                </td>
                                <td className={`text-right font-mono whitespace-nowrap ${
                                  t.pnlDelta > 0.005 ? "text-green-400"
                                    : t.pnlDelta < -0.005 ? "text-red-400"
                                    : "text-pixel-gray"
                                }`}>
                                  {t.pnlDelta > 0.005 ? "+" : t.pnlDelta < -0.005 ? "" : ""}
                                  {Math.abs(t.pnlDelta) >= 0.005 ? `$${t.pnlDelta.toFixed(2)}` : "—"}
                                </td>
                                <td className={`text-right font-mono whitespace-nowrap ${
                                  t.runningPnl > 0 ? "text-green-400"
                                    : t.runningPnl < 0 ? "text-red-400"
                                    : "text-pixel-gray"
                                }`}>
                                  {t.runningPnl >= 0 ? "+" : ""}${t.runningPnl.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </>
                ) : (
                  <div className="p-8 text-center">
                    <div className="text-[14px] text-pixel-gray">NO TRADES IN THIS WINDOW</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Live Panel ── */}
          {mode === "LIVE" && watchlist.length > 0 && <LivePanel />}
        </>
      )}

    </div>
  );
}
