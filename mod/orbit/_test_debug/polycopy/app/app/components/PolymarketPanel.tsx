"use client";

import { useState, useEffect, useCallback } from "react";
import MarketCard from "./MarketCard";
import PositionsTable from "./PositionsTable";
import { PolymarketMarket, PolymarketPosition } from "../lib/types";
import { fetchMarkets, searchMarkets, fetchPositions, fetchTopTraders, searchTopTraders, PolymarketTrader } from "../lib/polymarket";
import { shortAddress } from "../lib/wallet";

type SortMode = "volume" | "liquidity" | "end_date_min";
type PanelView = "markets" | "traders";
type TraderSort = "volume" | "pnl" | "winRate" | "positions";

export default function PolymarketPanel() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);
  const [traders, setTraders] = useState<PolymarketTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradersLoading, setTradersLoading] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("volume");
  const [walletInput, setWalletInput] = useState("");
  const [trackedWallet, setTrackedWallet] = useState<string | null>(null);
  const [view, setView] = useState<PanelView>("markets");
  const [traderSearch, setTraderSearch] = useState("");
  const [traderSort, setTraderSort] = useState<TraderSort>("volume");

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = search.trim()
        ? await searchMarkets(search.trim(), 30)
        : await fetchMarkets(30, sort);
      setMarkets(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [search, sort]);

  const loadTraders = useCallback(async () => {
    setTradersLoading(true);
    try {
      const data = traderSearch.trim()
        ? await searchTopTraders(traderSearch.trim())
        : await fetchTopTraders(30);
      setTraders(data);
    } catch {
      setTraders([]);
    }
    setTradersLoading(false);
  }, [traderSearch]);

  useEffect(() => {
    if (view === "markets") loadMarkets();
    else loadTraders();
  }, [view, loadMarkets, loadTraders]);

  const sortedTraders = [...traders].sort((a, b) => {
    switch (traderSort) {
      case "volume": return b.volume - a.volume;
      case "pnl": return b.pnl - a.pnl;
      case "winRate": return b.winRate - a.winRate;
      case "positions": return b.positions - a.positions;
      default: return 0;
    }
  });

  const loadPositions = async () => {
    const addr = walletInput.trim();
    if (!addr || !addr.startsWith("0x")) return;
    setTrackedWallet(addr);
    setPosLoading(true);
    try {
      const pos = await fetchPositions(addr);
      setPositions(pos);
    } catch {
      setPositions([]);
    }
    setPosLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-0">
        <button
          onClick={() => setView("markets")}
          className={`px-4 py-2 text-[11px] tracking-widest border-b-2 transition-all ${
            view === "markets"
              ? "text-ibm-blue border-ibm-blue bg-ibm-blue/5"
              : "text-ibm-gray-light border-transparent hover:text-ibm-white"
          }`}
        >
          MARKETS
        </button>
        <button
          onClick={() => setView("traders")}
          className={`px-4 py-2 text-[11px] tracking-widest border-b-2 transition-all ${
            view === "traders"
              ? "text-ibm-green border-ibm-green bg-ibm-green/5"
              : "text-ibm-gray-light border-transparent hover:text-ibm-white"
          }`}
        >
          TOP TRADERS
        </button>
      </div>

      {view === "markets" ? (
        <>
          {/* Header controls */}
          <div className="panel-glow bg-ibm-panel p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SEARCH MARKETS..."
                  className="w-full bg-ibm-black/50 border border-ibm-border/40 px-3 py-2 text-[11px] text-ibm-green font-mono placeholder:text-ibm-gray focus:outline-none focus:border-ibm-green/40"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["volume", "liquidity", "end_date_min"] as SortMode[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`px-2 py-1.5 text-[10px] tracking-wider transition-colors ${
                      sort === s
                        ? "bg-ibm-green/20 text-ibm-green border border-ibm-green/40"
                        : "text-ibm-gray-light hover:text-ibm-white border border-transparent"
                    }`}
                  >
                    {s === "end_date_min" ? "ENDING SOON" : s.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={loadMarkets}
                className="px-3 py-1.5 text-[10px] border border-ibm-border/40 text-ibm-gray-light hover:text-ibm-green hover:border-ibm-green/40 transition-colors tracking-wider"
              >
                REFRESH
              </button>
            </div>
          </div>

          {error && (
            <div className="panel-glow bg-ibm-panel p-4 text-ibm-red text-[11px]">
              ERROR: {error}
            </div>
          )}

          {loading ? (
            <div className="panel-glow bg-ibm-panel p-8 text-center text-[11px] text-ibm-gray animate-pulse">
              LOADING MARKETS FROM POLYMARKET...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] text-ibm-gray-light tracking-widest">
                  PREDICTION MARKETS
                </h2>
                <span className="text-[10px] text-ibm-gray">{markets.length} markets</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {markets.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Top Traders view */}
          <div className="panel-glow bg-ibm-panel p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ibm-gray">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={traderSearch}
                  onChange={(e) => setTraderSearch(e.target.value)}
                  placeholder="SEARCH TRADERS BY ADDRESS..."
                  className="w-full bg-ibm-black/50 border border-ibm-border/40 px-8 py-2 text-[11px] text-ibm-green font-mono placeholder:text-ibm-gray focus:outline-none focus:border-ibm-green/40"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-ibm-gray tracking-wider mr-1">SORT:</span>
                {(["volume", "pnl", "winRate", "positions"] as TraderSort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setTraderSort(s)}
                    className={`px-2 py-1.5 text-[10px] tracking-wider transition-colors border ${
                      traderSort === s
                        ? "bg-ibm-green/15 text-ibm-green border-ibm-green/40"
                        : "text-ibm-gray-light hover:text-ibm-white border-transparent"
                    }`}
                  >
                    {s === "winRate" ? "WIN%" : s.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={loadTraders}
                className="px-3 py-1.5 text-[10px] border border-ibm-border/40 text-ibm-gray-light hover:text-ibm-green hover:border-ibm-green/40 transition-colors tracking-wider"
              >
                REFRESH
              </button>
            </div>
          </div>

          {tradersLoading ? (
            <div className="panel-glow bg-ibm-panel p-8 text-center text-[11px] text-ibm-gray animate-pulse">
              DISCOVERING TOP POLYMARKET TRADERS...
            </div>
          ) : sortedTraders.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] text-ibm-gray-light tracking-widest">
                  TOP TRADERS
                </h2>
                <span className="text-[10px] text-ibm-gray">{sortedTraders.length} traders</span>
              </div>
              <div className="panel-glow bg-ibm-panel overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-ibm-border/30 text-ibm-gray-light">
                      <th className="text-left px-4 py-2 text-[9px] tracking-wider">#</th>
                      <th className="text-left px-4 py-2 text-[9px] tracking-wider">ADDRESS</th>
                      <th className="text-right px-4 py-2 text-[9px] tracking-wider">VOLUME</th>
                      <th className="text-right px-4 py-2 text-[9px] tracking-wider">P&L</th>
                      <th className="text-right px-4 py-2 text-[9px] tracking-wider">WIN%</th>
                      <th className="text-right px-4 py-2 text-[9px] tracking-wider">POSITIONS</th>
                      <th className="text-right px-4 py-2 text-[9px] tracking-wider">MARKETS</th>
                      <th className="text-center px-4 py-2 text-[9px] tracking-wider">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTraders.map((trader, i) => {
                      const isProfitable = trader.pnl >= 0;
                      return (
                        <tr
                          key={trader.address}
                          className="border-b border-ibm-border/10 hover:bg-ibm-green/5 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-ibm-gray font-mono">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-ibm-green font-mono glow-text">
                              {shortAddress(trader.address)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-ibm-white font-mono">
                            ${trader.volume >= 1000000
                              ? (trader.volume / 1000000).toFixed(1) + "M"
                              : trader.volume >= 1000
                              ? (trader.volume / 1000).toFixed(0) + "K"
                              : trader.volume.toFixed(0)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono ${isProfitable ? "text-ibm-green" : "text-ibm-red"}`}>
                            {isProfitable ? "+" : ""}${Math.abs(trader.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono ${trader.winRate >= 50 ? "text-ibm-green" : "text-ibm-red"}`}>
                            {trader.winRate.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2.5 text-right text-ibm-gray-light font-mono">
                            {trader.positions}
                          </td>
                          <td className="px-4 py-2.5 text-right text-ibm-gray-light font-mono">
                            {trader.marketsTraded}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => {
                                setWalletInput(trader.address);
                                setTrackedWallet(trader.address);
                                setView("markets");
                                // Auto-load positions
                                setPosLoading(true);
                                fetchPositions(trader.address)
                                  .then(setPositions)
                                  .catch(() => setPositions([]))
                                  .finally(() => setPosLoading(false));
                              }}
                              className="px-2 py-1 text-[9px] border border-ibm-green/30 text-ibm-green hover:bg-ibm-green/10 transition-colors tracking-wider"
                            >
                              TRACK
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
            <div className="panel-glow bg-ibm-panel p-8 text-center text-[11px] text-ibm-gray">
              NO TRADERS FOUND
            </div>
          )}
        </>
      )}

      {/* Wallet positions section */}
      <div className="panel-glow bg-ibm-panel p-4">
        <h3 className="text-[11px] text-ibm-gray-light tracking-widest mb-3">
          TRACK WALLET POSITIONS
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadPositions()}
            placeholder="0x... WALLET ADDRESS"
            className="flex-1 bg-ibm-black/50 border border-ibm-border/40 px-3 py-2 text-[11px] text-ibm-green font-mono placeholder:text-ibm-gray focus:outline-none focus:border-ibm-green/40"
          />
          <button
            onClick={loadPositions}
            className="px-4 py-2 text-[10px] bg-ibm-green/10 border border-ibm-green/40 text-ibm-green hover:bg-ibm-green/20 transition-colors tracking-wider"
          >
            TRACK
          </button>
        </div>
        {trackedWallet && (
          <div className="mt-2 text-[10px] text-ibm-gray-light font-mono">
            TRACKING: {trackedWallet}
          </div>
        )}
      </div>

      {trackedWallet && (
        <PositionsTable positions={positions} loading={posLoading} />
      )}
    </div>
  );
}
