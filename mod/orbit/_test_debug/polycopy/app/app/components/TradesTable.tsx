"use client";

import { useState } from "react";
import { Trade } from "../lib/types";
import { CHAINS } from "../lib/chains";
import { shortAddress } from "../lib/wallet";

interface Props {
  trades: Trade[];
  filterProxy?: string;
}

export default function TradesTable({ trades, filterProxy }: Props) {
  const [page, setPage] = useState(0);
  const perPage = 15;

  const filtered = filterProxy ? trades.filter((t) => t.proxyAddress === filterProxy) : trades;
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  return (
    <div className="panel-glow bg-ibm-panel">
      {/* Table header */}
      <div className="px-4 py-3 border-b border-ibm-border/30 flex items-center justify-between">
        <h3 className="text-[11px] text-ibm-gray-light tracking-widest">TRADE HISTORY</h3>
        <span className="text-[10px] text-ibm-gray">{filtered.length} trades</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-ibm-border/20">
              <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">ID</th>
              <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">TIME</th>
              <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">CHAIN</th>
              <th className="text-left px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">PAIR</th>
              <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">IN</th>
              <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">OUT</th>
              <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">P&L</th>
              <th className="text-right px-4 py-2 text-ibm-gray-light font-medium tracking-wider text-[10px]">TX</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((trade) => {
              const chain = CHAINS[trade.chainId];
              const isProfit = (trade.pnl || 0) >= 0;
              return (
                <tr
                  key={trade.txHash}
                  className="border-b border-ibm-border/10 hover:bg-ibm-green/5 transition-colors"
                >
                  <td className="px-4 py-2 text-ibm-gray-light font-mono">#{trade.tradeId}</td>
                  <td className="px-4 py-2 text-ibm-gray-light font-mono">
                    {new Date(trade.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="px-1.5 py-0.5 text-[9px] border"
                      style={{
                        borderColor: (chain?.color || "#42be65") + "66",
                        color: chain?.color || "#42be65",
                      }}
                    >
                      {chain?.shortName || "???"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ibm-white font-mono">
                    {trade.tokenIn}/{trade.tokenOut}
                  </td>
                  <td className="px-4 py-2 text-right text-ibm-amber font-mono">
                    {parseFloat(trade.amountIn).toFixed(4)}
                  </td>
                  <td className="px-4 py-2 text-right text-ibm-cyan font-mono">
                    {parseFloat(trade.amountOut).toFixed(4)}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono font-medium ${isProfit ? "text-ibm-green" : "text-ibm-red"}`}>
                    {isProfit ? "+" : ""}${trade.pnl?.toFixed(2)}
                    <span className="text-[9px] text-ibm-gray-light ml-1">
                      {isProfit ? "+" : ""}{trade.pnlPct?.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-ibm-blue hover:text-ibm-green-bright cursor-pointer font-mono">
                      {shortAddress(trade.txHash)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 border-t border-ibm-border/20 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[10px] text-ibm-gray-light hover:text-ibm-green disabled:opacity-30 transition-colors"
          >
            PREV
          </button>
          <span className="text-[10px] text-ibm-gray-light">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-[10px] text-ibm-gray-light hover:text-ibm-green disabled:opacity-30 transition-colors"
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  );
}
