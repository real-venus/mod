"use client";

import { BacktestResult } from "../lib/types";
import PortfolioChart from "./PortfolioChart";

interface Props {
  result: BacktestResult;
}

export default function BacktestResults({ result }: Props) {
  const isPositive = result.totalPnlUsd >= 0;

  const metrics = [
    {
      label: "TOTAL P&L",
      value: `${isPositive ? "+" : ""}$${result.totalPnlUsd.toLocaleString()}`,
      color: isPositive ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "RETURN",
      value: `${isPositive ? "+" : ""}${result.totalPnlPct.toFixed(2)}%`,
      color: isPositive ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "WIN RATE",
      value: `${result.winRate.toFixed(1)}%`,
      color: result.winRate >= 50 ? "text-ibm-green" : "text-ibm-red",
    },
    {
      label: "TRADES COPIED",
      value: result.totalTrades.toString(),
      color: "text-ibm-white",
    },
    {
      label: "SHARPE RATIO",
      value: result.sharpeRatio.toFixed(2),
      color: "text-ibm-amber",
    },
    {
      label: "MAX DRAWDOWN",
      value: `${result.maxDrawdown.toFixed(1)}%`,
      color: "text-ibm-red",
    },
    {
      label: "AVG TRADE SIZE",
      value: `$${result.avgTradeSize.toFixed(0)}`,
      color: "text-ibm-white",
    },
    {
      label: "SKIPPED",
      value: (result.trades.length - result.totalTrades).toString(),
      color: "text-ibm-gray-light",
    },
  ];

  const recentTrades = result.trades
    .filter((t) => t.action === "COPY")
    .slice(-20)
    .reverse();

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-ibm-border/20">
        {metrics.map((m) => (
          <div key={m.label} className="bg-ibm-panel px-3 py-3 flex flex-col gap-1">
            <span className="text-[9px] text-ibm-gray-light tracking-widest">{m.label}</span>
            <span className={`text-sm font-mono font-semibold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      <PortfolioChart
        data={result.equityCurve}
        title="BACKTEST — EQUITY CURVE"
        height={250}
      />

      {/* Trade log */}
      <div className="panel-glow bg-ibm-panel">
        <div className="px-4 py-3 border-b border-ibm-border/30 flex items-center justify-between">
          <h3 className="text-[11px] text-ibm-gray-light tracking-widest">COPIED TRADES</h3>
          <span className="text-[10px] text-ibm-gray">{result.totalTrades} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-ibm-border/20">
                <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">TIME</th>
                <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">WALLET</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">SCORE</th>
                <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">PAIR</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">SIZE</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">P&L</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">PORTFOLIO</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade, i) => {
                const isProfit = trade.pnl >= 0;
                return (
                  <tr
                    key={i}
                    className="border-b border-ibm-border/10 hover:bg-ibm-green/5 transition-colors"
                  >
                    <td className="px-4 py-2 text-ibm-gray-light font-mono">
                      {new Date(trade.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-ibm-gray-light font-mono">
                      {trade.wallet.slice(0, 6)}...{trade.wallet.slice(-4)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className={`px-1.5 py-0.5 text-[9px] ${
                        trade.score >= 80 ? "bg-ibm-green/20 text-ibm-green" :
                        trade.score >= 60 ? "bg-ibm-amber/20 text-ibm-amber" :
                        "bg-ibm-gray/20 text-ibm-gray-light"
                      }`}>
                        {trade.score.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ibm-white font-mono">
                      {trade.tokenIn}/{trade.tokenOut}
                    </td>
                    <td className="px-4 py-2 text-right text-ibm-amber font-mono">
                      ${trade.amountUsd.toFixed(0)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${isProfit ? "text-ibm-green" : "text-ibm-red"}`}>
                      {isProfit ? "+" : ""}${trade.pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-ibm-white font-mono">
                      ${trade.portfolioValue.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
