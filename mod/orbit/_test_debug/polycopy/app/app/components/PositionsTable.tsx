"use client";

import { PolymarketPosition } from "../lib/types";

interface Props {
  positions: PolymarketPosition[];
  loading?: boolean;
}

export default function PositionsTable({ positions, loading }: Props) {
  return (
    <div className="panel-glow bg-ibm-panel">
      <div className="px-4 py-3 border-b border-ibm-border/30 flex items-center justify-between">
        <h3 className="text-[11px] text-ibm-gray-light tracking-widest">POLYMARKET POSITIONS</h3>
        <span className="text-[10px] text-ibm-gray">{positions.length} open</span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-[11px] text-ibm-gray animate-pulse">
          FETCHING POSITIONS...
        </div>
      ) : positions.length === 0 ? (
        <div className="px-4 py-8 text-center text-[11px] text-ibm-gray">
          NO POSITIONS FOUND
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-ibm-border/20">
                <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">MARKET</th>
                <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">SIDE</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">SIZE</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">AVG</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">CURRENT</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">VALUE</th>
                <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, i) => {
                const isProfit = pos.pnlUsd >= 0;
                return (
                  <tr
                    key={`${pos.conditionId}-${i}`}
                    className="border-b border-ibm-border/10 hover:bg-ibm-green/5 transition-colors"
                  >
                    <td className="px-4 py-2 text-ibm-white max-w-[200px] truncate">
                      {pos.market}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 text-[9px] border ${
                        pos.outcome === "Yes"
                          ? "border-ibm-green/40 text-ibm-green"
                          : "border-ibm-red/40 text-ibm-red"
                      }`}>
                        {pos.outcome.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-ibm-white font-mono">
                      {pos.size.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-ibm-gray-light font-mono">
                      {(pos.avgPrice * 100).toFixed(0)}¢
                    </td>
                    <td className="px-4 py-2 text-right text-ibm-amber font-mono">
                      {(pos.currentPrice * 100).toFixed(0)}¢
                    </td>
                    <td className="px-4 py-2 text-right text-ibm-white font-mono">
                      ${pos.value.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${isProfit ? "text-ibm-green" : "text-ibm-red"}`}>
                      {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)}
                      <span className="text-[9px] text-ibm-gray-light ml-1">
                        {isProfit ? "+" : ""}{pos.pnlPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
