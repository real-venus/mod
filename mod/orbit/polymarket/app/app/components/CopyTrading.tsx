"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchTopTraders, fetchWalletTrades, fetchPositions,
  formatVolume, formatPnl, TopTrader,
  CATEGORIES, CategorySlug, matchTraderCategory,
} from "../lib/polymarket";
import { shortAddress } from "@/lib/auth";
import { PolymarketTrade, PolymarketPosition } from "../lib/types";
import TraderProfile from "./TraderProfile";

type TraderSort = "volume" | "pnl" | "winRate" | "positions";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-pixel-gray/40 ml-1">-</span>;
  return <span className="ml-1">{dir === "desc" ? "\u25BC" : "\u25B2"}</span>;
}

interface CopyTradingProps {
  days?: number;
  reloadKey?: number;
}

export default function CopyTrading({ days = 7, reloadKey = 0 }: CopyTradingProps = {}) {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [traderSort, setTraderSort] = useState<TraderSort>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategorySlug>("");

  // Selected trader state
  const [selectedTrader, setSelectedTrader] = useState<TopTrader | null>(null);
  const [traderTrades, setTraderTrades] = useState<PolymarketTrade[]>([]);
  const [traderPositions, setTraderPositions] = useState<PolymarketPosition[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  // Copy watchlist
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("poly8bit_watchlist");
      if (saved) {
        const arr: string[] = JSON.parse(saved);
        return new Set(arr);
      }
      return new Set();
    } catch {
      return new Set();
    }
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTopTraders(250, { daysWindow: days, minTradesPerDay: 1 });
      setTraders(data);
    } catch {
      setTraders([]);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

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

  const selectTrader = async (trader: TopTrader) => {
    setSelectedTrader(trader);
    setProfileLoading(true);
    try {
      const [trades, positions] = await Promise.all([
        fetchWalletTrades(trader.address, 200),
        fetchPositions(trader.address),
      ]);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      setTraderTrades(trades.filter((t) => t.timestamp >= thirtyDaysAgo));
      setTraderPositions(positions);
    } catch {
      setTraderTrades([]);
      setTraderPositions([]);
    }
    setProfileLoading(false);
  };

  const sortedTraders = [...traders]
    .filter((t) => {
      if (searchQuery.trim() && !t.address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (category && !matchTraderCategory(t.marketTitles, category)) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (traderSort) {
        case "volume": cmp = a.volume - b.volume; break;
        case "pnl": cmp = a.pnl - b.pnl; break;
        case "winRate": cmp = a.winRate - b.winRate; break;
        case "positions": cmp = a.positions - b.positions; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

  if (selectedTrader) {
    return (
      <TraderProfile
        trader={selectedTrader}
        trades={traderTrades}
        positions={traderPositions}
        loading={profileLoading}
        watching={watchlist.has(selectedTrader.address)}
        onToggleWatch={() => toggleWatch(selectedTrader.address)}
        onBack={() => setSelectedTrader(null)}
      />
    );
  }

  const columns: { key: TraderSort; label: string; align: "left" | "right" }[] = [
    { key: "volume", label: "VOLUME", align: "right" },
    { key: "pnl", label: "P&L", align: "right" },
    { key: "winRate", label: "WIN%", align: "right" },
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
            <span className="text-[11px] text-pixel-gray">
              {watchlist.size} WATCHING
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH BY ADDRESS..."
            className="pixel-input flex-1"
          />
          <button
            onClick={load}
            className="pixel-btn border-pixel-white text-pixel-white bg-pixel-white/10"
          >
            RELOAD
          </button>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setCategory(cat.slug)}
              className={`pixel-btn text-[9px] px-2.5 py-1 ${
                category === cat.slug
                  ? "border-pixel-white text-pixel-white bg-pixel-white/10"
                  : "border-pixel-border text-pixel-gray hover:text-pixel-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
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
                  onClick={() => trader && selectTrader(trader)}
                  className="pixel-btn border-pixel-white text-pixel-white text-[10px] flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-pixel-white" />
                  {shortAddress(addr)}
                  {trader && (
                    <span className={trader.pnl >= 0 ? "text-pixel-white" : "text-pixel-gray"}>
                      {formatPnl(trader.pnl)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="pixel-panel p-12 text-center">
          <div className="text-sm text-pixel-white animate-pulse glow-green">
            DISCOVERING TOP TRADERS...
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 border border-pixel-white/40"
                style={{
                  animation: `blink 1.5s step-end infinite`,
                  animationDelay: `${i * 200}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ) : sortedTraders.length > 0 ? (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-pixel-gray-light tracking-widest">
              TOP TRADERS
            </span>
            <span className="text-[11px] text-pixel-gray ml-4">{sortedTraders.length} FOUND</span>
          </div>

          <div className="pixel-panel overflow-x-auto">
            <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "700px" }}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "100px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>ADDRESS</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`sortable ${traderSort === col.key ? "sorted" : ""} text-${col.align}`}
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
                {sortedTraders.map((trader, i) => {
                  const isProfit = trader.pnl >= 0;
                  const isWatching = watchlist.has(trader.address);
                  return (
                    <tr
                      key={trader.address}
                      className="cursor-pointer"
                      onClick={() => selectTrader(trader)}
                    >
                      <td className="text-pixel-gray font-mono">{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {isWatching && <div className="w-2 h-2 bg-pixel-white shrink-0" />}
                          <span className="text-pixel-white glow-green font-mono">
                            {shortAddress(trader.address)}
                          </span>
                        </div>
                      </td>
                      <td className="text-right text-pixel-white font-mono">
                        {formatVolume(trader.volume)}
                      </td>
                      <td className={`text-right font-mono ${isProfit ? "text-pixel-white" : "text-pixel-gray"}`}>
                        {formatPnl(trader.pnl)}
                      </td>
                      <td className={`text-right font-mono ${trader.winRate >= 50 ? "text-pixel-white" : "text-pixel-gray"}`}>
                        {trader.winRate.toFixed(1)}%
                      </td>
                      <td className="text-right text-pixel-gray-light font-mono">
                        {trader.positions}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatch(trader.address);
                          }}
                          className={`pixel-btn text-[10px] px-2.5 py-1 ${
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
        </>
      ) : (
        <div className="pixel-panel p-12 text-center text-[12px] text-pixel-gray">
          NO TRADERS FOUND
        </div>
      )}
    </div>
  );
}
