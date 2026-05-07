"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchTopTradersStream, ActiveTradersProgress,
  fetchTradersPage, PagedTradersResult,
  formatVolume, formatPnl, TopTrader,
  CategorySlug, matchTraderCategory, matchTraderSearch,
} from "../lib/polymarket";
import { SavedIndex } from "../lib/types";
import { loadIndexes, saveIndex, updateIndex, setActiveIndexId } from "../lib/indexStore";
import { shortAddress } from "@/lib/auth";
import { useFilters, useFilterParams } from "../context/FiltersContext";

type TraderSort = "score" | "volume" | "pnl" | "positions";
const DEFAULT_FORMULA = "pnl / volume";

function compileFormula(expr: string): {
  fn: (t: { pnl: number; volume: number; positions: number; winRate: number; markets: number }) => number;
  error: null;
} | { fn: null; error: string } {
  try {
    const raw = new Function(
      "pnl", "volume", "positions", "winRate", "markets", "Math",
      `"use strict"; return (${expr});`,
    ) as (...args: unknown[]) => unknown;
    const probe = raw(0, 0, 0, 0, 0, Math);
    if (typeof probe !== "number" && !Number.isNaN(probe)) {
      return { fn: null, error: "formula must evaluate to a number" };
    }
    return {
      fn: (t) => {
        try {
          const v = raw(t.pnl, t.volume, t.positions, t.winRate, t.markets, Math) as number;
          return Number.isFinite(v) ? v : Number.NEGATIVE_INFINITY;
        } catch {
          return Number.NEGATIVE_INFINITY;
        }
      },
      error: null,
    };
  } catch (e) {
    return { fn: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function formatScore(v: number): string {
  if (!Number.isFinite(v)) return "---";
  const abs = Math.abs(v);
  if (abs < 10) {
    const pct = v * 100;
    const prefix = pct >= 0 ? "+" : "";
    return `${prefix}${pct.toFixed(2)}%`;
  }
  const prefix = v >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}${(abs / 1_000).toFixed(2)}k`;
  return `${prefix}${abs.toFixed(2)}`;
}

type SortDir = "asc" | "desc";
const PAGE_SIZE = 50;

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="inline-block w-3 ml-0.5 text-center">
      {active ? (dir === "desc" ? "\u25BC" : "\u25B2") : ""}
    </span>
  );
}

/* ── Sparkline ── */
function Sparkline({ data, width = 120, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-20">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#444" strokeWidth={1} strokeDasharray="3,3" />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const final = data[data.length - 1];
  const color = final > 0 ? "#4ade80" : final < 0 ? "#f87171" : "#888";
  const zeroY = max <= 0 ? pad : min >= 0 ? height - pad : height - pad - ((0 - min) / range) * (height - pad * 2);

  const areaPoints = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as [number, number];
  });
  const areaPath = `M${areaPoints[0][0]},${areaPoints[0][1]} ${areaPoints.slice(1).map(p => `L${p[0]},${p[1]}`).join(" ")} L${areaPoints[areaPoints.length - 1][0]},${height - pad} L${areaPoints[0][0]},${height - pad} Z`;

  return (
    <svg width={width} height={height}>
      {min < 0 && max > 0 && (
        <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="#333" strokeWidth={1} strokeDasharray="2,2" />
      )}
      <path d={areaPath} fill={color} opacity={0.08} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={areaPoints[areaPoints.length - 1][0]} cy={areaPoints[areaPoints.length - 1][1]} r={2} fill={color} />
    </svg>
  );
}

/* ── Rank badge for top 3 ── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[9px] text-yellow-400" title="#1">&#9733;</span>;
  if (rank === 2) return <span className="text-[9px] text-gray-300" title="#2">&#9733;</span>;
  if (rank === 3) return <span className="text-[9px] text-amber-600" title="#3">&#9733;</span>;
  return <span className="text-[9px] text-pixel-gray font-mono">{rank}</span>;
}

interface CopyTradingProps {
  days?: number;
  minTradesPerDay?: number;
  reloadKey?: number;
  search?: string;
  category?: CategorySlug;
  onSelect?: (addr: string) => void;
  selectedAddresses?: string[];
  compact?: boolean;
}

export default function CopyTrading({
  days = 7,
  minTradesPerDay = 0,
  reloadKey = 0,
  search = "",
  category = "",
  onSelect,
  selectedAddresses = [],
  compact = false,
}: CopyTradingProps = {}) {
  const router = useRouter();
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [totalTraders, setTotalTraders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [traderSort, setTraderSort] = useState<TraderSort>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [cacheWarm, setCacheWarm] = useState(false);

  const {
    daysAgo, setDaysAgo,
    minTrades, setMinTrades,
    minPerDay, setMinPerDay,
    minVolume, setMinVolume, minBuyVolume, setMinBuyVolume,
    minSellVolume, setMinSellVolume,
    minPnl, setMinPnl,
    reload,
  } = useFilters();

  const [showFilters, setShowFilters] = useState(false);
  const [formula, setFormula] = useState<string>(DEFAULT_FORMULA);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("poly8bit_score_formula");
      if (saved && saved.trim()) setFormula(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem("poly8bit_score_formula", formula); } catch {}
  }, [formula]);

  const compiled = useMemo(() => compileFormula(formula), [formula]);
  const scoreFor = useCallback(
    (t: TopTrader): number => {
      if (!compiled.fn) return Number.NEGATIVE_INFINITY;
      return compiled.fn({
        pnl: t.pnl,
        volume: t.volume,
        positions: t.positions,
        winRate: t.winRate,
        markets: t.marketTitles.length,
      });
    },
    [compiled],
  );

  const [progress, setProgress] = useState<ActiveTradersProgress | null>(null);
  const [source, setSource] = useState<"memory" | "disk" | "fresh" | null>(null);

  const [savedStrats, setSavedStrats] = useState<SavedIndex[]>([]);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [newStratName, setNewStratName] = useState("");
  const [creatingInPicker, setCreatingInPicker] = useState(false);
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSavedStrats(loadIndexes());
  }, []);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(null);
        setCreatingInPicker(false);
        setNewStratName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Derive which traders are in any strategy
  const traderStrategyMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const idx of savedStrats) {
      for (const t of idx.traders) {
        const existing = map.get(t.address) || [];
        existing.push(idx.name);
        map.set(t.address, existing);
      }
    }
    return map;
  }, [savedStrats]);

  const addToStrategy = (traderAddr: string, stratId: string) => {
    const indexes = loadIndexes();
    const idx = indexes.find((i) => i.id === stratId);
    if (!idx) return;
    if (idx.traders.some((t) => t.address === traderAddr)) return;
    const count = idx.traders.length + 1;
    const newWeight = Math.round(100 / count) / 100;
    const traders = [...idx.traders, { address: traderAddr, weight: newWeight }];
    updateIndex(stratId, { traders, updatedAt: Date.now() });
    setSavedStrats(loadIndexes());
    setPickerOpen(null);
    setCreatingInPicker(false);
    setNewStratName("");
    setAddedFlash(traderAddr);
    setTimeout(() => setAddedFlash(null), 1500);
  };

  const createStrategyAndAdd = (traderAddr: string, name: string) => {
    if (!name.trim()) return;
    const now = Date.now();
    const idx: SavedIndex = {
      id: now.toString(36),
      name: name.trim(),
      traders: [{ address: traderAddr, weight: 1 }],
      backtestDays: 7,
      createdAt: now,
      updatedAt: now,
    };
    saveIndex(idx);
    setActiveIndexId(idx.id);
    setSavedStrats(loadIndexes());
    setPickerOpen(null);
    setCreatingInPicker(false);
    setNewStratName("");
    setAddedFlash(traderAddr);
    setTimeout(() => setAddedFlash(null), 1500);
  };

  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const inFlightRef = useRef(false);
  const pageRef = useRef(0);

  // Server-side paginated fetch — used when cache is warm
  const loadPage = useCallback(
    async (opts: {
      pg?: number; sort?: string; order?: string; silent?: boolean;
    } = {}) => {
      const pg = opts.pg ?? pageRef.current;
      const sortKey = opts.sort || (traderSort === "score" ? "pnl" : traderSort);
      const orderKey = opts.order || sortDir;
      if (!opts.silent) setRefreshing(true);
      try {
        const result = await fetchTradersPage({
          days,
          minPerDay: minTradesPerDay,
          pool: 2000,
          sort: sortKey,
          order: orderKey,
          page: pg,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          category: category || undefined,
          minVolume: Number(minVolume) || undefined,
          minPnl: minPnl !== "" ? Number(minPnl) : undefined,
          minTrades: Number(minTrades) || undefined,
          minBuyVolume: Number(minBuyVolume) || undefined,
          minSellVolume: Number(minSellVolume) || undefined,
        });
        if (result.cold) {
          // Cache is cold — fall back to streaming
          return false;
        }
        setTraders(result.traders);
        setTotalTraders(result.total);
        setSource(result.source as "memory" | "disk" | "fresh");
        setCacheWarm(true);
        setHasLoaded(true);
        setLoading(false);
        return true;
      } catch {
        return false;
      } finally {
        setRefreshing(false);
      }
    },
    [days, minTradesPerDay, traderSort, sortDir, search, category,
     minVolume, minPnl, minTrades, minBuyVolume, minSellVolume],
  );

  // Streaming load — used for cold cache (pipeline needs to run)
  const loadStream = useCallback(
    async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setProgress(null);
      setSource(null);
      try {
        const { traders: data, source: src } = await fetchTopTradersStream(
          2000,
          { daysWindow: days, minTradesPerDay },
          (p) => setProgress(p),
          (partial) => {
            // Show first page of partial results while streaming
            setTraders(partial.slice(0, PAGE_SIZE));
            setTotalTraders(partial.length);
            setLoading(false);
          },
        );
        // After stream completes, cache is now warm — switch to server-side pagination
        setCacheWarm(true);
        setSource(src);
        // Show all results (first page) — totalTraders reflects full dataset
        setTraders(data.slice(0, PAGE_SIZE));
        setTotalTraders(data.length);
      } catch {
        setTraders([]);
      } finally {
        setLoading(false);
        setHasLoaded(true);
        inFlightRef.current = false;
      }
    },
    [days, minTradesPerDay],
  );

  // Keep refs to latest fetch functions so effects don't go stale
  const loadPageRef = useRef(loadPage);
  const loadStreamRef = useRef(loadStream);
  useEffect(() => { loadPageRef.current = loadPage; }, [loadPage]);
  useEffect(() => { loadStreamRef.current = loadStream; }, [loadStream]);

  // Initial load: try paged first, fall back to streaming
  // Fires when the pipeline parameters change (days window, min trades/day)
  useEffect(() => {
    setTraders([]);
    setSource(null);
    setProgress(null);
    setCacheWarm(false);
    setPage(0);
    pageRef.current = 0;
    (async () => {
      const warm = await loadPageRef.current({ pg: 0 });
      if (!warm) await loadStreamRef.current();
    })();
  }, [days, minTradesPerDay, reloadKey]);

  // Re-fetch page when sort/filter/page changes (server-side)
  useEffect(() => {
    if (!cacheWarm) return;
    pageRef.current = page;
    loadPageRef.current({ pg: page });
  }, [cacheWarm, page, traderSort, sortDir, search, category,
      minVolume, minPnl, minTrades, minBuyVolume, minSellVolume]);

  // Silent refresh every 60s (just re-fetch current page)
  useEffect(() => {
    if (!cacheWarm) return;
    const t = setInterval(() => { void loadPage({ pg: pageRef.current, silent: true }); }, 60_000);
    return () => clearInterval(t);
  }, [loadPage, cacheWarm]);

  const refreshStrats = () => setSavedStrats(loadIndexes());

  const handleSort = (col: TraderSort) => {
    if (traderSort === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setTraderSort(col); setSortDir("desc"); }
  };

  const filterQs = useFilterParams({ excludeSearch: true });
  const goToTrader = (addr: string) => {
    router.push(`/traders/${addr}${filterQs ? `?${filterQs}` : ""}`);
  };

  // When server-side pagination is active, traders already contains just the
  // current page — no client-side filtering/sorting needed. For the "score"
  // sort we still sort client-side since the formula is client-only.
  const sortedTraders = useMemo(() => {
    if (traderSort === "score" && cacheWarm) {
      return [...traders].sort((a, b) => {
        const cmp = scoreFor(a) - scoreFor(b);
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return traders;
  }, [traders, traderSort, sortDir, scoreFor, cacheWarm]);

  // Reset page on filter/sort change
  useEffect(() => { setPage(0); }, [search, category, traderSort, sortDir,
    minVolume, minPnl, minTrades, minBuyVolume, minSellVolume]);

  const totalPages = Math.max(1, Math.ceil(totalTraders / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageTraders = sortedTraders;

  const columns: { key: TraderSort; label: string }[] = [
    { key: "score", label: "SCORE" },
    { key: "pnl", label: "P&L" },
    { key: "volume", label: "VOL" },
    { key: "positions", label: "TRADES" },
  ];

  // Filter input helpers
  const onInt = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") return set("");
    if (!/^\d+$/.test(v)) return;
    const n = Number(v);
    if (n > max) return set(String(max));
    set(String(n));
  };
  const onDec = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") return set("");
    if (!/^-?\d*\.?\d*$/.test(v)) return;
    set(v);
  };
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  // Count active advanced filters
  const activeFilterCount = [
    minTrades, minBuyVolume, minSellVolume, minPnl,
  ].filter((v) => v !== "").length
    + (minVolume !== "100" && minVolume !== "" ? 1 : 0)
    + (minPerDay !== "0" && minPerDay !== "" ? 1 : 0)
    + (formula !== DEFAULT_FORMULA ? 1 : 0);

  // Stats summary (computed from current page — approximate when paginated)
  const pagePnl = traders.reduce((s, t) => s + t.pnl, 0);
  const pageVol = traders.reduce((s, t) => s + t.volume, 0);

  return (
    <div className="space-y-3">
      {/* ── Single-line header ── */}
      <div className="pixel-panel px-4 py-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title + days + count */}
          <span className="text-[11px] text-pixel-white tracking-wider shrink-0">TOP TRADERS</span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] text-pixel-gray tracking-wider">DAYS</span>
            <input type="text" inputMode="numeric" value={daysAgo} onChange={onInt(setDaysAgo, 365)}
              onKeyDown={onEnter} placeholder="7"
              className="pixel-input-sm w-10 text-center font-mono text-[9px]" />
          </div>

          {totalTraders > 0 && !loading && (
            <span className="text-[9px] text-pixel-gray font-mono shrink-0">
              {totalTraders} traders
            </span>
          )}

          {/* Right side: source + filters */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {source && (
              <span className={`text-[7px] font-mono tracking-wider px-1.5 py-0.5 border ${
                source === "fresh" ? "border-yellow-500/40 text-yellow-400" : "border-pixel-border text-pixel-gray"
              }`}>
                {source === "memory" ? "MEM" : source === "disk" ? "DISK" : "LIVE"}
              </span>
            )}
            {refreshing && <span className="text-[8px] text-green-400 animate-pulse">&#9679;</span>}

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`pixel-btn text-[9px] px-2 py-0.5 shrink-0 flex items-center gap-1.5 transition-colors ${
                showFilters
                  ? "border-pixel-white text-pixel-white"
                  : activeFilterCount > 0
                  ? "border-green-500/60 text-green-400"
                  : "border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white"
              }`}
            >
              FILTERS
              {activeFilterCount > 0 && (
                <span className="text-[7px] bg-green-500/20 text-green-400 px-1 py-px border border-green-500/40">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Expandable advanced filters ── */}
        {showFilters && (
          <div className="border-t-2 border-pixel-border mt-2.5 pt-3 space-y-3">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-2">
              {([
                { label: "MIN VOLUME", value: minVolume, onChange: onDec(setMinVolume), ph: "100" },
                { label: "MIN TRADES", value: minTrades, onChange: onDec(setMinTrades), ph: "any" },
                { label: "MIN TRADES/DAY", value: minPerDay, onChange: onDec(setMinPerDay), ph: "0" },
                { label: "MIN BUY VOL", value: minBuyVolume, onChange: onDec(setMinBuyVolume), ph: "any" },
                { label: "MIN SELL VOL", value: minSellVolume, onChange: onDec(setMinSellVolume), ph: "any" },
                { label: "MIN P&L", value: minPnl, onChange: onDec(setMinPnl), ph: "any" },
              ] as const).map((f) => (
                <div key={f.label} className="flex flex-col gap-1">
                  <label className="text-[8px] text-pixel-gray tracking-wider">{f.label}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={f.value}
                    onChange={f.onChange}
                    onKeyDown={onEnter}
                    placeholder={f.ph}
                    className="pixel-input-sm w-full font-mono"
                  />
                </div>
              ))}
            </div>

            {/* Score formula */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[8px] text-pixel-gray tracking-wider shrink-0">SCORE =</label>
              <input type="text" value={formula} onChange={(e) => setFormula(e.target.value)} onKeyDown={onEnter} spellCheck={false}
                placeholder={DEFAULT_FORMULA} className="pixel-input-sm flex-1 min-w-[140px] font-mono" />
              <button onClick={() => setFormula(DEFAULT_FORMULA)}
                className="pixel-btn text-[8px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white shrink-0">RST</button>
              {compiled.error
                ? <span className="text-[8px] text-red-400 shrink-0 truncate max-w-[160px]">ERR: {compiled.error.slice(0, 30)}</span>
                : <span className="text-[8px] text-green-500 shrink-0">&#10003;</span>}
            </div>

            {/* Reset all */}
            <div className="flex items-center justify-end">
              <button onClick={() => { setDaysAgo(""); setMinTrades(""); setMinPerDay("0"); setMinVolume("100"); setMinBuyVolume(""); setMinSellVolume(""); setMinPnl(""); setFormula(DEFAULT_FORMULA); reload(); }}
                className="pixel-btn text-[8px] px-3 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-red-400 hover:text-red-400 transition-colors">
                RESET ALL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Strategy summary ── */}
      {!compact && savedStrats.length > 0 && (
        <div className="pixel-panel p-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[8px] text-pixel-gray tracking-wider mr-1">IN STRATS</span>
            {savedStrats.map((idx) => (
              <span key={idx.id} className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray cursor-default flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400" />
                {idx.name.toUpperCase()}
                <span className="text-pixel-gray-light">{idx.traders.length}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {loading && (() => {
        const lbDone = progress?.phase === "leaderboard" ? progress.done : 0;
        const lbTotal = progress?.phase === "leaderboard" ? progress.total : 0;
        const enrDone = progress?.phase === "enrich" ? progress.done : 0;
        const enrTotal = progress?.phase === "enrich" ? progress.total : 0;
        const enrKept = progress?.phase === "enrich" ? progress.kept : 0;
        const hoursScraped = progress?.phase === "enrich" ? progress.hoursScraped : 0;
        const hoursTarget = progress?.phase === "enrich" ? progress.hoursTarget : days * 24;
        let pct = 2;
        let label = "INITIALIZING";
        if (progress?.phase === "leaderboard" && lbTotal > 0) {
          pct = Math.round((lbDone / lbTotal) * 50);
          label = `LEADERBOARD ${lbDone}/${lbTotal}`;
        } else if (progress?.phase === "enrich" && enrTotal > 0) {
          pct = 50 + Math.round((enrDone / enrTotal) * 50);
          label = `ENRICHING ${enrDone}/${enrTotal} \u00b7 ${enrKept} kept \u00b7 ${hoursScraped}/${hoursTarget}h scraped`;
        }
        return (
          <div className="pixel-panel p-2">
            <div className="flex items-center gap-3 font-mono text-[8px]">
              <div className="w-2 h-2 bg-green-400 animate-pulse shrink-0" />
              <span className="text-pixel-white shrink-0">{label}</span>
              <div className="pixel-bar flex-1 h-2">
                <div className="pixel-bar-fill bg-green-400/60 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-pixel-gray-light shrink-0">{pct}%</span>
            </div>
          </div>
        );
      })()}

      {/* ── Table ── */}
      {loading && traders.length === 0 ? (
        <div className="pixel-panel p-8 text-center space-y-2">
          <div className="text-[11px] text-pixel-white">SCANNING POLYMARKET</div>
          <div className="text-[8px] text-pixel-gray">Results are cached hourly. Subsequent loads are instant.</div>
        </div>
      ) : traders.length > 0 ? (
        <>
          <div className="pixel-panel overflow-hidden">
            <div className="overflow-x-auto">
            <table className="pixel-table" style={{ minWidth: "700px", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "32px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "72px" }} />
                <col style={{ width: "80px" }} />
              </colgroup>
              <thead className="sticky">
                <tr>
                  <th className="num text-center">#</th>
                  <th>ADDRESS</th>
                  <th className="text-center">P&L CURVE</th>
                  {columns.map((col) => (
                    <th key={col.key}
                      className={`sortable num ${traderSort === col.key ? "sorted" : ""} text-right`}
                      onClick={() => handleSort(col.key)}>
                      {col.label}
                      <SortArrow active={traderSort === col.key} dir={sortDir} />
                    </th>
                  ))}
                  <th className="text-center"></th>
                </tr>
              </thead>
              <tbody>
                {pageTraders.map((trader, i) => {
                  const rowNum = safePage * PAGE_SIZE + i + 1;
                  const pnlColor = trader.pnl > 0 ? "text-green-400" : trader.pnl < 0 ? "text-red-400" : "text-pixel-gray-light";
                  const isInStrategy = traderStrategyMap.has(trader.address);
                  const sc = scoreFor(trader);
                  const scValid = Number.isFinite(sc);
                  const scCls = !scValid ? "text-pixel-gray" : sc > 0 ? "text-green-400" : sc < 0 ? "text-red-400" : "text-pixel-gray-light";

                  return (
                    <tr key={trader.address} className="cursor-pointer group" onClick={() => goToTrader(trader.address)}>
                      <td className="text-center !px-0">
                        <RankBadge rank={rowNum} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {isInStrategy && <div className="w-1.5 h-1.5 bg-green-400 shrink-0" />}
                          <span className="text-pixel-white font-mono text-[10px] group-hover:text-green-400 transition-colors truncate">
                            {shortAddress(trader.address)}
                          </span>
                        </div>
                      </td>
                      <td className="!px-2">
                        <div className="flex items-center justify-center">
                          <Sparkline data={trader.pnlCurve || []} width={120} height={26} />
                        </div>
                      </td>
                      <td className={`num text-right font-mono ${scCls}`} title={`score = ${formula}`}>
                        {scValid ? formatScore(sc) : "---"}
                      </td>
                      <td className={`num text-right font-mono ${pnlColor}`}>
                        {formatPnl(trader.pnl)}
                      </td>
                      <td className="num text-right text-pixel-white font-mono">
                        {formatVolume(trader.volume)}
                      </td>
                      <td className="num text-right text-pixel-gray-light font-mono">
                        {trader.recentTrades || trader.positions}
                      </td>
                      <td className="text-center !px-2 relative">
                        {onSelect ? (
                          selectedAddresses.includes(trader.address) ? (
                            <span className="text-[8px] text-green-400">ADDED</span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelect(trader.address); }}
                              className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:border-green-400 hover:text-green-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              + ADD
                            </button>
                          )
                        ) : addedFlash === trader.address ? (
                          <span className="text-[8px] text-green-400 animate-pulse">ADDED</span>
                        ) : (
                          <div ref={pickerOpen === trader.address ? pickerRef : undefined} className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshStrats();
                                setPickerOpen(pickerOpen === trader.address ? null : trader.address);
                                setCreatingInPicker(false);
                                setNewStratName("");
                              }}
                              className={`pixel-btn text-[8px] px-2 py-0.5 transition-all ${
                                traderStrategyMap.has(trader.address)
                                  ? "border-green-400 text-green-400 bg-green-400/10"
                                  : "border-pixel-border text-pixel-gray hover:border-pixel-white hover:text-pixel-white opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              {traderStrategyMap.has(trader.address)
                                ? `IN ${traderStrategyMap.get(trader.address)!.length}`
                                : "+ ADD"}
                            </button>
                            {pickerOpen === trader.address && (
                              <div
                                className="absolute z-50 right-0 top-full mt-1 pixel-panel border-2 border-pixel-border bg-pixel-black min-w-[160px] shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-[7px] text-pixel-gray tracking-wider px-2 py-1.5 border-b border-pixel-border">
                                  ADD TO STRAT
                                </div>
                                {savedStrats.length === 0 && !creatingInPicker && (
                                  <div className="px-2 py-2 text-[8px] text-pixel-gray">NO STRATS YET</div>
                                )}
                                {savedStrats.map((idx) => {
                                  const alreadyIn = idx.traders.some((t) => t.address === trader.address);
                                  return (
                                    <button
                                      key={idx.id}
                                      onClick={() => !alreadyIn && addToStrategy(trader.address, idx.id)}
                                      disabled={alreadyIn}
                                      className={`w-full text-left px-2 py-1.5 flex items-center justify-between text-[9px] transition-colors ${
                                        alreadyIn
                                          ? "text-pixel-gray cursor-default"
                                          : "text-pixel-white hover:bg-pixel-white/5"
                                      }`}
                                    >
                                      <span className="font-mono">{idx.name}</span>
                                      <span className="text-[7px] text-pixel-gray">
                                        {alreadyIn ? "IN" : `${idx.traders.length}`}
                                      </span>
                                    </button>
                                  );
                                })}
                                <div className="border-t border-pixel-border">
                                  {creatingInPicker ? (
                                    <div className="flex items-center gap-1 p-1.5">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={newStratName}
                                        onChange={(e) => setNewStratName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && newStratName.trim()) createStrategyAndAdd(trader.address, newStratName);
                                          if (e.key === "Escape") { setCreatingInPicker(false); setNewStratName(""); }
                                        }}
                                        placeholder="NAME"
                                        className="pixel-input-sm font-mono text-[8px] flex-1 py-0.5"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={() => newStratName.trim() && createStrategyAndAdd(trader.address, newStratName)}
                                        className="pixel-btn text-[7px] px-1.5 py-0.5 border-green-400 text-green-400"
                                      >
                                        GO
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setCreatingInPicker(true)}
                                      className="w-full text-left px-2 py-1.5 text-[9px] text-green-400 hover:bg-green-400/5 transition-colors"
                                    >
                                      + NEW STRAT
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1 px-1">
              <span className="text-[8px] text-pixel-gray font-mono">
                {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, totalTraders)} of {totalTraders}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
                  className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-20 disabled:cursor-not-allowed">PREV</button>
                {Array.from({ length: totalPages }, (_, i) => i)
                  .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - safePage) <= 2)
                  .reduce<(number | "dots")[]>((acc, i) => {
                    const last = acc[acc.length - 1];
                    if (last !== undefined && last !== "dots" && i - (last as number) > 1) acc.push("dots");
                    acc.push(i);
                    return acc;
                  }, [])
                  .map((tok, idx) =>
                    tok === "dots" ? (
                      <span key={`e${idx}`} className="text-[8px] text-pixel-gray px-0.5">...</span>
                    ) : (
                      <button key={tok} onClick={() => setPage(tok)}
                        className={`pixel-btn text-[8px] w-6 py-0.5 ${
                          safePage === tok
                            ? "border-pixel-white text-pixel-white"
                            : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                        }`}>{tok + 1}</button>
                    ),
                  )}
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
                  className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-20 disabled:cursor-not-allowed">NEXT</button>
              </div>
            </div>
          )}
        </>
      ) : hasLoaded && !loading ? (
        <div className="pixel-panel p-8 text-center text-[10px] text-pixel-gray">
          NO TRADERS MATCH CURRENT FILTERS
        </div>
      ) : null}
    </div>
  );
}
