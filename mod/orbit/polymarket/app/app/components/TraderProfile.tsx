"use client";

import { useMemo } from "react";
import { TopTrader, formatVolume, formatPnl, timeAgo } from "../lib/polymarket";
import { shortAddress } from "../lib/auth";
import { PolymarketTrade, PolymarketPosition } from "../lib/types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface Props {
  trader: TopTrader;
  trades: PolymarketTrade[];
  positions: PolymarketPosition[];
  loading: boolean;
  watching: boolean;
  onToggleWatch: () => void;
  onBack: () => void;
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
  // Compute 30-day P&L curve
  const pnlCurve = useMemo(() => {
    if (!trades.length) return [];
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let cumPnl = 0;
    const points: { date: string; pnl: number; trades: number }[] = [];
    const dayMap = new Map<string, { pnl: number; count: number }>();

    for (const t of sorted) {
      const day = new Date(t.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      const existing = dayMap.get(day) || { pnl: 0, count: 0 };
      existing.pnl += t.pnl;
      existing.count += 1;
      dayMap.set(day, existing);
    }

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

  return (
    <div className="space-y-3">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="pixel-btn border-pixel-border text-pixel-gray hover:text-pixel-green hover:border-pixel-green"
        >
          BACK
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-pixel-cyan flex items-center justify-center">
              <div className="w-2 h-2 bg-pixel-cyan" />
            </div>
            <span className="text-[9px] text-pixel-cyan glow-cyan font-mono">
              {shortAddress(trader.address)}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(trader.address)}
              className="text-[6px] text-pixel-gray hover:text-pixel-white"
            >
              [COPY]
            </button>
          </div>
        </div>
        <button
          onClick={onToggleWatch}
          className={`pixel-btn ${
            watching
              ? "border-pixel-amber text-pixel-amber bg-pixel-amber/10"
              : "border-pixel-border text-pixel-gray hover:border-pixel-amber hover:text-pixel-amber"
          }`}
        >
          {watching ? "WATCHING" : "WATCH"}
        </button>
      </div>

      {loading ? (
        <div className="pixel-panel p-8 text-center">
          <div className="text-[8px] text-pixel-cyan animate-pulse glow-cyan">
            LOADING 30-DAY HISTORY...
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              { label: "30D P&L", value: formatPnl(stats.totalPnl), color: stats.totalPnl >= 0 ? "green" : "red" },
              { label: "WIN RATE", value: `${trader.winRate.toFixed(1)}%`, color: trader.winRate >= 50 ? "green" : "red" },
              { label: "TRADES", value: trades.length.toString(), color: "cyan" },
              { label: "VOLUME", value: formatVolume(trader.volume), color: "amber" },
              { label: "AVG TRADE", value: formatPnl(stats.avgTrade), color: stats.avgTrade >= 0 ? "green" : "red" },
              { label: "POSITIONS", value: positions.length.toString(), color: "magenta" },
            ].map((stat) => (
              <div key={stat.label} className="pixel-panel p-2 text-center">
                <div className="text-[5px] text-pixel-gray tracking-wider mb-1">
                  {stat.label}
                </div>
                <div className={`text-[9px] text-pixel-${stat.color} glow-${stat.color}`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* P&L Chart */}
          {pnlCurve.length > 0 && (
            <div className="pixel-panel p-3">
              <div className="text-[7px] text-pixel-gray-light tracking-wider mb-2">
                30-DAY P&L CURVE
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={pnlCurve}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00ff41" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 7, fill: "#666680" }}
                    axisLine={{ stroke: "#0f3460" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 7, fill: "#666680" }}
                    axisLine={{ stroke: "#0f3460" }}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#16213e",
                      border: "2px solid #0f3460",
                      fontFamily: "'Press Start 2P'",
                      fontSize: "7px",
                      color: "#00ff41",
                    }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="pnl"
                    stroke="#00ff41"
                    fill="url(#pnlGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily Activity */}
          {dailyActivity.length > 0 && (
            <div className="pixel-panel p-3">
              <div className="text-[7px] text-pixel-gray-light tracking-wider mb-2">
                DAILY TRADE ACTIVITY
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={dailyActivity}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 6, fill: "#666680" }}
                    axisLine={{ stroke: "#0f3460" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 6, fill: "#666680" }}
                    axisLine={{ stroke: "#0f3460" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#16213e",
                      border: "2px solid #0f3460",
                      fontFamily: "'Press Start 2P'",
                      fontSize: "6px",
                      color: "#00ffff",
                    }}
                  />
                  <Bar dataKey="buys" stackId="a" fill="#00ff41" />
                  <Bar dataKey="sells" stackId="a" fill="#ff0040" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Biggest Wins/Losses */}
          <div className="grid grid-cols-2 gap-2">
            <div className="pixel-panel p-3 text-center">
              <div className="text-[6px] text-pixel-gray tracking-wider mb-1">BIGGEST WIN</div>
              <div className="text-[10px] text-pixel-green glow-green">
                {formatPnl(stats.biggestWin)}
              </div>
            </div>
            <div className="pixel-panel-red p-3 text-center">
              <div className="text-[6px] text-pixel-gray tracking-wider mb-1">BIGGEST LOSS</div>
              <div className="text-[10px] text-pixel-red glow-red">
                {formatPnl(stats.biggestLoss)}
              </div>
            </div>
          </div>

          {/* Current Positions */}
          {positions.length > 0 && (
            <div className="pixel-panel overflow-hidden">
              <div className="px-3 py-2 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[7px] text-pixel-gray-light tracking-wider">
                  CURRENT POSITIONS
                </span>
                <span className="text-[6px] text-pixel-gray">{positions.length} OPEN</span>
              </div>
              <table className="pixel-table">
                <thead>
                  <tr>
                    <th>MARKET</th>
                    <th>SIDE</th>
                    <th className="text-right">SIZE</th>
                    <th className="text-right">AVG</th>
                    <th className="text-right">NOW</th>
                    <th className="text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => {
                    const isProfit = pos.pnlUsd >= 0;
                    return (
                      <tr key={`${pos.conditionId}-${i}`}>
                        <td className="text-pixel-white max-w-[180px] truncate">
                          {pos.market}
                        </td>
                        <td>
                          <span
                            className={`pixel-badge ${
                              pos.outcome === "Yes"
                                ? "border-pixel-green text-pixel-green"
                                : "border-pixel-red text-pixel-red"
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
                        <td className="text-right text-pixel-amber font-mono">
                          {Math.round(pos.currentPrice * 100)}c
                        </td>
                        <td className={`text-right font-mono ${isProfit ? "text-pixel-green" : "text-pixel-red"}`}>
                          {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent Trades */}
          {trades.length > 0 && (
            <div className="pixel-panel overflow-hidden">
              <div className="px-3 py-2 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[7px] text-pixel-gray-light tracking-wider">
                  30-DAY TRADE LOG
                </span>
                <span className="text-[6px] text-pixel-gray">{trades.length} TRADES</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="pixel-table">
                  <thead>
                    <tr>
                      <th>TIME</th>
                      <th>MARKET</th>
                      <th>SIDE</th>
                      <th className="text-right">PRICE</th>
                      <th className="text-right">SIZE</th>
                      <th className="text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice(0, 100).map((trade, i) => (
                      <tr key={`${trade.id}-${i}`}>
                        <td className="text-pixel-gray font-mono whitespace-nowrap">
                          {timeAgo(trade.timestamp)}
                        </td>
                        <td className="text-pixel-white max-w-[160px] truncate">
                          {trade.market}
                        </td>
                        <td>
                          <span
                            className={`pixel-badge ${
                              trade.side === "BUY"
                                ? "border-pixel-green text-pixel-green"
                                : "border-pixel-red text-pixel-red"
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>
                        <td className="text-right text-pixel-amber font-mono">
                          {Math.round(trade.price * 100)}c
                        </td>
                        <td className="text-right text-pixel-white font-mono">
                          ${(trade.size * trade.price).toFixed(2)}
                        </td>
                        <td className={`text-right font-mono ${trade.pnl >= 0 ? "text-pixel-green" : "text-pixel-red"}`}>
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
            <div className="pixel-panel p-8 text-center">
              <div className="text-[8px] text-pixel-gray mb-2">NO 30-DAY DATA</div>
              <div className="text-[6px] text-pixel-gray-light">
                THIS TRADER HAS NO RECENT ACTIVITY
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
