"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchTopTradersStream, ActiveTradersProgress,
  formatVolume, formatPnl, TopTrader,
  CategorySlug, matchTraderCategory, matchTraderSearch,
} from "../lib/polymarket";
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
const PAGE_SIZE = 25;

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
}

export default function CopyTrading({
  days = 7,
  minTradesPerDay = 0,
  reloadKey = 0,
  search = "",
  category = "",
}: CopyTradingProps = {}) {
  const router = useRouter();
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [traderSort, setTraderSort] = useState<TraderSort>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

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

  const [watchlist, setWatchlist] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = localStorage.getItem("poly8bit_watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved) as string[]));
    } catch {}
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const silent = !!opts.silent;
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setProgress(null);
        setSource(null);
      }
      try {
        const { traders: data, source: src } = await fetchTopTradersStream(
          2000,
          { daysWindow: days, minTradesPerDay },
          (p) => setProgress(p),
          (partial) => {
            setTraders(partial);
            if (silent === false) setLoading(false);
          },
        );
        setTraders(data);
        setSource(src);
      } catch {
        if (!silent) setTraders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        inFlightRef.current = false;
      }
    },
    [days, minTradesPerDay],
  );

  useEffect(() => {
    setTraders([]);
    setSource(null);
    setProgress(null);
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    const t = setInterval(() => { void load({ silent: true }); }, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    localStorage.setItem("poly8bit_watchlist", JSON.stringify(Array.from(watchlist)));
  }, [watchlist]);

  const toggleWatch = (addr: string) => {
    setWatchlist((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  };

  const handleSort = (col: TraderSort) => {
    if (traderSort === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setTraderSort(col); setSortDir("desc"); }
  };

  const filterQs = useFilterParams();
  const goToTrader = (addr: string) => {
    router.push(`/traders/${addr}${filterQs ? `?${filterQs}` : ""}`);
  };

  const {
    daysAgo, setDaysAgo,
    minPerDay, setMinPerDay,
    minVolume, setMinVolume, minBuyVolume, setMinBuyVolume,
    minSellVolume, setMinSellVolume,
    minPnl, setMinPnl,
  } = useFilters();
  const minVol = Number(minVolume) || 0;
  const minBuy = Number(minBuyVolume) || 0;
  const minSell = Number(minSellVolume) || 0;
  const minPnlVal = minPnl !== "" ? Number(minPnl) : NaN;

  const sortedTraders = [...traders]
    .filter((t) => {
      if (!matchTraderSearch(t, search)) return false;
      if (category && !matchTraderCategory(t.marketTitles, category)) return false;
      if (minVol > 0 && t.volume < minVol) return false;
      if (minBuy > 0 && (t.buyVolume ?? 0) < minBuy) return false;
      if (minSell > 0 && (t.sellVolume ?? 0) < minSell) return false;
      if (Number.isFinite(minPnlVal) && t.pnl < minPnlVal) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (traderSort) {
        case "score": cmp = scoreFor(a) - scoreFor(b); break;
        case "volume": cmp = a.volume - b.volume; break;
        case "pnl": cmp = a.pnl - b.pnl; break;
        case "positions": cmp = a.positions - b.positions; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

  useEffect(() => { setPage(0); }, [search, category, traderSort, sortDir, traders.length]);

  const totalPages = Math.max(1, Math.ceil(sortedTraders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageTraders = sortedTraders.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const columns: { key: TraderSort; label: string }[] = [
    { key: "score", label: "SCORE" },
    { key: "pnl", label: "P&L" },
    { key: "volume", label: "VOL" },
    { key: "positions", label: "POS" },
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
    minVolume, minBuyVolume, minSellVolume, minPnl,
  ].filter((v) => v !== "").length
    + (minPerDay !== "1" && minPerDay !== "" ? 1 : 0)
    + (formula !== DEFAULT_FORMULA ? 1 : 0);

  // Stats summary
  const totalPnl = traders.reduce((s, t) => s + t.pnl, 0);
  const totalVol = traders.reduce((s, t) => s + t.volume, 0);

  return (
    <div className="space-y-3">
      {/* ── Single-line header ── */}
      <div className="pixel-panel px-4 py-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title */}
          <span className="text-[11px] text-pixel-white tracking-wider shrink-0">TOP TRADERS</span>

          {/* Days input */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] text-pixel-gray tracking-wider">DAYS</span>
            <input type="text" inputMode="numeric" value={daysAgo} onChange={onInt(setDaysAgo, 365)}
              onKeyDown={onEnter} placeholder="7"
              className="pixel-input-sm w-10 text-center font-mono text-[9px]" />
          </div>

          {/* Inline stats */}
          {traders.length > 0 && !loading && (
            <div className="flex items-center gap-3 text-[9px] font-mono shrink-0">
              <span className="text-pixel-gray">|</span>
              <span className="text-pixel-white">{traders.length} traders</span>
              <span className="text-pixel-gray">·</span>
              <span className="text-pixel-gray">P&L</span>
              <span className={totalPnl >= 0 ? "text-green-400" : "text-red-400"}>{formatPnl(totalPnl)}</span>
              <span className="text-pixel-gray">·</span>
              <span className="text-pixel-gray">VOL</span>
              <span className="text-pixel-white">{formatVolume(totalVol)}</span>
            </div>
          )}

          {/* Right side: filters + status */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {source && (
              <span className={`pixel-badge text-[7px] px-1.5 py-0.5 ${
                source === "fresh" ? "border-yellow-500 text-yellow-400" : "border-pixel-gray text-pixel-gray-light"
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

            <span className="text-[10px] text-pixel-white font-mono">{sortedTraders.length}</span>
          </div>
        </div>

        {/* ── Expandable advanced filters ── */}
        {showFilters && (
          <div className="border-t-2 border-pixel-border mt-2.5 pt-3 space-y-3">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-2">
              {([
                { label: "MIN TRADES/DAY", value: minPerDay, onChange: onDec(setMinPerDay), ph: "1" },
                { label: "MIN VOLUME", value: minVolume, onChange: onDec(setMinVolume), ph: "any" },
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
              <button onClick={() => { setDaysAgo(""); setMinPerDay("1"); setMinVolume(""); setMinBuyVolume(""); setMinSellVolume(""); setMinPnl(""); setFormula(DEFAULT_FORMULA); }}
                className="pixel-btn text-[8px] px-3 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-red-400 hover:text-red-400 transition-colors">
                RESET ALL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Watchlist ── */}
      {watchlist.size > 0 && (
        <div className="pixel-panel p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[8px] text-pixel-gray tracking-wider mr-1">WATCHING</span>
            {Array.from(watchlist).map((addr) => {
              const trader = traders.find((t) => t.address === addr);
              return (
                <button key={addr} onClick={() => goToTrader(addr)}
                  className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-white hover:border-pixel-white flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400" />
                  {shortAddress(addr)}
                  {trader && (
                    <span className={trader.pnl > 0 ? "text-green-400" : trader.pnl < 0 ? "text-red-400" : "text-pixel-gray"}>
                      {formatPnl(trader.pnl)}
                    </span>
                  )}
                </button>
              );
            })}
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
          const depthPct = Math.min(100, Math.round((hoursScraped / Math.max(1, hoursTarget)) * 100));
          pct = 50 + Math.round((enrDone / enrTotal) * 50);
          label = `ENRICHING ${enrDone}/${enrTotal} \u00b7 ${enrKept} kept \u00b7 depth ${depthPct}%`;
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
      {loading && sortedTraders.length === 0 ? (
        <div className="pixel-panel p-8 text-center space-y-2">
          <div className="text-[11px] text-pixel-white">SCANNING POLYMARKET</div>
          <div className="text-[8px] text-pixel-gray">Results are cached hourly. Subsequent loads are instant.</div>
        </div>
      ) : sortedTraders.length > 0 ? (
        <>
          <div className="pixel-panel overflow-hidden">
            <div className="overflow-x-auto">
            <table className="pixel-table" style={{ minWidth: "800px" }}>
              <colgroup>
                <col style={{ width: "4%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                {columns.map((c) => <col key={c.key} style={{ width: c.key === "positions" ? "8%" : "13%" }} />)}
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead className="sticky">
                <tr>
                  <th className="num text-center">#</th>
                  <th>ADDRESS</th>
                  <th>P&L CURVE</th>
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
                  const isWatching = watchlist.has(trader.address);
                  const sc = scoreFor(trader);
                  const scValid = Number.isFinite(sc);
                  const scCls = !scValid ? "text-pixel-gray" : sc > 0 ? "text-green-400" : sc < 0 ? "text-red-400" : "text-pixel-gray-light";

                  return (
                    <tr key={trader.address} className="cursor-pointer group" onClick={() => goToTrader(trader.address)}>
                      <td className="text-center">
                        <RankBadge rank={rowNum} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {isWatching && <div className="w-1.5 h-1.5 bg-green-400 shrink-0" />}
                          <span className="text-pixel-white font-mono text-[10px] group-hover:text-green-400 transition-colors truncate">
                            {shortAddress(trader.address)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Sparkline data={trader.pnlCurve || []} width={120} height={26} />
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
                        {trader.positions}
                      </td>
                      <td className="text-center">
                        <button onClick={(e) => { e.stopPropagation(); toggleWatch(trader.address); }}
                          className={`pixel-btn text-[8px] px-2 py-0.5 transition-all ${
                            isWatching
                              ? "border-green-400 text-green-400 bg-green-400/10"
                              : "border-pixel-border text-pixel-gray hover:border-pixel-white hover:text-pixel-white opacity-0 group-hover:opacity-100"
                          }`}>
                          {isWatching ? "WATCHING" : "WATCH"}
                        </button>
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
                {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, sortedTraders.length)} of {sortedTraders.length}
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
      ) : (
        <div className="pixel-panel p-8 text-center text-[10px] text-pixel-gray">
          NO TRADERS MATCH CURRENT FILTERS
        </div>
      )}
    </div>
  );
}
