"use client";

import { Suspense, useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import PnlChart from "../components/PnlChart";
import type { CurvePoint } from "../components/PnlChart";
import { useFilters, useUrlSync } from "../context/FiltersContext";
import { loadIndexes, getActiveIndexId } from "../lib/indexStore";
import { fetchWalletTrades, fetchPositions } from "../lib/polymarket";
import { computeFifoTrades, buildTradeByTradeCombinedCurve, buildPnlCurve } from "../lib/pnlEngine";
import type { IndexTrader } from "../lib/types";

function TradersInner() {
  useUrlSync();
  const { search, category, daysAgo, minPerDay, reloadKey } = useFilters();
  const days = Number(daysAgo) > 0 ? Number(daysAgo) : 30;
  const minTradesPerDay =
    minPerDay !== "" && Number.isFinite(Number(minPerDay))
      ? Math.max(0, Number(minPerDay))
      : 0;

  const [activeTab, setActiveTab] = useState<string>("STRATEGY");
  const [activeTraders, setActiveTraders] = useState<IndexTrader[]>([]);
  const [pnlCurve, setPnlCurve] = useState<CurvePoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [tradesPage, setTradesPage] = useState(0);
  const [hoveredTradeIndex, setHoveredTradeIndex] = useState<number | null>(null);
  const [traderData, setTraderData] = useState<Map<string, {
    pnlCurve: CurvePoint[];
    trades: any[];
    weight: number;
  }>>(new Map());
  const TRADES_PAGE_SIZE = 50;

  useEffect(() => {
    const refresh = () => {
      const indexes = loadIndexes();
      const activeId = getActiveIndexId();
      const active = activeId ? indexes.find((i) => i.id === activeId) : indexes[0];
      setActiveTraders(active ? active.traders : []);
    };
    refresh();
    window.addEventListener("strat-updated", refresh);
    return () => window.removeEventListener("strat-updated", refresh);
  }, []);

  // Load P&L data for strategy and all individual traders
  useEffect(() => {
    const loadAllData = async () => {
      const indexes = loadIndexes();
      const activeId = getActiveIndexId();
      const active = activeId ? indexes.find((i) => i.id === activeId) : indexes[0];

      if (!active || active.traders.length === 0) {
        setPnlCurve([]);
        setAllTrades([]);
        setTraderData(new Map());
        return;
      }

      setLoadingChart(true);
      try {
        const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
        const rawTraderData: {
          address: string;
          trades: any[];
          positions: any[];
          weight: number;
          traderAddress: string;
        }[] = [];

        // Fetch all trader data
        for (const trader of active.traders) {
          try {
            const [trades, positions] = await Promise.all([
              fetchWalletTrades(trader.address, 500),
              fetchPositions(trader.address),
            ]);

            const annotated = computeFifoTrades(trades, positions);

            rawTraderData.push({
              address: trader.address,
              traderAddress: trader.address,
              trades: annotated,
              positions,
              weight: trader.weight,
            });
          } catch (err) {
            console.error(`Failed to load data for ${trader.address}:`, err);
          }
        }

        // Build combined curve for STRATEGY tab
        const combined = buildTradeByTradeCombinedCurve(rawTraderData, cutoffMs);
        setPnlCurve(combined);

        // Collect all trades for STRATEGY tab
        const mergedTrades: any[] = [];
        for (const td of rawTraderData) {
          const currentPrices = new Map<string, number>();
          for (const pos of td.positions) {
            const key = pos.conditionId || pos.market;
            if (key && pos.currentPrice > 0) {
              currentPrices.set(key, pos.currentPrice);
            }
          }

          for (const trade of td.trades) {
            if (trade.timestamp >= cutoffMs) {
              const key = trade.conditionId || trade.market;
              const currentPrice = currentPrices.get(key) || trade.price;
              const unrealized = trade.side === "BUY"
                ? (currentPrice - trade.price) * trade.size
                : 0;

              mergedTrades.push({
                ...trade,
                traderAddress: td.address,
                weight: td.weight,
                currentPrice,
                unrealized,
              });
            }
          }
        }
        mergedTrades.sort((a, b) => a.timestamp - b.timestamp);
        setAllTrades(mergedTrades);

        // Build individual trader data
        const traderMap = new Map<string, {
          pnlCurve: CurvePoint[];
          trades: any[];
          weight: number;
        }>();

        for (const td of rawTraderData) {
          // Build individual P&L curve
          const curve = buildPnlCurve(td.trades, td.positions, cutoffMs);

          // Collect trades with current prices
          const currentPrices = new Map<string, number>();
          for (const pos of td.positions) {
            const key = pos.conditionId || pos.market;
            if (key && pos.currentPrice > 0) {
              currentPrices.set(key, pos.currentPrice);
            }
          }

          const traderTrades: any[] = [];
          for (const trade of td.trades) {
            if (trade.timestamp >= cutoffMs) {
              const key = trade.conditionId || trade.market;
              const currentPrice = currentPrices.get(key) || trade.price;
              const unrealized = trade.side === "BUY"
                ? (currentPrice - trade.price) * trade.size
                : 0;

              traderTrades.push({
                ...trade,
                traderAddress: td.address,
                weight: td.weight,
                currentPrice,
                unrealized,
              });
            }
          }
          traderTrades.sort((a, b) => a.timestamp - b.timestamp);

          traderMap.set(td.address, {
            pnlCurve: curve,
            trades: traderTrades,
            weight: td.weight,
          });
        }

        setTraderData(traderMap);
      } catch (err) {
        console.error("Failed to load data:", err);
        setPnlCurve([]);
        setAllTrades([]);
        setTraderData(new Map());
      } finally {
        setLoadingChart(false);
      }
    };

    loadAllData();
  }, [activeTraders, days]);

  // Get data for current tab
  const isStrategyTab = activeTab === "STRATEGY";
  const currentTraderData = isStrategyTab ? null : traderData.get(activeTab);
  const currentPnlCurve = isStrategyTab ? pnlCurve : (currentTraderData?.pnlCurve || []);
  const currentTrades = isStrategyTab ? allTrades : (currentTraderData?.trades || []);

  return (
    <div className="max-w-[1920px] mx-auto">
      <TopBar searchPlaceholder="SEARCH MARKETS OR ADDRESS..." />
      <div className="p-4 space-y-3">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => {
              setActiveTab("STRATEGY");
              setTradesPage(0);
            }}
            className={`pixel-btn text-[10px] px-4 py-1.5 whitespace-nowrap ${
              activeTab === "STRATEGY"
                ? "border-pixel-white text-pixel-white"
                : "border-pixel-gray text-pixel-gray hover:text-pixel-white"
            }`}
          >
            STRATEGY
          </button>
          {activeTraders.map((trader) => (
            <button
              key={trader.address}
              onClick={() => {
                setActiveTab(trader.address);
                setTradesPage(0);
              }}
              className={`pixel-btn text-[10px] px-4 py-1.5 whitespace-nowrap ${
                activeTab === trader.address
                  ? "border-pixel-white text-pixel-white"
                  : "border-pixel-gray text-pixel-gray hover:text-pixel-white"
              }`}
            >
              {trader.address.slice(0, 6)}...{trader.address.slice(-4)}
            </button>
          ))}
        </div>

        {/* P&L Content */}
        <div className="space-y-3">
          {loadingChart ? (
            <div className="pixel-panel p-8 text-center">
              <div className="text-[12px] text-pixel-white animate-pulse mb-2">
                LOADING {isStrategyTab ? "STRATEGY" : "TRADER"} DATA...
              </div>
              {isStrategyTab && (
                <div className="text-[10px] text-pixel-gray">
                  Computing combined curve from {activeTraders.length} trader{activeTraders.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          ) : currentPnlCurve.length > 0 ? (
              <>
                {/* View Header */}
                {!isStrategyTab && currentTraderData && (
                  <div className="pixel-panel p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-pixel-gray-light tracking-wider">
                        TRADER BACKTEST
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="font-mono text-pixel-white">
                          {activeTab.slice(0, 6)}...{activeTab.slice(-4)}
                        </span>
                        <span className="text-pixel-gray">
                          WEIGHT {(currentTraderData.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Chart */}
                <PnlChart
                  points={currentPnlCurve}
                  dayLabel={`${days}D`}
                  tradesInWindow={[]}
                  highlightIndex={hoveredTradeIndex}
                  onHoverChange={setHoveredTradeIndex}
                />

                {/* Trades Table */}
                <div className="pixel-panel overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="pixel-table" style={{ minWidth: isStrategyTab ? "1080px" : "980px", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: "120px" }} />
                        {isStrategyTab && <col style={{ width: "100px" }} />}
                        <col style={{ width: "26%" }} />
                        <col style={{ width: "50px" }} />
                        <col style={{ width: "80px" }} />
                        <col style={{ width: "80px" }} />
                        <col style={{ width: "70px" }} />
                        <col style={{ width: "70px" }} />
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "90px" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>TIME</th>
                          {isStrategyTab && <th>TRADER</th>}
                          <th>MARKET</th>
                          <th>SIDE</th>
                          <th className="text-right">PRICE</th>
                          <th className="text-right">SIZE</th>
                          <th className="text-right">ENTRY</th>
                          <th className="text-right">FEE</th>
                          <th className="text-right">CURRENT</th>
                          <th className="text-right">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTrades.slice(tradesPage * TRADES_PAGE_SIZE, (tradesPage + 1) * TRADES_PAGE_SIZE).map((trade, i) => {
                          const isEntering = trade.side === "BUY";
                          const showRealized = !isEntering && trade.hasBasis;
                          const isProfit = showRealized && trade.realized > 0;
                          const sideColor = isEntering
                            ? "border-pixel-gray-light text-pixel-gray-light"
                            : !showRealized
                            ? "border-pixel-gray text-pixel-gray"
                            : isProfit
                            ? "border-green-400 text-green-400"
                            : "border-red-400 text-red-400";
                          const pnlColor = !showRealized
                            ? "text-pixel-gray-light"
                            : isProfit
                            ? "text-green-400"
                            : "text-red-400";
                          const hasBuyInfo = !isEntering && trade.buyPrice !== undefined;
                          const timeStr = new Date(trade.timestamp).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          // Find this trade's index in currentPnlCurve for hover sync
                          const curveIndex = currentPnlCurve.findIndex(p => p.ts === trade.timestamp && p.side === trade.side);
                          const isHovered = hoveredTradeIndex === curveIndex;

                          return (
                            <tr
                              key={`${trade.id}-${i}`}
                              className={`${isHovered ? 'bg-pixel-white/5' : ''} transition-colors`}
                              onMouseEnter={() => curveIndex >= 0 && setHoveredTradeIndex(curveIndex)}
                              onMouseLeave={() => setHoveredTradeIndex(null)}
                            >
                              <td className="text-pixel-gray-light font-mono text-[9px]">
                                {timeStr}
                              </td>
                              {isStrategyTab && (
                                <td className="text-pixel-white font-mono text-[9px]">
                                  {trade.traderAddress.slice(0, 6)}...{trade.traderAddress.slice(-4)}
                                </td>
                              )}
                              <td className="text-pixel-white truncate text-[9px]" title={trade.market}>
                                {trade.market}
                              </td>
                              <td>
                                <span className={`pixel-badge ${sideColor}`}>
                                  {trade.side}
                                </span>
                              </td>
                              <td className="num text-right text-pixel-white font-mono">
                                {Math.round(trade.price * 100)}c
                              </td>
                              <td className="num text-right text-pixel-white font-mono">
                                ${(trade.size * trade.price).toFixed(2)}
                              </td>
                              <td className="num text-right font-mono text-pixel-gray-light">
                                {hasBuyInfo ? `${Math.round(trade.buyPrice * 100)}c` : isEntering ? "" : "—"}
                              </td>
                              <td className="num text-right font-mono text-red-400">
                                ${(trade.fee || 0).toFixed(2)}
                              </td>
                              <td className={`num text-right font-mono ${
                                isEntering
                                  ? trade.unrealized > 0
                                    ? "text-green-400"
                                    : trade.unrealized < 0
                                    ? "text-red-400"
                                    : "text-pixel-gray"
                                  : "text-pixel-gray-light"
                              }`}>
                                {isEntering
                                  ? `${trade.unrealized >= 0 ? "+" : ""}$${trade.unrealized.toFixed(2)}`
                                  : "—"}
                              </td>
                              <td
                                className={`num text-right font-mono ${pnlColor}`}
                                title={!showRealized && !isEntering ? "no cost basis in trade history" : undefined}
                              >
                                {isEntering
                                  ? ""
                                  : !showRealized
                                  ? "—"
                                  : `${trade.realized >= 0 ? "+" : ""}$${trade.realized.toFixed(2)}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {currentTrades.length > TRADES_PAGE_SIZE && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[8px] text-pixel-gray font-mono">
                      {tradesPage * TRADES_PAGE_SIZE + 1}-{Math.min((tradesPage + 1) * TRADES_PAGE_SIZE, currentTrades.length)} of {currentTrades.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setTradesPage((p) => Math.max(0, p - 1))}
                        disabled={tradesPage === 0}
                        className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        PREV
                      </button>
                      <span className="text-[8px] text-pixel-gray font-mono">
                        PAGE {tradesPage + 1} / {Math.ceil(currentTrades.length / TRADES_PAGE_SIZE)}
                      </span>
                      <button
                        onClick={() => setTradesPage((p) => Math.min(Math.ceil(currentTrades.length / TRADES_PAGE_SIZE) - 1, p + 1))}
                        disabled={tradesPage >= Math.ceil(currentTrades.length / TRADES_PAGE_SIZE) - 1}
                        className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        NEXT
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="pixel-panel p-8 text-center">
                <div className="text-[12px] text-pixel-gray-light tracking-wider mb-2">
                  NO DATA
                </div>
                <div className="text-[11px] text-pixel-gray">
                  {activeTraders.length === 0
                    ? "NO TRADERS IN ACTIVE STRATEGY"
                    : isStrategyTab
                    ? "NO STRATEGY DATA AVAILABLE"
                    : "NO TRADER DATA AVAILABLE"}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default function TradersPage() {
  return (
    <Suspense>
      <TradersInner />
    </Suspense>
  );
}
