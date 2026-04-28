"use client";

import { useMemo, useState } from "react";
import { TopTrader, formatVolume, formatPnl, timeAgo } from "../lib/polymarket";
import { shortAddress } from "../lib/auth";
import { PolymarketTrade, PolymarketPosition } from "../lib/types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Props {
  trader: TopTrader;
  trades: PolymarketTrade[];
  positions: PolymarketPosition[];
  loading: boolean;
  watching: boolean;
  onToggleWatch: () => void;
  onBack: () => void;
}

type PosSort = "market" | "size" | "avgPrice" | "currentPrice" | "pnlUsd";
type TradeSort = "timestamp" | "market" | "price" | "size" | "pnl";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-pixel-gray/40 ml-1">-</span>;
  return <span className="ml-1">{dir === "desc" ? "\u25BC" : "\u25B2"}</span>;
}

export default function TraderProfile({
  trader,
  trades,
  positions,
  loading,
  watching,
  onToggleWatch,
  onBack,
}: Props) {
  const [posSort, setPosSort] = useState<PosSort>("pnlUsd");
  const [posSortDir, setPosSortDir] = useState<SortDir>("desc");
  const [tradeSort, setTradeSort] = useState<TradeSort>("timestamp");
  const [tradeSortDir, setTradeSortDir] = useState<SortDir>("desc");

  const handlePosSort = (col: PosSort) => {
    if (posSort === col) setPosSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setPosSort(col); setPosSortDir("desc"); }
  };

  const handleTradeSort = (col: TradeSort) => {
    if (tradeSort === col) setTradeSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setTradeSort(col); setTradeSortDir("desc"); }
  };

  // Compute 30-day P&L curve
  const pnlCurve = useMemo(() => {
    if (!trades.length) return [];
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let cumPnl = 0;
    const dayMap = new Map<string, { pnl: number; count: number }>();

    for (const t of sorted) {
      const day = new Date(t.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      const existing = dayMap.get(day) || { pnl: 0, count: 0 };
      existing.pnl += t.pnl;
      existing.count += 1;
      dayMap.set(day, existing);
    }

    const points: { date: string; pnl: number; trades: number }[] = [];
    for (const [date, { pnl, count }] of dayMap) {
      cumPnl += pnl;
      points.push({ date, pnl: Math.round(cumPnl * 100) / 100, trades: count });
    }
    return points;
  }, [trades]);

  // Daily trade activity
  const dailyActivity = useMemo(() => {
    const dayMap = new Map<string, { buys: number; sells: number; volume: number }>();
    for (const t of trades) {
      const day = new Date(t.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      const existing = dayMap.get(day) || { buys: 0, sells: 0, volume: 0 };
      if (t.side === "BUY") existing.buys++;
      else existing.sells++;
      existing.volume += t.size * t.price;
      dayMap.set(day, existing);
    }
    return Array.from(dayMap.entries()).map(([date, data]) => ({ date, ...data }));
  }, [trades]);

  // Win/loss stats
  const stats = useMemo(() => {
    const wins = trades.filter((t) => t.pnl > 0).length;
    const losses = trades.filter((t) => t.pnl < 0).length;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgTrade = trades.length ? totalPnl / trades.length : 0;
    const biggestWin = trades.length ? Math.max(...trades.map((t) => t.pnl)) : 0;
    const biggestLoss = trades.length ? Math.min(...trades.map((t) => t.pnl)) : 0;
    return { wins, losses, totalPnl, avgTrade, biggestWin, biggestLoss };
  }, [trades]);

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      let cmp = 0;
      switch (posSort) {
        case "market": cmp = a.market.localeCompare(b.market); break;
        case "size": cmp = a.size - b.size; break;
        case "avgPrice": cmp = a.avgPrice - b.avgPrice; break;
        case "currentPrice": cmp = a.currentPrice - b.currentPrice; break;
        case "pnlUsd": cmp = a.pnlUsd - b.pnlUsd; break;
      }
      return posSortDir === "desc" ? -cmp : cmp;
    });
  }, [positions, posSort, posSortDir]);

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      let cmp = 0;
      switch (tradeSort) {
        case "timestamp": cmp = a.timestamp - b.timestamp; break;
        case "market": cmp = a.market.localeCompare(b.market); break;
        case "price": cmp = a.price - b.price; break;
        case "size": cmp = (a.size * a.price) - (b.size * b.price); break;
        case "pnl": cmp = a.pnl - b.pnl; break;
      }
      return tradeSortDir === "desc" ? -cmp : cmp;
    });
  }, [trades, tradeSort, tradeSortDir]);

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="pixel-btn border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white text-[12px]"
        >
          BACK
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-pixel-white flex items-center justify-center">
              <div className="w-4 h-4 bg-pixel-white" />
            </div>
            <span className="text-sm text-pixel-white glow-green font-mono">
              {shortAddress(trader.address)}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(trader.address)}
              className="text-[11px] text-pixel-gray hover:text-pixel-white"
            >
              [COPY]
            </button>
          </div>
        </div>
        <button
          onClick={onToggleWatch}
          className={`pixel-btn text-[12px] ${
            watching
              ? "border-pixel-white text-pixel-white bg-pixel-white/10"
              : "border-pixel-border text-pixel-gray hover:border-pixel-white hover:text-pixel-white"
          }`}
        >
          {watching ? "WATCHING" : "WATCH"}
        </button>
      </div>

      {loading ? (
        <div className="pixel-panel p-12 text-center">
          <div className="text-sm text-pixel-white animate-pulse glow-green">
            LOADING 30-DAY HISTORY...
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "30D P&L", value: formatPnl(stats.totalPnl), highlight: stats.totalPnl >= 0 },
              { label: "WIN RATE", value: `${trader.winRate.toFixed(1)}%`, highlight: trader.winRate >= 50 },
              { label: "TRADES", value: trades.length.toString(), highlight: true },
              { label: "VOLUME", value: formatVolume(trader.volume), highlight: true },
              { label: "AVG TRADE", value: formatPnl(stats.avgTrade), highlight: stats.avgTrade >= 0 },
              { label: "POSITIONS", value: positions.length.toString(), highlight: true },
            ].map((stat) => (
              <div key={stat.label} className="pixel-panel p-4 text-center">
                <div className="text-[10px] text-pixel-gray tracking-wider mb-2">
                  {stat.label}
                </div>
                <div className={`text-sm ${stat.highlight ? "text-pixel-white glow-green" : "text-pixel-gray"}`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* P&L Chart */}
          {pnlCurve.length > 0 && (
            <div className="pixel-panel p-5">
              <div className="text-[12px] text-pixel-gray-light tracking-wider mb-4">
                30-DAY P&L CURVE
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={pnlCurve}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#666666" }}
                    axisLine={{ stroke: "#333333" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#666666" }}
                    axisLine={{ stroke: "#333333" }}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "2px solid #333333",
                      fontFamily: "'Press Start 2P'",
                      fontSize: "10px",
                      color: "#ffffff",
                    }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="pnl"
                    stroke="#ffffff"
                    fill="url(#pnlGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily Activity */}
          {dailyActivity.length > 0 && (
            <div className="pixel-panel p-5">
              <div className="text-[12px] text-pixel-gray-light tracking-wider mb-4">
                DAILY TRADE ACTIVITY
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={dailyActivity}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#666666" }}
                    axisLine={{ stroke: "#333333" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#666666" }}
                    axisLine={{ stroke: "#333333" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "2px solid #333333",
                      fontFamily: "'Press Start 2P'",
                      fontSize: "10px",
                      color: "#ffffff",
                    }}
                  />
                  <Bar dataKey="buys" stackId="a" fill="#ffffff" />
                  <Bar dataKey="sells" stackId="a" fill="#666666" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Biggest Wins/Losses */}
          <div className="grid grid-cols-2 gap-3">
            <div className="pixel-panel p-5 text-center">
              <div className="text-[11px] text-pixel-gray tracking-wider mb-2">BIGGEST WIN</div>
              <div className="text-base text-pixel-white glow-green">
                {formatPnl(stats.biggestWin)}
              </div>
            </div>
            <div className="pixel-panel-red p-5 text-center">
              <div className="text-[11px] text-pixel-gray tracking-wider mb-2">BIGGEST LOSS</div>
              <div className="text-base text-pixel-gray-light">
                {formatPnl(stats.biggestLoss)}
              </div>
            </div>
          </div>

          {/* Current Positions */}
          {positions.length > 0 && (
            <div className="pixel-panel overflow-hidden">
              <div className="px-5 py-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[12px] text-pixel-gray-light tracking-wider">
                  CURRENT POSITIONS
                </span>
                <span className="text-[11px] text-pixel-gray">{positions.length} OPEN</span>
              </div>
              <div className="overflow-x-auto">
                <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "600px" }}>
                  <colgroup>
                    <col style={{ width: "35%" }} />
                    <col style={{ width: "55px" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={`sortable ${posSort === "market" ? "sorted" : ""}`} onClick={() => handlePosSort("market")}>
                        MARKET <SortArrow active={posSort === "market"} dir={posSortDir} />
                      </th>
                      <th>SIDE</th>
                      <th className={`sortable text-right ${posSort === "size" ? "sorted" : ""}`} onClick={() => handlePosSort("size")}>
                        SIZE <SortArrow active={posSort === "size"} dir={posSortDir} />
                      </th>
                      <th className={`sortable text-right ${posSort === "avgPrice" ? "sorted" : ""}`} onClick={() => handlePosSort("avgPrice")}>
                        AVG <SortArrow active={posSort === "avgPrice"} dir={posSortDir} />
                      </th>
                      <th className={`sortable text-right ${posSort === "currentPrice" ? "sorted" : ""}`} onClick={() => handlePosSort("currentPrice")}>
                        NOW <SortArrow active={posSort === "currentPrice"} dir={posSortDir} />
                      </th>
                      <th className={`sortable text-right ${posSort === "pnlUsd" ? "sorted" : ""}`} onClick={() => handlePosSort("pnlUsd")}>
                        P&L <SortArrow active={posSort === "pnlUsd"} dir={posSortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((pos, i) => {
                      const isProfit = pos.pnlUsd >= 0;
                      return (
                        <tr key={`${pos.conditionId}-${i}`}>
                          <td className="text-pixel-white truncate" title={pos.market}>
                            {pos.market}
                          </td>
                          <td>
                            <span
                              className={`pixel-badge ${
                                pos.outcome === "Yes"
                                  ? "border-pixel-white text-pixel-white"
                                  : "border-pixel-gray text-pixel-gray"
                              }`}
                            >
                              {pos.outcome.toUpperCase()}
                            </span>
                          </td>
                          <td className="text-right text-pixel-white font-mono">
                            {pos.size.toFixed(1)}
                          </td>
                          <td className="text-right text-pixel-gray-light font-mono">
                            {Math.round(pos.avgPrice * 100)}c
                          </td>
                          <td className="text-right text-pixel-white font-mono">
                            {Math.round(pos.currentPrice * 100)}c
                          </td>
                          <td className={`text-right font-mono ${isProfit ? "text-pixel-white" : "text-pixel-gray"}`}>
                            {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Trades */}
          {trades.length > 0 && (
            <div className="pixel-panel overflow-hidden">
              <div className="px-5 py-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[12px] text-pixel-gray-light tracking-wider">
                  30-DAY TRADE LOG
                </span>
                <span className="text-[11px] text-pixel-gray">{trades.length} TRADES</span>
              </div>
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "600px" }}>
                  <colgroup>
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "35%" }} />
                    <col style={{ width: "55px" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={`sortable ${tradeSort === "timestamp" ? "sorted" : ""}`} onClick={() => handleTradeSort("timestamp")}>
                        TIME <SortArrow active={tradeSort === "timestamp"} dir={tradeSortDir} />
                      </th>
                      <th className={`sortable ${tradeSort === "market" ? "sorted" : ""}`} onClick={() => handleTradeSort("market")}>
                        MARKET <SortArrow active={tradeSort === "market"} dir={tradeSortDir} />
                      </th>
                      <th>SIDE</th>
                      <th className={`sortable text-right ${tradeSort === "price" ? "sorted" : ""}`} onClick={() => handleTradeSort("price")}>
                        PRICE <SortArrow active={tradeSort === "price"} dir={tradeSortDir} />
                      </th>
                      <th className={`sortable text-right ${tradeSort === "size" ? "sorted" : ""}`} onClick={() => handleTradeSort("size")}>
                        SIZE <SortArrow active={tradeSort === "size"} dir={tradeSortDir} />
                      </th>
                      <th className={`sortable text-right ${tradeSort === "pnl" ? "sorted" : ""}`} onClick={() => handleTradeSort("pnl")}>
                        P&L <SortArrow active={tradeSort === "pnl"} dir={tradeSortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.slice(0, 100).map((trade, i) => (
                      <tr key={`${trade.id}-${i}`}>
                        <td className="text-pixel-gray font-mono">
                          {timeAgo(trade.timestamp)}
                        </td>
                        <td className="text-pixel-white truncate" title={trade.market}>
                          {trade.market}
                        </td>
                        <td>
                          <span
                            className={`pixel-badge ${
                              trade.side === "BUY"
                                ? "border-pixel-white text-pixel-white"
                                : "border-pixel-gray text-pixel-gray"
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>
                        <td className="text-right text-pixel-white font-mono">
                          {Math.round(trade.price * 100)}c
                        </td>
                        <td className="text-right text-pixel-white font-mono">
                          ${(trade.size * trade.price).toFixed(2)}
                        </td>
                        <td className={`text-right font-mono ${trade.pnl >= 0 ? "text-pixel-white" : "text-pixel-gray"}`}>
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {trades.length === 0 && positions.length === 0 && (
            <div className="pixel-panel p-12 text-center">
              <div className="text-sm text-pixel-gray mb-2">NO 30-DAY DATA</div>
              <div className="text-[11px] text-pixel-gray-light">
                THIS TRADER HAS NO RECENT ACTIVITY
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
