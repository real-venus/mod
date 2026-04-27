"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { StrategyPerformance } from "../lib/types";
import { CHAINS } from "../lib/chains";
import { shortAddress } from "../lib/wallet";

interface Props {
  strategy: StrategyPerformance;
  selected: boolean;
  onClick: () => void;
}

export default function StrategyCard({ strategy, selected, onClick }: Props) {
  const chain = CHAINS[strategy.chainId];
  const isPositive = strategy.totalPnlPct >= 0;
  const sparkColor = isPositive ? "#42be65" : "#fa4d56";

  return (
    <div
      onClick={onClick}
      className={`panel-glow bg-ibm-panel p-4 cursor-pointer transition-all hover:bg-ibm-dark ${
        selected
          ? "border-ibm-green/60 shadow-[0_0_15px_#42be6522]"
          : "border-ibm-border/30 hover:border-ibm-green/30"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: chain?.color || "#42be65" }}
          />
          <span className="text-ibm-white text-xs font-semibold tracking-wide">
            {strategy.label}
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 border border-ibm-border text-ibm-gray-light">
          {chain?.shortName || "???"}
        </span>
      </div>

      {/* Address */}
      <div className="text-[10px] text-ibm-gray-light mb-3 font-mono">
        {shortAddress(strategy.address)}
      </div>

      {/* Sparkline */}
      <div className="h-12 mb-3 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={strategy.history.slice(-14)}>
            <defs>
              <linearGradient id={`spark-${strategy.address}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sparkColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="totalValueUSD"
              stroke={sparkColor}
              strokeWidth={1}
              fill={`url(#spark-${strategy.address})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <div className="text-ibm-gray-light text-[9px] tracking-wider mb-0.5">P&L</div>
          <div className={`font-mono font-medium ${isPositive ? "text-ibm-green" : "text-ibm-red"}`}>
            {isPositive ? "+" : ""}${strategy.totalPnlUSD.toLocaleString()}
            <span className="text-[9px] ml-1">
              ({isPositive ? "+" : ""}{strategy.totalPnlPct.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div>
          <div className="text-ibm-gray-light text-[9px] tracking-wider mb-0.5">WIN RATE</div>
          <div className="text-ibm-white font-mono">{strategy.winRate.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-ibm-gray-light text-[9px] tracking-wider mb-0.5">APR 1D</div>
          <div
            className={`font-mono font-medium ${
              strategy.apr1d >= 0 ? "text-ibm-green" : "text-ibm-red"
            }`}
          >
            {strategy.apr1d >= 0 ? "+" : ""}{strategy.apr1d.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-ibm-gray-light text-[9px] tracking-wider mb-0.5">APR 30D</div>
          <div
            className={`font-mono font-medium ${
              strategy.apr30d >= 0 ? "text-ibm-green" : "text-ibm-red"
            }`}
          >
            {strategy.apr30d >= 0 ? "+" : ""}{strategy.apr30d.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-ibm-border/30 flex items-center justify-between text-[10px] text-ibm-gray-light">
        <span>{strategy.totalTrades} trades</span>
        <span>Sharpe {strategy.sharpeRatio.toFixed(2)}</span>
        <span>DD {strategy.maxDrawdown.toFixed(1)}%</span>
      </div>
    </div>
  );
}
