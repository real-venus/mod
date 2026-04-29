"use client";

import { useMemo, useState } from "react";
import { TopTrader, formatVolume, formatPnl, timeAgo } from "../lib/polymarket";
import { shortAddress } from "@/lib/auth";
import { PolymarketTrade, PolymarketPosition } from "../lib/types";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

interface Props {
  trader: TopTrader;
  trades: PolymarketTrade[];
  positions: PolymarketPosition[];
  loading: boolean;
  watching: boolean;
  onToggleWatch: () => void;
  onBack: () => void;
  days?: number;
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
  days = 30,
}: Props) {
  const dayLabel = `${days}D`;
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

  const cutoffMs = useMemo(() => Date.now() - days * 24 * 60 * 60 * 1000, [days]);

  // Replay full trade history with avg-cost (FIFO-style) bookkeeping to
  // compute the *realized* P&L on each SELL. Trades without enough cost
  // basis (BUYs older than what /activity returned) are best-effort.
  const tradesWithRealized = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const book = new Map<string, { size: number; cost: number }>();
    return sorted.map((t) => {
      const key = t.conditionId || t.market;
      const pos = book.get(key) || { size: 0, cost: 0 };
      let realized = 0;
      if (t.side === "BUY") {
        pos.cost += t.price * t.size;
        pos.size += t.size;
      } else if (pos.size > 0) {
        const avgCost = pos.cost / pos.size;
        const sold = Math.min(t.size, pos.size);
        realized = (t.price - avgCost) * sold;
        pos.cost -= avgCost * sold;
        pos.size -= sold;
      }
      book.set(key, pos);
      return { ...t, realized };
    });
  }, [trades]);

  const tradesInWindow = useMemo(
    () => tradesWithRealized.filter((t) => t.timestamp >= cutoffMs),
    [tradesWithRealized, cutoffMs],
  );

  // Cumulative realized P&L over the window — one point per trade so we
  // can mark BUY/SELL nodes on the curve. Cumulative pnl only changes on
  // SELLs (BUYs have realized=0), but we keep BUY points to draw markers.
  const pnlCurve = useMemo(() => {
    if (!tradesInWindow.length) return [];
    const sorted = [...tradesInWindow].sort((a, b) => a.timestamp - b.timestamp);
    let cum = 0;
    return sorted.map((t, i) => {
      cum += t.realized;
      return {
        i,
        ts: t.timestamp,
        date: new Date(t.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }),
        time: new Date(t.timestamp).toLocaleString([], {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        }),
        pnl: Math.round(cum * 100) / 100,
        side: t.side,
        realized: t.realized,
        market: t.market,
        size: t.size,
        price: t.price,
      };
    });
  }, [tradesInWindow]);

  const dailyActivity = useMemo(() => {
    const dayMap = new Map<string, { buys: number; sells: number; volume: number }>();
    for (const t of tradesInWindow) {
      const day = new Date(t.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      const existing = dayMap.get(day) || { buys: 0, sells: 0, volume: 0 };
      if (t.side === "BUY") existing.buys++;
      else existing.sells++;
      existing.volume += t.size * t.price;
      dayMap.set(day, existing);
    }
    return Array.from(dayMap.entries()).map(([date, data]) => ({ date, ...data }));
  }, [tradesInWindow]);

  const stats = useMemo(() => {
    const sells = tradesInWindow.filter((t) => t.side === "SELL");
    const wins = sells.filter((t) => t.realized > 0).length;
    const losses = sells.filter((t) => t.realized < 0).length;
    const totalPnl = tradesInWindow.reduce((s, t) => s + t.realized, 0);
    const avgTrade = sells.length ? totalPnl / sells.length : 0;
    const biggestWin = sells.length ? Math.max(...sells.map((t) => t.realized)) : 0;
    const biggestLoss = sells.length ? Math.min(...sells.map((t) => t.realized)) : 0;
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : -1;
    return { wins, losses, totalPnl, avgTrade, biggestWin, biggestLoss, winRate };
  }, [tradesInWindow]);

  // Per-market realized results inside the window.
  // "Closed in window" = market had SELL activity in the window AND
  // size sold ≥ size bought across the window (round-trip closed).
  const closedInWindow = useMemo(() => {
    const byMarket = new Map<string, {
      conditionId: string;
      market: string;
      outcome: string;
      bought: number;
      sold: number;
      realized: number;
      lastTs: number;
      tradeCount: number;
    }>();
    for (const t of tradesInWindow) {
      const key = t.conditionId || t.market;
      const entry = byMarket.get(key) || {
        conditionId: t.conditionId,
        market: t.market,
        outcome: t.outcome || "",
        bought: 0,
        sold: 0,
        realized: 0,
        lastTs: 0,
        tradeCount: 0,
      };
      if (t.side === "BUY") entry.bought += t.size;
      else entry.sold += t.size;
      entry.realized += t.realized;
      entry.lastTs = Math.max(entry.lastTs, t.timestamp);
      entry.tradeCount += 1;
      byMarket.set(key, entry);
    }
    return Array.from(byMarket.values())
      .filter((m) => m.realized !== 0 || m.sold > 0)
      .sort((a, b) => b.realized - a.realized);
  }, [tradesInWindow]);

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
    return [...tradesInWindow].sort((a, b) => {
      let cmp = 0;
      switch (tradeSort) {
        case "timestamp": cmp = a.timestamp - b.timestamp; break;
        case "market": cmp = a.market.localeCompare(b.market); break;
        case "price": cmp = a.price - b.price; break;
        case "size": cmp = (a.size * a.price) - (b.size * b.price); break;
        case "pnl": cmp = a.realized - b.realized; break;
      }
      return tradeSortDir === "desc" ? -cmp : cmp;
    });
  }, [tradesInWindow, tradeSort, tradeSortDir]);

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
            {`LOADING ${dayLabel} HISTORY...`}
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: `${dayLabel} P&L`, value: formatPnl(stats.totalPnl), highlight: stats.totalPnl >= 0 },
              { label: "WIN RATE", value: stats.winRate < 0 ? "—" : `${stats.winRate}%`, highlight: stats.winRate >= 50 },
              { label: "TRADES", value: tradesInWindow.length.toString(), highlight: true },
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
                {`${dayLabel} P&L CURVE`}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={pnlCurve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#666666" }}
                    axisLine={{ stroke: "#333333" }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#666666" }}
                    axisLine={{ stroke: "#333333" }}
                    tickLine={false}
                    tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)}
                  />
                  <Tooltip
                    cursor={{ stroke: "#444", strokeDasharray: "2 2" }}
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "2px solid #333333",
                      fontFamily: "'Press Start 2P'",
                      fontSize: "10px",
                      color: "#ffffff",
                    }}
                    content={(props: { active?: boolean; payload?: Array<{ payload: { time: string; pnl: number; side: string; realized: number; size: number; price: number; market: string } }> }) => {
                      if (!props.active || !props.payload?.length) return null;
                      const p = props.payload[0].payload;
                      return (
                        <div style={{ background: "#1a1a1a", border: "2px solid #333", padding: 8, fontSize: 10, color: "#fff", lineHeight: 1.5 }}>
                          <div style={{ color: "#999" }}>{p.time}</div>
                          <div style={{ color: p.side === "BUY" ? "#aaa" : "#fff" }}>
                            {p.side} {p.size.toFixed(0)} @ {Math.round(p.price * 100)}c
                          </div>
                          {p.side === "SELL" && (
                            <div style={{ color: p.realized >= 0 ? "#fff" : "#888" }}>
                              {p.realized >= 0 ? "+" : ""}${p.realized.toFixed(2)}
                            </div>
                          )}
                          <div style={{ color: "#fff" }}>CUM ${p.pnl.toFixed(2)}</div>
                          <div style={{ color: "#666", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.market}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="pnl"
                    stroke="#ffffff"
                    fill="url(#pnlGrad)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={(dotProps: { cx?: number; cy?: number; payload?: { side: string } }) => {
                      const { cx, cy, payload } = dotProps;
                      if (cx == null || cy == null || !payload) {
                        return <g />;
                      }
                      if (payload.side === "BUY") {
                        return (
                          <circle cx={cx} cy={cy} r={2.5} fill="#444" stroke="#888" strokeWidth={1} />
                        );
                      }
                      return (
                        <rect x={cx - 3} y={cy - 3} width={6} height={6} fill="#fff" stroke="#000" strokeWidth={1} />
                      );
                    }}
                    activeDot={{ r: 5, fill: "#fff", stroke: "#000", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-pixel-gray">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-pixel-gray-light/40 rounded-full border border-pixel-gray" /> BUY
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-pixel-white" /> SELL
                </div>
                <div className="ml-auto">{pnlCurve.length} TRADES</div>
              </div>
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

          {/* Closed/Realized Results in Window */}
          {closedInWindow.length > 0 && (
            <div className="pixel-panel overflow-hidden">
              <div className="px-5 py-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[12px] text-pixel-gray-light tracking-wider">
                  {`${dayLabel} CLOSED RESULTS (PER MARKET)`}
                </span>
                <span className="text-[11px] text-pixel-gray">{closedInWindow.length} MARKETS</span>
              </div>
              <div className="overflow-x-auto">
                <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "640px" }}>
                  <colgroup>
                    <col style={{ width: "44%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "22%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>MARKET</th>
                      <th className="text-right">BOUGHT</th>
                      <th className="text-right">SOLD</th>
                      <th className="text-right">TRADES</th>
                      <th className="text-right">REALIZED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedInWindow.map((m) => {
                      const profit = m.realized >= 0;
                      return (
                        <tr key={m.conditionId}>
                          <td className="text-pixel-white truncate" title={m.market}>
                            {m.market || m.conditionId.slice(0, 12)}
                          </td>
                          <td className="text-right text-pixel-gray-light font-mono">
                            {m.bought.toFixed(0)}
                          </td>
                          <td className="text-right text-pixel-gray-light font-mono">
                            {m.sold.toFixed(0)}
                          </td>
                          <td className="text-right text-pixel-gray-light font-mono">
                            {m.tradeCount}
                          </td>
                          <td className={`text-right font-mono ${profit ? "text-pixel-white" : "text-pixel-gray"}`}>
                            {profit ? "+" : ""}${m.realized.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
          {tradesInWindow.length > 0 && (
            <div className="pixel-panel overflow-hidden">
              <div className="px-5 py-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span className="text-[12px] text-pixel-gray-light tracking-wider">
                  {`${dayLabel} TRADE LOG`}
                </span>
                <span className="text-[11px] text-pixel-gray">{tradesInWindow.length} TRADES</span>
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
                        <td className={`text-right font-mono ${trade.realized >= 0 ? "text-pixel-white" : "text-pixel-gray"}`}>
                          {trade.side === "BUY"
                            ? "—"
                            : `${trade.realized >= 0 ? "+" : ""}$${trade.realized.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tradesInWindow.length === 0 && positions.length === 0 && (
            <div className="pixel-panel p-12 text-center">
              <div className="text-sm text-pixel-gray mb-2">{`NO ${dayLabel} DATA`}</div>
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
