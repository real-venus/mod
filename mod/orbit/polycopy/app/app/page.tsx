"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import StatsBar from "./components/StatsBar";
import PortfolioChart from "./components/PortfolioChart";
import ActivityChart from "./components/ActivityChart";
import StrategyCard from "./components/StrategyCard";
import StrategyDetail from "./components/StrategyDetail";
import TradesTable from "./components/TradesTable";
import SystemLog from "./components/SystemLog";
import ChainSelector from "./components/ChainSelector";
import PolymarketPanel from "./components/PolymarketPanel";
import BacktestPanel from "./components/BacktestPanel";
import ScrapeProgress from "./components/ScrapeProgress";
import TraderSearch, { SortField } from "./components/TraderSearch";
import { StrategyPerformance, Trade, PortfolioSnapshot } from "./lib/types";
import { fetchRecentSwaps, computeStrategies, aggregateHistory, ScrapeProgress as ScrapeProgressType } from "./lib/dex-data";
import { fetchActivityData, DailyDataPoint } from "./lib/activity-data";
import { useNetwork } from "./context/NetworkContext";
import { CHAINS } from "./lib/chains";

type Tab = "dex" | "polymarket" | "backtest";

export default function Home() {
  const [tab, setTab] = useState<Tab>("dex");
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const { chainId } = useNetwork();

  // Real data state
  const [strategies, setStrategies] = useState<StrategyPerformance[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [aggHistory, setAggHistory] = useState<PortfolioSnapshot[]>([]);
  const [activityData, setActivityData] = useState<DailyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scrape progress state
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgressType | null>(null);

  // Trader search/sort state
  const [traderSearch, setTraderSearch] = useState("");
  const [traderSort, setTraderSort] = useState<SortField>("trades");

  const loadDexData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScrapeProgress(null);
    try {
      const allTrades = await fetchRecentSwaps(chainId, 500, (p) => {
        setScrapeProgress({ ...p });
      });
      setTrades(allTrades);
      const strats = computeStrategies(allTrades);
      setStrategies(strats);
      setAggHistory(aggregateHistory(strats));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
    // Clear progress after a brief delay so user sees 100%
    setTimeout(() => setScrapeProgress(null), 800);
  }, [chainId]);

  const loadActivityData = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await fetchActivityData(chainId);
      setActivityData(data);
    } catch {
      // silent - chart will just be empty
    }
    setActivityLoading(false);
  }, [chainId]);

  useEffect(() => {
    if (tab === "dex") {
      loadDexData();
      loadActivityData();
    }
  }, [tab, loadDexData, loadActivityData]);

  // Filter and sort strategies
  const filteredStrategies = useMemo(() => {
    let result = chainFilter
      ? strategies.filter((s) => s.chainId === chainFilter)
      : strategies;

    // Apply search
    if (traderSearch.trim()) {
      const q = traderSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.address.toLowerCase().includes(q) ||
          s.label.toLowerCase().includes(q)
      );
    }

    // Apply sort
    switch (traderSort) {
      case "pnl":
        result = [...result].sort((a, b) => b.totalPnlUSD - a.totalPnlUSD);
        break;
      case "winRate":
        result = [...result].sort((a, b) => b.winRate - a.winRate);
        break;
      case "volume":
        result = [...result].sort((a, b) => b.totalVolume - a.totalVolume);
        break;
      case "drawdown":
        result = [...result].sort((a, b) => a.maxDrawdown - b.maxDrawdown);
        break;
      case "trades":
      default:
        result = [...result].sort((a, b) => b.totalTrades - a.totalTrades);
        break;
    }

    return result;
  }, [chainFilter, strategies, traderSearch, traderSort]);

  const selectedStrategyData = useMemo(
    () => strategies.find((s) => s.address === selectedStrategy),
    [selectedStrategy, strategies]
  );

  const chainName = CHAINS[chainId]?.shortName || "UNKNOWN";

  const tabs: { id: Tab; label: string }[] = [
    { id: "dex", label: "DEX COPY" },
    { id: "polymarket", label: "POLYMARKET" },
    { id: "backtest", label: "BACKTEST" },
  ];

  return (
    <div className="max-w-[1920px] mx-auto">
      {/* Tab Navigation */}
      <div className="border-b border-ibm-border/30 bg-ibm-panel/50">
        <div className="flex items-center gap-0 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-[11px] font-semibold tracking-widest transition-all border-b-2 ${
                tab === t.id
                  ? t.id === "dex"
                    ? "text-ibm-green border-ibm-green bg-ibm-green/5"
                    : t.id === "polymarket"
                    ? "text-ibm-blue border-ibm-blue bg-ibm-blue/5"
                    : "text-ibm-amber border-ibm-amber bg-ibm-amber/5"
                  : "text-ibm-gray-light border-transparent hover:text-ibm-white hover:border-ibm-border/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DEX COPY TAB */}
      {tab === "dex" && (
        <>
          {/* Show scrape progress during loading */}
          {loading && scrapeProgress && scrapeProgress.phase !== "done" ? (
            <div className="p-4">
              <ScrapeProgress progress={scrapeProgress} chainName={chainName} />
            </div>
          ) : loading && !scrapeProgress ? (
            <div className="p-8 text-center text-[11px] text-ibm-gray animate-pulse">
              INITIALIZING {chainName} SCANNER...
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="panel-glow bg-ibm-panel p-4 text-ibm-red text-[11px]">
                RPC ERROR: {error}
              </div>
              <button
                onClick={loadDexData}
                className="mt-3 px-4 py-2 text-[10px] border border-ibm-green/40 text-ibm-green hover:bg-ibm-green/10 transition-colors tracking-wider"
              >
                RETRY
              </button>
            </div>
          ) : (
            <>
              <StatsBar strategies={strategies} />
              <div className="p-4 space-y-4">
                {/* 30-Day Activity Chart */}
                {activityLoading ? (
                  <div className="panel-glow bg-ibm-panel p-8 text-center text-[11px] text-ibm-gray animate-pulse">
                    LOADING 30-DAY TRADE ACTIVITY...
                  </div>
                ) : activityData.length > 0 ? (
                  <ActivityChart data={activityData} />
                ) : null}

                {aggHistory.length > 0 && (
                  <PortfolioChart data={aggHistory} title="AGGREGATE PORTFOLIO" height={300} />
                )}

                {/* Trader Search & Sort */}
                <TraderSearch
                  searchQuery={traderSearch}
                  onSearchChange={setTraderSearch}
                  sortField={traderSort}
                  onSortChange={setTraderSort}
                  resultCount={filteredStrategies.length}
                  totalCount={strategies.length}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[11px] text-ibm-gray-light tracking-widest">
                      TOP TRADERS
                    </h2>
                    <ChainSelector selected={chainFilter} onSelect={setChainFilter} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-ibm-gray">
                      {filteredStrategies.length} traders on {chainName}
                    </span>
                    <button
                      onClick={() => { loadDexData(); loadActivityData(); }}
                      className="px-3 py-1 text-[10px] border border-ibm-border/40 text-ibm-gray-light hover:text-ibm-green hover:border-ibm-green/40 transition-colors tracking-wider"
                    >
                      REFRESH
                    </button>
                  </div>
                </div>

                {filteredStrategies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {filteredStrategies.map((strategy) => (
                      <StrategyCard
                        key={strategy.address}
                        strategy={strategy}
                        selected={selectedStrategy === strategy.address}
                        onClick={() =>
                          setSelectedStrategy(
                            selectedStrategy === strategy.address ? null : strategy.address
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="panel-glow bg-ibm-panel p-8 text-center text-[11px] text-ibm-gray">
                    {traderSearch
                      ? `NO TRADERS MATCHING "${traderSearch.toUpperCase()}" ON ${chainName}`
                      : `NO SWAP EVENTS FOUND IN RECENT BLOCKS ON ${chainName}`
                    }
                  </div>
                )}

                {selectedStrategyData && <StrategyDetail strategy={selectedStrategyData} />}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2">
                    <TradesTable
                      trades={trades}
                      filterProxy={selectedStrategy || undefined}
                    />
                  </div>
                  <div>
                    <SystemLog />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* POLYMARKET TAB */}
      {tab === "polymarket" && (
        <div className="p-4">
          <PolymarketPanel />
        </div>
      )}

      {/* BACKTEST TAB */}
      {tab === "backtest" && (
        <div className="p-4">
          <BacktestPanel />
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-ibm-border/20 mx-4 pt-4 pb-8 flex items-center justify-between text-[10px] text-ibm-gray">
        <div className="flex items-center gap-4">
          <span>POLYCOPY v0.2.0</span>
          <span className="text-ibm-border">|</span>
          <span>DEX + POLYMARKET</span>
          <span className="text-ibm-border">|</span>
          <span>NETWORK: {chainName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-ibm-green" />
          <span>ALL SYSTEMS NOMINAL</span>
        </div>
      </footer>
    </div>
  );
}
