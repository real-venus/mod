"use client";

import { StrategyPerformance } from "../lib/types";

interface Props {
  strategies: StrategyPerformance[];
}

export default function StatsBar({ strategies }: Props) {
  const totalPnl = strategies.reduce((sum, s) => sum + s.totalPnlUSD, 0);
  const totalVolume = strategies.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalTrades = strategies.reduce((sum, s) => sum + s.totalTrades, 0);
  const avgWinRate =
    strategies.reduce((sum, s) => sum + s.winRate, 0) / strategies.length;
  const bestApr = Math.max(...strategies.map((s) => s.apr30d));
  const activeStrategies = strategies.length;
  const isPositivePnl = totalPnl >= 0;

  const stats = [
    {
      label: "TOTAL P&L",
      value: `${isPositivePnl ? "+" : ""}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      color: isPositivePnl ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "VOLUME",
      value: `$${(totalVolume / 1000).toFixed(0)}K`,
      color: "text-ibm-white",
    },
    {
      label: "TRADES",
      value: totalTrades.toLocaleString(),
      color: "text-ibm-white",
    },
    {
      label: "WIN RATE",
      value: `${avgWinRate.toFixed(1)}%`,
      color: avgWinRate >= 50 ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "BEST APR 30D",
      value: `${bestApr >= 0 ? "+" : ""}${bestApr.toFixed(1)}%`,
      color: bestApr >= 0 ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "STRATEGIES",
      value: activeStrategies.toString(),
      color: "text-ibm-amber",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-ibm-border/20">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-ibm-panel px-4 py-3 flex flex-col gap-1"
        >
          <span className="text-[9px] text-ibm-gray-light tracking-widest">
            {stat.label}
          </span>
          <span className={`text-sm font-mono font-semibold ${stat.color}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
