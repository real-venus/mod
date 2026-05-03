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

type CurvePoint = {
  i: number;
  ts: number;
  date: string;
  time: string;
  pnl: number;
  side: "BUY" | "SELL" | "MARK";
  realized: number;
  market: string;
  size: number;
  price: number;
};

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
  // basis (BUYs older than what /activity returned) are flagged as
  // hasBasis=false so the UI can show "—" instead of a misleading $0.
  //
  // Fallback: if a SELL has no in-book BUY but the trader still holds an
  // open position in that market, use the position's avgPrice as the cost
  // basis. /positions only reports CURRENTLY OPEN positions, so this only
  // helps for markets the trader hasn't fully exited.
  const tradesWithRealized = useMemo(() => {
    const seedAvgPrice = new Map<string, number>();
    for (const p of positions) {
      const key = p.conditionId || p.market;
      if (key && p.avgPrice > 0) seedAvgPrice.set(key, p.avgPrice);
    }
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const book = new Map<string, { size: number; cost: number }>();
    return sorted.map((t) => {
      const key = t.conditionId || t.market;
      const pos = book.get(key) || { size: 0, cost: 0 };
      let realized = 0;
      let hasBasis = true;
      if (t.side === "BUY") {
        pos.cost += t.price * t.size;
        pos.size += t.size;
      } else if (pos.size > 0) {
        const avgCost = pos.cost / pos.size;
        const sold = Math.min(t.size, pos.size);
        realized = (t.price - avgCost) * sold;
        pos.cost -= avgCost * sold;
        pos.size -= sold;
      } else if (seedAvgPrice.has(key)) {
        // SELL with no BUYs in our trade window — fall back to the
        // trader's current avgPrice from their open-position record.
        realized = (t.price - (seedAvgPrice.get(key) || 0)) * t.size;
      } else {
        hasBasis = false;
      }
      book.set(key, pos);
      return { ...t, realized, hasBasis };
    });
  }, [trades, positions]);

  const tradesInWindow = useMemo(
    () => tradesWithRealized.filter((t) => t.timestamp >= cutoffMs),
    [tradesWithRealized, cutoffMs],
  );

  // Mark-to-market cumulative P&L, one point per trade, plus a final "NOW"
  // mark that revalues any still-open inventory at current position prices.
  //
  // MTM = cumulative cash flow + value of held inventory at last known price.
  //   BUY  → cash -= px*sz, inventory += sz (instantaneous Δ MTM = 0)
  //   SELL → cash += px*sz, inventory -= sz, also re-marks remaining
  //          inventory of that market to the new fill price
  // We use realized-only for the per-trade tooltip number, but plot MTM so
  // the curve actually moves with BUYs (price discovery on inventory) — a
  // realized-only curve sits flat at $0 for traders who mostly bought in
  // the window, which made the chart look empty.
  const pnlCurve = useMemo((): CurvePoint[] => {
    if (!tradesInWindow.length) return [];
    const sorted = [...tradesInWindow].sort((a, b) => a.timestamp - b.timestamp);

    // Prefer the trader's current position curPrice as the mark for any
    // market they still hold — this makes BUYs in open positions
    // immediately reflect their forward-looking P&L instead of staying
    // pinned at $0 until the next sell.
    const curByKey = new Map<string, number>();
    for (const p of positions) {
      const key = p.conditionId || p.market;
      if (key && p.currentPrice > 0) curByKey.set(key, p.currentPrice);
    }

    const inv = new Map<string, number>();      // remaining size per market
    const lastPx = new Map<string, number>();   // last-seen price per market
    let cash = 0;
    const markFor = (key: string) =>
      curByKey.get(key) ?? lastPx.get(key) ?? 0;

    const fmtDate = (ts: number) =>
      new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
    const fmtTime = (ts: number) =>
      new Date(ts).toLocaleString([], {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });

    const points: CurvePoint[] = sorted.map((t, i) => {
      const key = t.conditionId || t.market;
      if (t.side === "BUY") {
        cash -= t.price * t.size;
        inv.set(key, (inv.get(key) || 0) + t.size);
      } else {
        cash += t.price * t.size;
        inv.set(key, (inv.get(key) || 0) - t.size);
      }
      lastPx.set(key, t.price);

      let invValue = 0;
      for (const [k, s] of inv) {
        if (s !== 0) invValue += s * markFor(k);
      }
      const mtm = cash + invValue;

      return {
        i,
        ts: t.timestamp,
        date: fmtDate(t.timestamp),
        time: fmtTime(t.timestamp),
        pnl: Math.round(mtm * 100) / 100,
        side: t.side,
        realized: t.realized,
        market: t.market,
        size: t.size,
        price: t.price,
      };
    });

    // Append a final "NOW" point so the chart shows the latest mark even
    // when no trade has happened in the last few hours — uses the same
    // markFor() lookup as the per-trade points.
    let nowInvValue = 0;
    let hasOpenInventory = false;
    for (const [k, s] of inv) {
      if (Math.abs(s) < 1e-9) continue;
      nowInvValue += s * markFor(k);
      hasOpenInventory = true;
    }
    if (hasOpenInventory) {
      const nowTs = Date.now();
      const nowMtm = cash + nowInvValue;
      points.push({
        i: points.length,
        ts: nowTs,
        date: fmtDate(nowTs),
        time: "NOW",
        pnl: Math.round(nowMtm * 100) / 100,
        side: "MARK",
        realized: 0,
        market: "",
        size: 0,
        price: 0,
      });
    }

    return points;
  }, [tradesInWindow, positions]);

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
    // Only count SELLs where we actually have a cost basis. SELLs whose
    // matching BUY pre-dates our 500-trade history have hasBasis=false
    // and would otherwise pollute every stat with an artificial $0.
    const scoredSells = tradesInWindow.filter(
      (t) => t.side === "SELL" && t.hasBasis,
    );
    const wins = scoredSells.filter((t) => t.realized > 0).length;
    const losses = scoredSells.filter((t) => t.realized < 0).length;
    const totalPnl = scoredSells.reduce((s, t) => s + t.realized, 0);
    const avgTrade = scoredSells.length ? totalPnl / scoredSells.length : 0;
    const biggestWin = scoredSells.length ? Math.max(...scoredSells.map((t) => t.realized)) : 0;
    const biggestLoss = scoredSells.length ? Math.min(...scoredSells.map((t) => t.realized)) : 0;
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
      if (t.side === "SELL" && t.hasBasis) entry.realized += t.realized;
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
            {([
              { label: `${dayLabel} P&L`, value: formatPnl(stats.totalPnl), tone: stats.totalPnl > 0 ? "good" : stats.totalPnl < 0 ? "bad" : "neutral" },
              { label: "WIN RATE", value: stats.winRate < 0 ? "—" : `${stats.winRate}%`, tone: stats.winRate < 0 ? "neutral" : stats.winRate >= 50 ? "good" : "bad" },
              { label: "TRADES", value: tradesInWindow.length.toString(), tone: "neutral" },
              { label: "VOLUME", value: formatVolume(trader.volume), tone: "neutral" },
              { label: "AVG TRADE", value: formatPnl(stats.avgTrade), tone: stats.avgTrade > 0 ? "good" : stats.avgTrade < 0 ? "bad" : "neutral" },
              { label: "POSITIONS", value: positions.length.toString(), tone: "neutral" },
            ] as const).map((stat) => {
              const valueClass =
                stat.tone === "good" ? "text-green-400" :
                stat.tone === "bad" ? "text-red-400" :
                "text-pixel-white glow-green";
              return (
                <div key={stat.label} className="pixel-panel p-4 text-center">
                  <div className="text-[10px] text-pixel-gray tracking-wider mb-2">
                    {stat.label}
                  </div>
                  <div className={`text-sm ${valueClass}`}>
                    {stat.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* P&L Chart */}
          {pnlCurve.length > 0 ? (
            <div className="pixel-panel p-5">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="text-[12px] text-pixel-gray-light tracking-wider">
                  {`${dayLabel} P&L CURVE (MTM)`}
                </div>
                <div className={`text-[11px] font-mono ${
                  pnlCurve[pnlCurve.length - 1].pnl > 0 ? "text-green-400" :
                  pnlCurve[pnlCurve.length - 1].pnl < 0 ? "text-red-400" :
                  "text-pixel-gray-light"
                }`}>
                  {formatPnl(pnlCurve[pnlCurve.length - 1].pnl)}
                </div>
              </div>
              {(() => {
                // Show the actual data range so window changes that don't
                // visibly change the curve (because the trader has no
                // trades older than the new window) are obvious.
                const tsList = tradesInWindow.map((t) => t.timestamp);
                if (!tsList.length) return null;
                const minTs = Math.min(...tsList);
                const maxTs = Math.max(...tsList);
                const fmt = (ts: number) =>
                  new Date(ts).toLocaleString([], {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  });
                const spanMs = maxTs - minTs;
                const spanLabel =
                  spanMs < 3600_000 ? `${Math.round(spanMs / 60_000)}m`
                  : spanMs < 86400_000 ? `${(spanMs / 3600_000).toFixed(1)}h`
                  : `${(spanMs / 86400_000).toFixed(1)}d`;
                return (
                  <div className="text-[10px] text-pixel-gray mb-3 font-mono">
                    {tradesInWindow.length} TRADES · {fmt(minTs)} → {fmt(maxTs)} · SPANS {spanLabel}
                  </div>
                );
              })()}
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={pnlCurve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tick={{ fontSize: 9, fill: "#aaaaaa" }}
                    axisLine={{ stroke: "#666666" }}
                    tickLine={{ stroke: "#666666" }}
                    minTickGap={50}
                    tickFormatter={(t: number) => {
                      const d = new Date(t);
                      // Pick a sensible time/date format based on the
                      // overall span (in ms) of the visible data.
                      const span = pnlCurve.length > 1
                        ? pnlCurve[pnlCurve.length - 1].ts - pnlCurve[0].ts
                        : 0;
                      if (span < 86400_000) {
                        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      }
                      return d.toLocaleDateString([], { month: "short", day: "numeric" });
                    }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 9, fill: "#aaaaaa" }}
                    axisLine={{ stroke: "#666666" }}
                    tickLine={{ stroke: "#666666" }}
                    width={56}
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
                      const isMark = p.side === "MARK";
                      return (
                        <div style={{ background: "#1a1a1a", border: "2px solid #333", padding: 8, fontSize: 10, color: "#fff", lineHeight: 1.5 }}>
                          <div style={{ color: "#999" }}>{p.time}</div>
                          {isMark ? (
                            <div style={{ color: "#fff" }}>MARK TO MARKET</div>
                          ) : (
                            <>
                              <div style={{ color: p.side === "BUY" ? "#aaa" : "#fff" }}>
                                {p.side} {p.size.toFixed(0)} @ {Math.round(p.price * 100)}c
                              </div>
                              {p.side === "SELL" && (
                                <div style={{ color: p.realized > 0 ? "#4ade80" : p.realized < 0 ? "#f87171" : "#999" }}>
                                  {p.realized >= 0 ? "+" : ""}${p.realized.toFixed(2)}
                                </div>
                              )}
                            </>
                          )}
                          <div style={{ color: p.pnl > 0 ? "#4ade80" : p.pnl < 0 ? "#f87171" : "#fff" }}>
                            MTM {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                          </div>
                          {p.market && (
                            <div style={{ color: "#666", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p.market}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="#ffffff"
                    fill="url(#pnlGrad)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={(dotProps: { cx?: number; cy?: number; payload?: { side: string; realized: number } }) => {
                      const { cx, cy, payload } = dotProps;
                      if (cx == null || cy == null || !payload) {
                        return <g />;
                      }
                      if (payload.side === "MARK") {
                        return (
                          <circle cx={cx} cy={cy} r={4} fill="#1a1a1a" stroke="#ffffff" strokeWidth={2} />
                        );
                      }
                      if (payload.side === "BUY") {
                        return (
                          <circle cx={cx} cy={cy} r={2.5} fill="#444" stroke="#888" strokeWidth={1} />
                        );
                      }
                      const fill = payload.realized > 0 ? "#4ade80" : payload.realized < 0 ? "#f87171" : "#999";
                      return (
                        <rect x={cx - 3} y={cy - 3} width={6} height={6} fill={fill} stroke="#000" strokeWidth={1} />
                      );
                    }}
                    activeDot={{ r: 5, fill: "#fff", stroke: "#000", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-pixel-gray flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-pixel-gray-light/40 rounded-full border border-pixel-gray" /> BUY
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-400" /> SELL +
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-400" /> SELL -
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full border border-pixel-white" /> NOW (MTM)
                </div>
                <div className="ml-auto">{pnlCurve.length} POINTS</div>
              </div>
            </div>
          ) : positions.length > 0 ? (
            <div className="pixel-panel p-5 text-center">
              <div className="text-[12px] text-pixel-gray-light tracking-wider mb-2">
                {`${dayLabel} P&L CURVE`}
              </div>
              <div className="text-[11px] text-pixel-gray">
                NO TRADES IN WINDOW — SHOWING OPEN POSITIONS BELOW
              </div>
            </div>
          ) : null}

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
              <div className="text-base text-green-400">
                {formatPnl(stats.biggestWin)}
              </div>
            </div>
            <div className="pixel-panel-red p-5 text-center">
              <div className="text-[11px] text-pixel-gray tracking-wider mb-2">BIGGEST LOSS</div>
              <div className="text-base text-red-400">
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
                      // No realized activity in window = still entering (neutral).
                      const isOpen = m.realized === 0;
                      const profit = !isOpen && m.realized > 0;
                      const pnlColor = isOpen
                        ? "text-pixel-gray-light"
                        : profit
                        ? "text-green-400"
                        : "text-red-400";
                      return (
                        <tr key={m.conditionId}>
                          <td className="text-pixel-white truncate" title={m.market}>
                            {m.market || m.conditionId.slice(0, 12)}
                          </td>
                          <td className="num text-right text-pixel-gray-light font-mono">
                            {m.bought.toFixed(0)}
                          </td>
                          <td className="num text-right text-pixel-gray-light font-mono">
                            {m.sold.toFixed(0)}
                          </td>
                          <td className="num text-right text-pixel-gray-light font-mono">
                            {m.tradeCount}
                          </td>
                          <td className={`num text-right font-mono ${pnlColor}`}>
                            {isOpen ? "—" : `${profit ? "+" : ""}$${m.realized.toFixed(2)}`}
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
                    {sortedTrades.slice(0, 100).map((trade, i) => {
                      // BUY = entering position (neutral); SELL = closing.
                      // SELLs without cost basis (no matching BUY in our
                      // 500-trade window and no open position to seed
                      // avgPrice from) show "—" — a literal $0 would be a
                      // bookkeeping artifact, not a real result.
                      const isEntering = trade.side === "BUY";
                      const showRealized = !isEntering && trade.hasBasis;
                      const isProfit = showRealized && trade.realized > 0;
                      const isLoss = showRealized && trade.realized < 0;
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
                      return (
                        <tr key={`${trade.id}-${i}`}>
                          <td className="text-pixel-gray font-mono">
                            {timeAgo(trade.timestamp)}
                          </td>
                          <td className="text-pixel-white truncate" title={trade.market}>
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
                          <td
                            className={`num text-right font-mono ${pnlColor}`}
                            title={!showRealized && !isEntering ? "no cost basis in trade history" : undefined}
                          >
                            {!showRealized
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
