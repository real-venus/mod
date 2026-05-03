"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchTopTradersStream, ActiveTradersProgress,
  formatVolume, formatPnl, TopTrader,
  CategorySlug, matchTraderCategory,
} from "../lib/polymarket";
import { shortAddress } from "@/lib/auth";
import { useFilters } from "../context/FiltersContext";

type TraderSort = "score" | "volume" | "pnl" | "positions";

// Default custom-score formula: winnings over volume. Captures
// efficiency — a trader who made $100 on $1k of volume ranks above
// one who made $200 on $50k of volume.
const DEFAULT_FORMULA = "pnl / volume";

// Compile a user-supplied JavaScript expression into a (trader) →
// number function. The compiled fn runs in strict mode with only the
// trader's numeric fields and Math in scope, so it can't reach
// globals (window, fetch, etc). Returns null on parse failure.
function compileFormula(expr: string): {
  fn: (t: { pnl: number; volume: number; positions: number; winRate: number; markets: number }) => number;
  error: null;
} | { fn: null; error: string } {
  try {
    const raw = new Function(
      "pnl", "volume", "positions", "winRate", "markets", "Math",
      `"use strict"; return (${expr});`,
    ) as (...args: unknown[]) => unknown;
    // Smoke test: must not throw on neutral inputs.
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
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  // Heuristic: small magnitude → render as a percentage (most likely a
  // ratio formula like pnl/volume). Larger → currency-style with k/M.
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
    <span className="inline-block w-3 ml-1 text-center">
      {active ? (dir === "desc" ? "\u25BC" : "\u25B2") : <span className="text-pixel-gray/40">-</span>}
    </span>
  );
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

  // Custom-score formula — persisted per-tab so users keep their
  // ranking when switching pages or refreshing.
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

  // Streaming progress state — populated as the API streams NDJSON events.
  const [progress, setProgress] = useState<ActiveTradersProgress | null>(null);
  const [source, setSource] = useState<"memory" | "disk" | "fresh" | null>(null);

  // Copy watchlist — start empty on both server and client to avoid a
  // hydration mismatch (the SSR pass can't see localStorage), then load
  // the saved list in a useEffect after mount.
  const [watchlist, setWatchlist] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = localStorage.getItem("poly8bit_watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved) as string[]));
    } catch {}
  }, []);

  // First load = full skeleton ("DISCOVERING ..." while stream runs).
  // Subsequent polls just refresh state without flipping the loading UI.
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (inFlightRef.current) return; // skip overlapping calls
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
          // Stream partials directly into the visible list as the
          // server enriches traders. The user sees the leaderboard
          // populate progressively rather than wait for completion.
          (partial) => {
            setTraders(partial);
            if (silent === false) {
              // Once we have any data, drop the "loading" skeleton.
              setLoading(false);
            }
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

  // Whenever `days` changes (or the user hits reload), wipe the visible
  // list immediately and refetch — otherwise the old window's traders
  // sit on screen looking authoritative while the new fetch is still
  // running, which is misleading.
  useEffect(() => {
    setTraders([]);
    setSource(null);
    setProgress(null);
    load();
  }, [load, reloadKey]);

  // Auto-refresh every 4 seconds. The server cache is hourly so warm
  // hits return instantly; this just picks up the latest cached state
  // (and any new entries the background scraper added) without the
  // user having to click reload.
  useEffect(() => {
    const t = setInterval(() => {
      void load({ silent: true });
    }, 4000);
    return () => clearInterval(t);
  }, [load]);

  // Save watchlist
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
    if (traderSort === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setTraderSort(col);
      setSortDir("desc");
    }
  };

  const goToTrader = (addr: string) => {
    router.push(`/traders/${addr}?days=${days}`);
  };

  // Volume thresholds come from the shared filter bar. Empty values mean
  // "no filter" — converted to 0 so the comparison passes for all traders.
  const { minVolume, minBuyVolume, minSellVolume } = useFilters();
  const minVol = Number(minVolume) || 0;
  const minBuy = Number(minBuyVolume) || 0;
  const minSell = Number(minSellVolume) || 0;

  const sortedTraders = [...traders]
    .filter((t) => {
      if (search.trim() && !t.address.toLowerCase().includes(search.toLowerCase())) return false;
      if (category && !matchTraderCategory(t.marketTitles, category)) return false;
      if (minVol > 0 && t.volume < minVol) return false;
      if (minBuy > 0 && (t.buyVolume ?? 0) < minBuy) return false;
      if (minSell > 0 && (t.sellVolume ?? 0) < minSell) return false;
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

  // Reset to page 0 whenever the filtered set or sort changes so we never
  // get stranded on a page that no longer exists (e.g. after a search).
  useEffect(() => {
    setPage(0);
  }, [search, category, traderSort, sortDir, traders.length]);

  const totalPages = Math.max(1, Math.ceil(sortedTraders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageTraders = sortedTraders.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const columns: { key: TraderSort; label: string; align: "left" | "right" }[] = [
    { key: "score", label: "SCORE", align: "right" },
    { key: "pnl", label: "P&L", align: "right" },
    { key: "volume", label: "VOLUME", align: "right" },
    { key: "positions", label: "POS", align: "right" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pixel-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-pixel-white flex items-center justify-center">
              <span className="text-[13px] text-pixel-white">T</span>
            </div>
            <div>
              <span className="text-sm text-pixel-white glow-green tracking-wider">
                TOP TRADERS
              </span>
              <div className="text-[10px] text-pixel-gray mt-1">{`ACTIVE TRADERS - ${days} DAY (1+/DAY)`}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="pixel-badge border-pixel-white text-pixel-white">
              {`${days}D`}
            </span>
            {source && (
              <span
                className={`pixel-badge text-[9px] ${
                  source === "fresh"
                    ? "border-pixel-amber text-pixel-amber"
                    : "border-pixel-green text-pixel-green"
                }`}
                title={
                  source === "memory" ? "served from in-memory cache"
                  : source === "disk" ? "served from disk cache"
                  : "freshly computed (will cache for 1 hour)"
                }
              >
                {source === "memory" ? "CACHED ⚡"
                  : source === "disk" ? "CACHED 💾"
                  : "FRESH 🔄"}
              </span>
            )}
            {refreshing && (
              <span
                className="text-[9px] text-pixel-cyan font-mono animate-pulse"
                title="Auto-refreshing every 4s"
              >
                ↻ LIVE
              </span>
            )}
            <span className="text-[11px] text-pixel-gray">
              {watchlist.size} WATCHING
            </span>
          </div>
        </div>

      </div>

      {/* Watchlist */}
      {watchlist.size > 0 && (
        <div className="pixel-panel p-5">
          <div className="text-[12px] text-pixel-white glow-green mb-3 tracking-wider">
            WATCHLIST
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(watchlist).map((addr) => {
              const trader = traders.find((t) => t.address === addr);
              return (
                <button
                  key={addr}
                  onClick={() => goToTrader(addr)}
                  className="pixel-btn border-pixel-white text-pixel-white text-[10px] flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-pixel-white" />
                  {shortAddress(addr)}
                  {trader && (
                    <span className={trader.pnl > 0 ? "text-green-400" : trader.pnl < 0 ? "text-red-400" : "text-pixel-gray-light"}>
                      {formatPnl(trader.pnl)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky load-progress strip — sits right below the page header
          while we're scanning the leaderboard and enriching traders. */}
      {loading && (() => {
        const lbDone   = progress?.phase === "leaderboard" ? progress.done   : 0;
        const lbTotal  = progress?.phase === "leaderboard" ? progress.total  : 0;
        const enrDone  = progress?.phase === "enrich" ? progress.done : 0;
        const enrTotal = progress?.phase === "enrich" ? progress.total : 0;
        const enrKept  = progress?.phase === "enrich" ? progress.kept : 0;
        const hoursScraped = progress?.phase === "enrich" ? progress.hoursScraped : 0;
        const hoursTarget  = progress?.phase === "enrich" ? progress.hoursTarget  : days * 24;

        let pct = 2;
        let label = "STARTING...";
        if (progress?.phase === "leaderboard" && lbTotal > 0) {
          pct = Math.round((lbDone / lbTotal) * 50);
          label = `LEADERBOARD ${lbDone}/${lbTotal} PAGES`;
        } else if (progress?.phase === "enrich" && enrTotal > 0) {
          // During enrich the bar reflects average scrape depth toward
          // the target window — that's the metric that matters for
          // "are we covering the requested days yet".
          const depthPct = Math.min(100, Math.round((hoursScraped / Math.max(1, hoursTarget)) * 100));
          pct = 50 + Math.round((enrDone / enrTotal) * 50);
          label = `ENRICH ${enrDone}/${enrTotal} · ${enrKept} ACTIVE · ${depthPct}% DEPTH`;
        }

        return (
          <div className="sticky top-14 z-30 -mx-4 -mt-4 border-b-2 border-pixel-border bg-pixel-black/95 px-4 py-2 mb-2 space-y-1">
            <div className="max-w-[1920px] mx-auto flex items-center gap-3 font-mono text-[10px]">
              <span className="text-pixel-green glow-green shrink-0">
                DISCOVERING
              </span>
              <span className="text-pixel-white shrink-0">{label}</span>
              <div className="pixel-bar flex-1 h-2.5">
                <div
                  className="pixel-bar-fill bg-pixel-green/70 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-pixel-gray shrink-0">
                PHASE {progress?.phase === "enrich" ? "2" : "1"}/2
              </span>
              <span className="text-pixel-gray-light shrink-0">{pct}%</span>
            </div>
            {progress?.phase === "enrich" && hoursTarget > 0 && (
              <div className="max-w-[1920px] mx-auto flex items-center gap-3 font-mono text-[9px]">
                <span className="text-pixel-cyan shrink-0">SCRAPED</span>
                <span className="text-pixel-white shrink-0">
                  {hoursScraped.toFixed(1)}H / {hoursTarget}H
                </span>
                <div className="pixel-bar flex-1 h-1.5">
                  <div
                    className="pixel-bar-fill bg-pixel-cyan/70 transition-all"
                    style={{
                      width: `${Math.min(100, (hoursScraped / hoursTarget) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-pixel-gray-light shrink-0">
                  AVG DEPTH ACROSS {enrKept || enrDone} TRADERS
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {loading && sortedTraders.length === 0 ? (
        <div className="pixel-panel p-8 text-[11px] text-pixel-gray text-center font-mono">
          CACHED HOURLY · FUTURE LOADS WILL BE INSTANT
        </div>
      ) : sortedTraders.length > 0 ? (
        <>
          {/* Custom score formula — defaults to pnl/volume. Available
              variables: pnl, volume, positions, winRate, markets. */}
          <div className="pixel-panel p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-pixel-gray-light tracking-wider shrink-0">
                SCORE =
              </span>
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                spellCheck={false}
                placeholder={DEFAULT_FORMULA}
                className="pixel-input flex-1 min-w-[180px] text-[11px] font-mono px-2 py-1"
              />
              <button
                onClick={() => setFormula(DEFAULT_FORMULA)}
                className="pixel-btn text-[9px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white shrink-0"
                title="Reset to default (pnl / volume)"
              >
                RESET
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap text-[9px] font-mono">
              <span className="text-pixel-gray">
                VARS: <span className="text-pixel-gray-light">pnl · volume · positions · winRate · markets</span>
              </span>
              {compiled.error ? (
                <span className="text-red-400">⚠ {compiled.error.slice(0, 80)}</span>
              ) : (
                <span className="text-pixel-green">✓ COMPILED</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-pixel-gray-light tracking-widest">
              TOP TRADERS
            </span>
            <span className="text-[11px] text-pixel-gray ml-4 font-mono">
              {sortedTraders.length} FOUND
              {totalPages > 1 && ` · PG ${safePage + 1}/${totalPages}`}
            </span>
          </div>

          <div className="pixel-panel overflow-x-auto">
            <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "820px" }}>
              <colgroup>
                <col style={{ width: "56px" }} />
                <col />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "88px" }} />
                <col style={{ width: "72px" }} />
                <col style={{ width: "120px" }} />
              </colgroup>
              <thead className="sticky">
                <tr>
                  <th className="num text-right">#</th>
                  <th>ADDRESS</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`sortable num ${traderSort === col.key ? "sorted" : ""} text-${col.align}`}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <SortArrow active={traderSort === col.key} dir={sortDir} />
                    </th>
                  ))}
                  <th className="text-center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pageTraders.map((trader, i) => {
                  const rowNum = safePage * PAGE_SIZE + i + 1;
                  const isProfit = trader.pnl > 0;
                  const isLoss = trader.pnl < 0;
                  const pnlColor = isProfit
                    ? "text-green-400"
                    : isLoss
                    ? "text-red-400"
                    : "text-pixel-gray-light";
                  const isWatching = watchlist.has(trader.address);
                  return (
                    <tr
                      key={trader.address}
                      className="cursor-pointer"
                      onClick={() => goToTrader(trader.address)}
                    >
                      <td className="num text-right text-pixel-gray font-mono">{rowNum}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 shrink-0 ${
                              isWatching ? "bg-pixel-white" : "bg-transparent"
                            }`}
                          />
                          <span className="text-pixel-white glow-green font-mono truncate">
                            {shortAddress(trader.address)}
                          </span>
                        </div>
                      </td>
                      {(() => {
                        const sc = scoreFor(trader);
                        const valid = Number.isFinite(sc);
                        const cls = !valid
                          ? "text-pixel-gray"
                          : sc > 0
                          ? "text-green-400"
                          : sc < 0
                          ? "text-red-400"
                          : "text-pixel-gray-light";
                        return (
                          <td
                            className={`num text-right font-mono ${cls}`}
                            title={`score = ${formula}`}
                          >
                            {valid ? formatScore(sc) : "—"}
                          </td>
                        );
                      })()}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatch(trader.address);
                          }}
                          className={`pixel-btn text-[10px] w-[96px] py-1 ${
                            isWatching
                              ? "border-pixel-white text-pixel-white bg-pixel-white/10"
                              : "border-pixel-border text-pixel-gray hover:border-pixel-white hover:text-pixel-white"
                          }`}
                        >
                          {isWatching ? "WATCHING" : "WATCH"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3 flex-wrap">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="pixel-btn text-[10px] border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                PREV
              </button>
              {Array.from({ length: totalPages }, (_, i) => i)
                // For long pagination, show first, last, current ±2, and ellipses.
                .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - safePage) <= 2)
                .reduce<(number | "…")[]>((acc, i) => {
                  const last = acc[acc.length - 1];
                  if (last !== undefined && last !== "…" && i - (last as number) > 1) acc.push("…");
                  acc.push(i);
                  return acc;
                }, [])
                .map((tok, idx) =>
                  tok === "…" ? (
                    <span key={`e${idx}`} className="text-[10px] text-pixel-gray px-1">…</span>
                  ) : (
                    <button
                      key={tok}
                      onClick={() => setPage(tok)}
                      className={`pixel-btn text-[10px] w-8 ${
                        safePage === tok
                          ? "border-pixel-green text-pixel-green bg-pixel-green/10"
                          : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                      }`}
                    >
                      {tok + 1}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                className="pixel-btn text-[10px] border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                NEXT
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="pixel-panel p-12 text-center text-[12px] text-pixel-gray">
          NO TRADERS FOUND
        </div>
      )}
    </div>
  );
}
