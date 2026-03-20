"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTopTraders, fetchWalletTrades, fetchPositions, formatVolume, formatPnl, TopTrader } from "../lib/polymarket";
import { shortAddress } from "../lib/auth";
import { PolymarketTrade, PolymarketPosition } from "../lib/types";
import TraderProfile from "./TraderProfile";

type TraderSort = "volume" | "pnl" | "winRate" | "positions";

export default function CopyTrading() {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [traderSort, setTraderSort] = useState<TraderSort>("volume");
  const [searchQuery, setSearchQuery] = useState("");

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
      const data = await fetchTopTraders(30);
      setTraders(data);
    } catch {
      setTraders([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
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

  const selectTrader = async (trader: TopTrader) => {
    setSelectedTrader(trader);
    setProfileLoading(true);
    try {
      const [trades, positions] = await Promise.all([
        fetchWalletTrades(trader.address, 200),
        fetchPositions(trader.address),
      ]);
      // Filter to last 30 days
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
      if (!searchQuery.trim()) return true;
      return t.address.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      switch (traderSort) {
        case "volume": return b.volume - a.volume;
        case "pnl": return b.pnl - a.pnl;
        case "winRate": return b.winRate - a.winRate;
        case "positions": return b.positions - a.positions;
        default: return 0;
      }
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="pixel-panel p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-pixel-magenta flex items-center justify-center">
              <span className="text-[8px] text-pixel-magenta">CP</span>
            </div>
            <span className="text-[8px] text-pixel-magenta glow-magenta tracking-wider">
              COPY TRADING
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="pixel-badge border-pixel-amber text-pixel-amber">
              30D HISTORY
            </span>
            <span className="text-[6px] text-pixel-gray">
              {watchlist.size} WATCHING
            </span>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH BY ADDRESS..."
            className="pixel-input flex-1"
          />
          <div className="flex items-center gap-1">
            <span className="text-[6px] text-pixel-gray mr-1">SORT:</span>
            {(["volume", "pnl", "winRate", "positions"] as TraderSort[]).map((s) => (
              <button
                key={s}
                onClick={() => setTraderSort(s)}
                className={`pixel-btn text-[6px] ${
                  traderSort === s
                    ? "border-pixel-magenta text-pixel-magenta bg-pixel-magenta/10"
                    : "border-pixel-border text-pixel-gray"
                }`}
              >
                {s === "winRate" ? "WIN%" : s.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10"
          >
            RELOAD
          </button>
        </div>
      </div>

      {/* Watchlist */}
      {watchlist.size > 0 && (
        <div className="pixel-panel-amber p-3">
          <div className="text-[7px] text-pixel-amber glow-amber mb-2 tracking-wider">
            WATCHLIST
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(watchlist).map((addr) => {
              const trader = traders.find((t) => t.address === addr);
              return (
                <button
                  key={addr}
                  onClick={() => trader && selectTrader(trader)}
                  className="pixel-btn border-pixel-amber text-pixel-amber text-[6px] flex items-center gap-1"
                >
                  <div className="w-1.5 h-1.5 bg-pixel-amber" />
                  {shortAddress(addr)}
                  {trader && (
                    <span className={trader.pnl >= 0 ? "text-pixel-green" : "text-pixel-red"}>
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
        <div className="pixel-panel p-8 text-center">
          <div className="text-[8px] text-pixel-magenta animate-pulse glow-magenta">
            DISCOVERING TOP TRADERS...
          </div>
          <div className="mt-3 flex justify-center gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 border border-pixel-magenta/40"
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
            <span className="text-[7px] text-pixel-gray-light tracking-widest">
              TOP TRADERS
            </span>
            <span className="text-[6px] text-pixel-gray">{sortedTraders.length} FOUND</span>
          </div>

          <div className="pixel-panel overflow-hidden">
            <table className="pixel-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>ADDRESS</th>
                  <th className="text-right">VOLUME</th>
                  <th className="text-right">P&L</th>
                  <th className="text-right">WIN%</th>
                  <th className="text-right">POS</th>
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
                          {isWatching && <div className="w-1.5 h-1.5 bg-pixel-amber" />}
                          <span className="text-pixel-green glow-green font-mono">
                            {shortAddress(trader.address)}
                          </span>
                        </div>
                      </td>
                      <td className="text-right text-pixel-white font-mono">
                        {formatVolume(trader.volume)}
                      </td>
                      <td className={`text-right font-mono ${isProfit ? "text-pixel-green" : "text-pixel-red"}`}>
                        {formatPnl(trader.pnl)}
                      </td>
                      <td className={`text-right font-mono ${trader.winRate >= 50 ? "text-pixel-green" : "text-pixel-red"}`}>
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
                          className={`pixel-btn text-[5px] ${
                            isWatching
                              ? "border-pixel-amber text-pixel-amber bg-pixel-amber/10"
                              : "border-pixel-border text-pixel-gray hover:border-pixel-green hover:text-pixel-green"
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
        <div className="pixel-panel p-8 text-center text-[7px] text-pixel-gray">
          NO TRADERS FOUND
        </div>
      )}
    </div>
  );
}
