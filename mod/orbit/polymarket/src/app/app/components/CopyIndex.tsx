"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchPositions, fetchWalletTradesUntil, formatVolume, formatPnl, fetchTradersPage, TopTrader } from "../lib/polymarket";
import { PolymarketPosition, PolymarketTrade, SavedIndex } from "../lib/types";
import { shortAddress } from "@/lib/auth";
import { useFilterParams } from "../context/FiltersContext";
import PnlChart from "./PnlChart";
import type { CurvePoint } from "./PnlChart";
import { computeFifoTrades, buildPnlCurve, buildCombinedPnlCurve } from "../lib/pnlEngine";
import { loadIndexes, saveIndex, deleteIndex, updateIndex, getActiveIndexId, setActiveIndexId } from "../lib/indexStore";
import CopyTrading from "./CopyTrading";

type PosSort = "market" | "trader" | "size" | "pnlUsd";
type SortDir = "asc" | "desc";

interface IndexPosition extends PolymarketPosition {
  trader: string;
}

interface TraderSummary {
  address: string;
  positions: number;
  filteredPositions: number;
  totalValue: number;
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

interface TraderBacktest {
  address: string;
  trades: number;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  openValue: number;
  estimatedPnl: number;
  days: BacktestDay[];
}

function computeBacktest(
  trades: PolymarketTrade[],
  positions: PolymarketPosition[],
  windowDays: number,
  address: string,
): TraderBacktest {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const windowTrades = trades
    .filter((t) => t.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

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

  const openValue = positions.reduce((s, p) => s + p.value, 0);
  const netFlow = sellVolume - buyVolume;
  const estimatedPnl = netFlow + openValue;

  return {
    address,
    trades: windowTrades.length,
    buyVolume: Math.round(buyVolume * 100) / 100,
    sellVolume: Math.round(sellVolume * 100) / 100,
    netFlow: Math.round(netFlow * 100) / 100,
    openValue: Math.round(openValue * 100) / 100,
    estimatedPnl: Math.round(estimatedPnl * 100) / 100,
    days,
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
        <span className="text-[8px] text-pixel-gray tracking-wider shrink-0">ADD TRADER</span>
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="0x... ADDRESS OR SEARCH NAME"
            className="pixel-input-sm w-full font-mono text-[10px] pr-16"
            spellCheck={false}
          />
          {searching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-green-400 animate-pulse">...</span>
          )}
          {isAddress(input.trim()) && !alreadyAdded && (
            <button
              onClick={handleSubmit}
              className="absolute right-1 top-1/2 -translate-y-1/2 pixel-btn text-[8px] px-2 py-0 border-green-400 text-green-400 hover:bg-green-400/10"
            >
              ADD
            </button>
          )}
          {alreadyAdded && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-pixel-gray">ALREADY ADDED</span>
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
                <span className="text-[10px] font-mono text-pixel-white">{shortAddress(t.address)}</span>
                <span className={`text-[9px] font-mono ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatPnl(t.pnl)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[8px] text-pixel-gray font-mono">
                <span>VOL {formatVolume(t.volume)}</span>
                <span>{t.recentTrades || t.positions} trades</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {focused && coldCache && input.trim() && !isAddress(input.trim()) && (
        <div className="absolute z-50 left-0 right-0 mt-1 pixel-panel border-2 border-pixel-border bg-pixel-black px-3 py-2">
          <span className="text-[9px] text-pixel-gray">TRADER CACHE WARMING — PASTE 0x ADDRESS DIRECTLY</span>
        </div>
      )}
    </div>
  );
}

interface CopyIndexProps {
  searchFilter: string;
}

export default function CopyIndex({ searchFilter }: CopyIndexProps) {
  const router = useRouter();
  const filterQs = useFilterParams({ excludeSearch: true });

  // ── Strategy management ──
  const [savedIndexes, setSavedIndexes] = useState<SavedIndex[]>([]);
  const [activeIndex, setActiveIndex] = useState<SavedIndex | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Data state ──
  const [traderData, setTraderData] = useState<Map<string, PolymarketPosition[]>>(new Map());
  const [traderTrades, setTraderTrades] = useState<Map<string, PolymarketTrade[]>>(new Map());
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [posSort, setPosSort] = useState<PosSort>("pnlUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Backtest ──
  const [backtestDays, setBacktestDays] = useState(7);
  const [customDaysInput, setCustomDaysInput] = useState("");
  const [expandedTrader, setExpandedTrader] = useState<string | null>(null);

  // ── Weights (local state, persisted on change) ──
  const [traderWeights, setTraderWeights] = useState<Record<string, number>>({});
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Derive watchlist from active strategy
  const watchlist = useMemo(
    () => (activeIndex ? activeIndex.traders.map((t) => t.address) : []),
    [activeIndex],
  );
  const watchlistKey = watchlist.join(",");
  const showTraderPicker = editing || watchlist.length === 0;

  // ── Init: load or auto-create a single default strat ──
  useEffect(() => {
    let indexes = loadIndexes();

    // Auto-migrate legacy flat watchlist
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
              backtestDays: 7,
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
        backtestDays: 7,
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
  }, []);

  // Load weights + backtest days from active strategy
  useEffect(() => {
    if (!activeIndex) {
      setTraderWeights({});
      setBacktestDays(7);
      return;
    }
    const w: Record<string, number> = {};
    for (const t of activeIndex.traders) w[t.address] = Math.round(t.weight * 100);
    setTraderWeights(w);
    if (activeIndex.backtestDays) {
      setBacktestDays(activeIndex.backtestDays);
      if (![3, 7, 14, 30].includes(activeIndex.backtestDays)) {
        setCustomDaysInput(String(activeIndex.backtestDays));
      } else {
        setCustomDaysInput("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex?.id]);

  // ── Persist helper ──
  const persistIndex = useCallback((idx: SavedIndex) => {
    const updated = { ...idx, updatedAt: Date.now() };
    updateIndex(updated.id, updated);
    setActiveIndex(updated);
    setSavedIndexes(loadIndexes());
  }, []);

  // ── Strategy CRUD ──
  const createStrategy = (name: string) => {
    const now = Date.now();
    const idx: SavedIndex = {
      id: now.toString(36),
      name: name.trim() || "Untitled",
      traders: [],
      backtestDays: 7,
      createdAt: now,
      updatedAt: now,
    };
    saveIndex(idx);
    setActiveIndex(idx);
    setActiveIndexId(idx.id);
    setSavedIndexes(loadIndexes());
    setCreatingNew(false);
    setNewName("");
    setEditing(true);
  };

  const selectStrategy = (id: string) => {
    const fresh = loadIndexes().find((i) => i.id === id);
    if (!fresh) return;
    setActiveIndex(fresh);
    setActiveIndexId(id);
    setEditing(false);
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

  // Re-fetch when watchlist addresses actually change
  useEffect(() => {
    if (watchlist.length === 0) {
      setLoading(false);
      return;
    }
    fetchAll(watchlist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistKey]);

  // ── Add / remove traders ──
  const addTrader = (addr: string) => {
    if (!activeIndex) return;
    if (activeIndex.traders.some((t) => t.address === addr)) return;
    const count = activeIndex.traders.length + 1;
    const eqPct = Math.round(100 / count);
    const traders = [
      ...activeIndex.traders,
      { address: addr, weight: eqPct / 100 },
    ];
    persistIndex({ ...activeIndex, traders });
    fetchAll([addr]);
  };

  const removeTrader = (addr: string) => {
    if (!activeIndex) return;
    const traders = activeIndex.traders.filter((t) => t.address !== addr);
    persistIndex({ ...activeIndex, traders });
    setTraderData((prev) => { const m = new Map(prev); m.delete(addr); return m; });
    setTraderTrades((prev) => { const m = new Map(prev); m.delete(addr); return m; });
  };

  const goToTrader = (addr: string) => {
    router.push(`/traders/${addr}${filterQs ? `?${filterQs}` : ""}`);
  };

  // ── Aggregated positions ──
  const allPositions: IndexPosition[] = useMemo(() => {
    const result: IndexPosition[] = [];
    for (const [trader, positions] of traderData) {
      if (!watchlist.includes(trader)) continue;
      for (const p of positions) {
        result.push({ ...p, trader });
      }
    }
    return result;
  }, [traderData, watchlist]);

  const filteredPositions = useMemo(() => {
    if (!searchFilter.trim()) return allPositions;
    const q = searchFilter.toLowerCase();
    return allPositions.filter((p) => p.market.toLowerCase().includes(q));
  }, [allPositions, searchFilter]);

  // ── Backtests ──
  const backtests = useMemo((): TraderBacktest[] => {
    return watchlist.map((addr) => {
      const trades = traderTrades.get(addr) || [];
      const positions = traderData.get(addr) || [];
      return computeBacktest(trades, positions, backtestDays, addr);
    }).sort((a, b) => b.estimatedPnl - a.estimatedPnl);
  }, [watchlist, traderTrades, traderData, backtestDays]);

  const totalBacktestPnl = backtests.reduce((s, b) => s + b.estimatedPnl, 0);
  const totalWeight = Object.values(traderWeights).reduce((s, w) => s + w, 0);

  const weightedBacktestPnl = useMemo(() => {
    if (totalWeight <= 0) return totalBacktestPnl;
    return backtests.reduce((s, bt) => {
      const w = (traderWeights[bt.address] || 0) / totalWeight;
      return s + bt.estimatedPnl * w;
    }, 0);
  }, [backtests, traderWeights, totalWeight, totalBacktestPnl]);

  const roiPerTrader = (bt: TraderBacktest) =>
    bt.buyVolume > 0 ? (bt.estimatedPnl / bt.buyVolume) * 1000 : 0;
  const tradersWithBuys = backtests.filter((bt) => bt.buyVolume > 0);
  const combinedRoi1k = useMemo(() => {
    if (tradersWithBuys.length === 0) return 0;
    if (totalWeight <= 0) {
      return tradersWithBuys.reduce((s, bt) => {
        const share = 1000 / tradersWithBuys.length;
        return s + (bt.estimatedPnl / bt.buyVolume) * share;
      }, 0);
    }
    return tradersWithBuys.reduce((s, bt) => {
      const w = (traderWeights[bt.address] || 0) / totalWeight;
      return s + (bt.estimatedPnl / bt.buyVolume) * 1000 * w;
    }, 0);
  }, [tradersWithBuys, traderWeights, totalWeight]);

  // ── Combined FIFO PnL curve ──
  const combinedPnlCurve = useMemo((): CurvePoint[] => {
    if (watchlist.length === 0 || loading) return [];
    const cutoffMs = Date.now() - backtestDays * 24 * 60 * 60 * 1000;
    const traderCurves: { address: string; points: CurvePoint[]; weight: number }[] = [];

    for (const addr of watchlist) {
      const trades = traderTrades.get(addr) || [];
      const positions = traderData.get(addr) || [];
      if (trades.length === 0) continue;

      const annotated = computeFifoTrades(trades, positions);
      const curve = buildPnlCurve(annotated, positions, cutoffMs);
      if (curve.length === 0) continue;

      const w = totalWeight > 0 ? (traderWeights[addr] || 0) / totalWeight : 1 / watchlist.length;
      traderCurves.push({ address: addr, points: curve, weight: w });
    }

    return buildCombinedPnlCurve(traderCurves);
  }, [watchlist, traderTrades, traderData, backtestDays, traderWeights, totalWeight, loading]);

  // ── Backtest date range ──
  const backtestDateRange = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.now() - backtestDays * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return { from: fmt(from), to: fmt(now) };
  }, [backtestDays]);

  // ── Trader summaries ──
  const traderSummaries: TraderSummary[] = useMemo(() => {
    return watchlist.map((addr) => {
      const positions = traderData.get(addr) || [];
      const q = searchFilter.trim().toLowerCase();
      const filtered = q ? positions.filter((p) => p.market.toLowerCase().includes(q)) : positions;
      return {
        address: addr,
        positions: positions.length,
        filteredPositions: filtered.length,
        totalValue: filtered.reduce((s, p) => s + p.value, 0),
        totalPnl: filtered.reduce((s, p) => s + p.pnlUsd, 0),
        loaded: traderData.has(addr),
      };
    });
  }, [watchlist, traderData, searchFilter]);

  // ── Sort ──
  const handleSort = (col: PosSort) => {
    if (posSort === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setPosSort(col); setSortDir("desc"); }
  };

  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      let cmp = 0;
      switch (posSort) {
        case "market": cmp = a.market.localeCompare(b.market); break;
        case "trader": cmp = a.trader.localeCompare(b.trader); break;
        case "size": cmp = a.value - b.value; break;
        case "pnlUsd": cmp = a.pnlUsd - b.pnlUsd; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredPositions, posSort, sortDir]);

  const totalValue = filteredPositions.reduce((s, p) => s + p.value, 0);
  const totalPnl = filteredPositions.reduce((s, p) => s + p.pnlUsd, 0);

  const Arrow = ({ col }: { col: PosSort }) => (
    <span className="inline-block w-3 ml-0.5 text-center">
      {posSort === col ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : ""}
    </span>
  );

  const presetDays = [3, 7, 14, 30];
  const isPreset = presetDays.includes(backtestDays);

  // ══════════════════════════════════════════
  // ── RENDER ──
  // ══════════════════════════════════════════

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="pixel-panel px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add trader (inline) */}
          <div className="flex-1 min-w-[160px]">
            <AddTraderBar watchlist={watchlist} onAdd={addTrader} />
          </div>

          {/* Right side: stats + actions */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {loading && (
              <span className="text-[8px] text-green-400 animate-pulse font-mono">
                {loadedCount}/{watchlist.length}
              </span>
            )}
            {watchlist.length > 0 && !showTraderPicker && (
              <button
                onClick={() => setEditing(true)}
                className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-green-400 hover:border-green-400 transition-colors"
              >
                EDIT
              </button>
            )}
            {showTraderPicker && watchlist.length > 0 && (
              <span className="text-[8px] text-green-400 animate-pulse">ADDING...</span>
            )}
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-pixel-white">{formatVolume(totalValue)}</span>
              <span className={totalPnl >= 0 ? "text-green-400" : "text-red-400"}>
                {formatPnl(totalPnl)}
              </span>
              <span className="text-pixel-gray-light">
                {searchFilter.trim()
                  ? `${filteredPositions.length}/${allPositions.length}`
                  : allPositions.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active view ── */}
      {activeIndex && (
        <>
          {/* Inline trader picker (editing mode) */}
          {showTraderPicker && (
            <div className="space-y-2">
              <CopyTrading
                days={backtestDays}
                search={searchFilter}
                onSelect={addTrader}
                selectedAddresses={watchlist}
                compact
              />
              {watchlist.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setEditing(false);
                      updateBacktestDays(7);
                    }}
                    className="pixel-btn text-[11px] px-5 py-1.5 border-green-400 text-green-400 hover:bg-green-400/10"
                  >
                    DONE — RUN 7D SIMULATION
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Followed traders strip with weight badges */}
          {watchlist.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-1">
              <span className="text-[8px] text-pixel-gray tracking-wider mr-1">FOLLOWING</span>
              {traderSummaries.map((t) => {
                const pnlColor = t.totalPnl > 0 ? "text-green-400" : t.totalPnl < 0 ? "text-red-400" : "text-pixel-gray-light";
                const w = traderWeights[t.address] || 0;
                const isEditing = editingWeight === t.address;
                return (
                  <div key={t.address} className="flex items-center gap-0 shrink-0">
                    <button
                      onClick={() => goToTrader(t.address)}
                      className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-white hover:border-pixel-white flex items-center gap-1.5 border-r-0"
                    >
                      <div className="w-1.5 h-1.5 bg-green-400" />
                      {shortAddress(t.address)}
                      {t.loaded && (
                        <>
                          <span className={pnlColor}>{formatPnl(t.totalPnl)}</span>
                          <span className="text-pixel-gray">{t.filteredPositions}pos</span>
                        </>
                      )}
                    </button>
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        defaultValue={w}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v >= 0 && v <= 100) {
                            updateWeight(t.address, v);
                          }
                          setEditingWeight(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="pixel-input-sm w-8 text-center font-mono text-[7px] py-0.5 border-pixel-border"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingWeight(t.address)}
                        className="pixel-btn text-[7px] px-1 py-0.5 border-pixel-border text-pixel-gray hover:text-yellow-400 hover:border-yellow-400 border-r-0"
                        title="Edit weight"
                      >
                        {w}%
                      </button>
                    )}
                    <button
                      onClick={() => removeTrader(t.address)}
                      className="pixel-btn text-[8px] px-1.5 py-0.5 border-pixel-border text-pixel-gray hover:text-red-400 hover:border-red-400 transition-colors"
                      title="Remove from strat"
                    >
                      x
                    </button>
                  </div>
                );
              })}
              <span className="text-[7px] text-pixel-gray font-mono ml-1">
                {totalWeight}% RATIO
              </span>
            </div>
          )}

          {/* Empty trader state */}
          {watchlist.length === 0 && !showTraderPicker && (
            <div className="pixel-panel p-8 text-center space-y-3">
              <div className="text-[11px] text-pixel-gray">NO TRADERS IN THIS STRAT YET</div>
              <div className="text-[9px] text-pixel-gray-light max-w-sm mx-auto">
                ADD TRADERS ABOVE BY PASTING AN ADDRESS OR SEARCHING.
                YOU CAN ALSO ADD FROM THE{" "}
                <button onClick={() => router.push("/traders")} className="text-pixel-white hover:text-green-400 transition-colors">
                  TRADERS
                </button>{" "}TAB.
              </div>
            </div>
          )}

          {/* ── Backtest panel ── */}
          {watchlist.length > 0 && !showTraderPicker && (
            <div className="pixel-panel p-4 space-y-3">
              {/* Header: day selector + date range + stats */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-pixel-white tracking-wider">BACKTEST</span>
                  <div className="flex items-center gap-1.5">
                    {presetDays.map((d) => (
                      <button
                        key={d}
                        onClick={() => { updateBacktestDays(d); setCustomDaysInput(""); }}
                        className={`pixel-btn text-[9px] px-2 py-0.5 ${
                          backtestDays === d && isPreset
                            ? "border-pixel-white text-pixel-white bg-pixel-white/10"
                            : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                        }`}
                      >
                        {d}D
                      </button>
                    ))}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customDaysInput}
                      onChange={(e) => handleCustomDays(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="CUSTOM"
                      className={`pixel-input-sm w-16 text-center font-mono text-[9px] ${
                        !isPreset ? "border-pixel-white text-pixel-white" : "border-pixel-border text-pixel-gray"
                      }`}
                    />
                    <span className="text-[8px] text-pixel-gray">D</span>
                  </div>
                  <span className="text-[8px] text-pixel-gray font-mono">
                    {backtestDateRange.from} — {backtestDateRange.to}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono">
                  <span className="text-pixel-gray">WEIGHTED:</span>
                  <span className={weightedBacktestPnl >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatPnl(weightedBacktestPnl)}
                  </span>
                  <span className="text-pixel-gray border-l border-pixel-border pl-4">$1K ROI:</span>
                  <span className={combinedRoi1k >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatPnl(combinedRoi1k)}
                  </span>
                </div>
              </div>

              {/* PnL chart */}
              {combinedPnlCurve.length >= 2 ? (
                <PnlChart
                  points={combinedPnlCurve}
                  dayLabel={`${backtestDays}D INDEX`}
                  tradesInWindow={combinedPnlCurve.filter((p) => p.side !== "MARK").map((p) => ({ timestamp: p.ts }))}
                />
              ) : !loading && watchlist.length > 0 ? (
                <div className="p-6 text-center">
                  <span className="text-[9px] text-pixel-gray">NOT ENOUGH TRADE DATA FOR PNL CURVE</span>
                </div>
              ) : loading ? (
                <div className="p-6 text-center">
                  <span className="text-[9px] text-pixel-gray animate-pulse">LOADING...</span>
                </div>
              ) : null}

              {/* Per-trader breakdown */}
              <div className="space-y-2">
                {backtests.map((bt) => {
                  const isExpanded = expandedTrader === bt.address;
                  const w = traderWeights[bt.address] || 0;
                  const wFrac = totalWeight > 0 ? w / totalWeight : 0;
                  const weightedPnl = bt.estimatedPnl * wFrac;
                  return (
                    <div key={bt.address} className="pixel-panel overflow-hidden">
                      <button
                        onClick={() => setExpandedTrader(isExpanded ? null : bt.address)}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-pixel-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <button
                              onClick={(e) => { e.stopPropagation(); goToTrader(bt.address); }}
                              className="text-[10px] text-pixel-white font-mono hover:text-green-400 transition-colors"
                            >
                              {shortAddress(bt.address)}
                            </button>
                            <div className="text-[8px] text-pixel-gray">
                              {bt.trades} TRADES · {backtestDays}D
                              <span className="text-yellow-400/60 ml-2">{w}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[8px] text-pixel-gray">BOUGHT</div>
                            <div className="text-[10px] text-pixel-white font-mono">${bt.buyVolume.toFixed(0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] text-pixel-gray">SOLD</div>
                            <div className="text-[10px] text-pixel-white font-mono">${bt.sellVolume.toFixed(0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] text-pixel-gray">OPEN</div>
                            <div className="text-[10px] text-pixel-white font-mono">${bt.openValue.toFixed(0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] text-pixel-gray">EST. P&L</div>
                            <div className={`text-[11px] font-mono ${bt.estimatedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {formatPnl(bt.estimatedPnl)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] text-pixel-gray">WEIGHTED</div>
                            <div className={`text-[10px] font-mono ${weightedPnl >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                              {formatPnl(weightedPnl)}
                            </div>
                          </div>
                          <div className="text-right border-l border-pixel-border pl-3">
                            <div className="text-[8px] text-pixel-gray">$1K ROI</div>
                            <div className={`text-[11px] font-mono ${roiPerTrader(bt) >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {formatPnl(roiPerTrader(bt))}
                            </div>
                          </div>
                          <span className="text-[9px] text-pixel-gray ml-1">{isExpanded ? "[-]" : "[+]"}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeTrader(bt.address); }}
                            className="text-[9px] text-pixel-gray hover:text-red-400 transition-colors ml-1"
                          >
                            x
                          </button>
                        </div>
                      </button>

                      {isExpanded && bt.days.length > 0 && (
                        <div className="border-t-2 border-pixel-border px-4 py-3">
                          <div className="overflow-x-auto">
                            <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "500px" }}>
                              <colgroup>
                                <col style={{ width: "65px" }} />
                                <col style={{ width: "50px" }} />
                                <col style={{ width: "80px" }} />
                                <col style={{ width: "80px" }} />
                                <col style={{ width: "80px" }} />
                                <col style={{ width: "90px" }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th>DATE</th>
                                  <th className="text-right">TXS</th>
                                  <th className="text-right">BOUGHT</th>
                                  <th className="text-right">SOLD</th>
                                  <th className="text-right">NET</th>
                                  <th className="text-right">CUM. FLOW</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bt.days.map((day) => (
                                  <tr key={day.date}>
                                    <td className="text-pixel-white font-mono">{day.date}</td>
                                    <td className="text-right text-pixel-gray-light font-mono">{day.trades}</td>
                                    <td className="text-right text-red-400/80 font-mono">-${day.buyVolume.toFixed(0)}</td>
                                    <td className="text-right text-green-400/80 font-mono">+${day.sellVolume.toFixed(0)}</td>
                                    <td className={`text-right font-mono ${day.netFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                                      {day.netFlow >= 0 ? "+" : ""}${day.netFlow.toFixed(0)}
                                    </td>
                                    <td className={`text-right font-mono ${day.cumFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                                      {day.cumFlow >= 0 ? "+" : ""}${day.cumFlow.toFixed(0)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {isExpanded && bt.days.length === 0 && (
                        <div className="border-t-2 border-pixel-border px-4 py-4 text-center">
                          <span className="text-[9px] text-pixel-gray">NO TRADES IN THE LAST {backtestDays} DAYS</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aggregated positions table */}
          {filteredPositions.length > 0 ? (
            <div className="pixel-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[10px] text-pixel-gray-light tracking-wider">
                  INDEX POSITIONS
                </span>
                <span className="text-[9px] text-pixel-gray font-mono">
                  {searchFilter.trim()
                    ? `${filteredPositions.length} / ${allPositions.length}`
                    : `${allPositions.length}`}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "700px" }}>
                  <colgroup>
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "55px" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={`sortable ${posSort === "market" ? "sorted" : ""}`} onClick={() => handleSort("market")}>
                        MARKET <Arrow col="market" />
                      </th>
                      <th className={`sortable ${posSort === "trader" ? "sorted" : ""}`} onClick={() => handleSort("trader")}>
                        TRADER <Arrow col="trader" />
                      </th>
                      <th>SIDE</th>
                      <th className={`sortable text-right ${posSort === "size" ? "sorted" : ""}`} onClick={() => handleSort("size")}>
                        VALUE <Arrow col="size" />
                      </th>
                      <th className="text-right">AVG</th>
                      <th className="text-right">NOW</th>
                      <th className={`sortable text-right ${posSort === "pnlUsd" ? "sorted" : ""}`} onClick={() => handleSort("pnlUsd")}>
                        P&L <Arrow col="pnlUsd" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((pos, i) => {
                      const isProfit = pos.pnlUsd >= 0;
                      return (
                        <tr key={`${pos.trader}-${pos.conditionId}-${i}`}>
                          <td className="text-pixel-white truncate" title={pos.market}>
                            {pos.market}
                          </td>
                          <td>
                            <button
                              onClick={() => goToTrader(pos.trader)}
                              className="text-[9px] font-mono text-pixel-gray-light hover:text-green-400 transition-colors"
                            >
                              {shortAddress(pos.trader)}
                            </button>
                          </td>
                          <td>
                            <span className={`pixel-badge ${
                              pos.outcome === "Yes"
                                ? "border-pixel-white text-pixel-white"
                                : "border-pixel-gray text-pixel-gray"
                            }`}>
                              {pos.outcome.toUpperCase()}
                            </span>
                          </td>
                          <td className="text-right text-pixel-white font-mono">
                            ${pos.value.toFixed(0)}
                          </td>
                          <td className="text-right text-pixel-gray-light font-mono">
                            {Math.round(pos.avgPrice * 100)}c
                          </td>
                          <td className="text-right text-pixel-white font-mono">
                            {Math.round(pos.currentPrice * 100)}c
                          </td>
                          <td className={`text-right font-mono ${isProfit ? "text-green-400" : "text-red-400"}`}>
                            {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t-2 border-pixel-border flex items-center justify-end gap-6 text-[10px] font-mono">
                <span className="text-pixel-gray">TOTAL VALUE</span>
                <span className="text-pixel-white">{formatVolume(totalValue)}</span>
                <span className="text-pixel-gray">TOTAL P&L</span>
                <span className={totalPnl >= 0 ? "text-green-400" : "text-red-400"}>
                  {formatPnl(totalPnl)}
                </span>
              </div>
            </div>
          ) : loading ? (
            <div className="pixel-panel p-8 text-center">
              <div className="text-[10px] text-pixel-white animate-pulse">
                LOADING POSITIONS...
              </div>
            </div>
          ) : watchlist.length > 0 ? (
            <div className="pixel-panel p-8 text-center">
              <div className="text-[10px] text-pixel-gray">
                {searchFilter.trim()
                  ? `NO POSITIONS MATCHING "${searchFilter.toUpperCase()}"`
                  : "FOLLOWED TRADERS HAVE NO OPEN POSITIONS"}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
