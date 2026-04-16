"use client";

import { StrategyPerformance } from "../lib/types";
import { CHAINS } from "../lib/chains";
import PortfolioChart from "./PortfolioChart";

interface Props {
  strategy: StrategyPerformance;
}

export default function StrategyDetail({ strategy }: Props) {
  const chain = CHAINS[strategy.chainId];
  const isPositive = strategy.totalPnlPct >= 0;

  const metrics = [
    { label: "CHAIN", value: chain?.name || "Unknown", color: "text-ibm-white" },
    {
      label: "TOTAL P&L",
      value: `${isPositive ? "+" : ""}$${strategy.totalPnlUSD.toLocaleString()}`,
      color: isPositive ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "P&L %",
      value: `${isPositive ? "+" : ""}${strategy.totalPnlPct.toFixed(2)}%`,
      color: isPositive ? "text-ibm-green" : "text-ibm-red",
    },
    { label: "WIN RATE", value: `${strategy.winRate.toFixed(1)}%`, color: strategy.winRate >= 50 ? "text-ibm-green" : "text-ibm-red" },
    { label: "TOTAL TRADES", value: strategy.totalTrades.toString(), color: "text-ibm-white" },
    { label: "PROFITABLE", value: strategy.profitableTrades.toString(), color: "text-ibm-green" },
    { label: "LOSING", value: (strategy.totalTrades - strategy.profitableTrades).toString(), color: "text-ibm-red" },
    { label: "VOLUME", value: `$${(strategy.totalVolume / 1000).toFixed(0)}K`, color: "text-ibm-white" },
    {
      label: "APR 1D",
      value: `${strategy.apr1d >= 0 ? "+" : ""}${strategy.apr1d.toFixed(2)}%`,
      color: strategy.apr1d >= 0 ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "APR 30D",
      value: `${strategy.apr30d >= 0 ? "+" : ""}${strategy.apr30d.toFixed(2)}%`,
      color: strategy.apr30d >= 0 ? "text-ibm-green" : "text-ibm-red",
    },
    { label: "SHARPE RATIO", value: strategy.sharpeRatio.toFixed(2), color: "text-ibm-amber" },
    { label: "MAX DRAWDOWN", value: `${strategy.maxDrawdown.toFixed(1)}%`, color: "text-ibm-red" },
  ];

  return (
    <div className="space-y-4">
      {/* Strategy header */}
      <div className="panel-glow bg-ibm-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chain?.color }} />
            <h2 className="text-ibm-green text-sm font-semibold tracking-wider glow-text">
              {strategy.label}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 border border-ibm-green/30 text-ibm-green">
              ACTIVE
            </span>
          </div>
        </div>
        <div className="text-[11px] text-ibm-gray-light font-mono mb-3">
          PROXY: {strategy.address}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="bg-ibm-black/50 p-2">
              <div className="text-[9px] text-ibm-gray-light tracking-wider mb-0.5">{m.label}</div>
              <div className={`text-xs font-mono font-medium ${m.color}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy chart */}
      <PortfolioChart data={strategy.history} title={`${strategy.label} — EQUITY CURVE`} height={220} />
    </div>
  );
}
