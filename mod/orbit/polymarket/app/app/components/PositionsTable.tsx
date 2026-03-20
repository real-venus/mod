"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchPositions } from "../lib/polymarket";
import { PolymarketPosition } from "../lib/types";

export default function PositionsTable() {
  const { auth } = useAuth();
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.address) return;
    setLoading(true);
    fetchPositions(auth.address)
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setLoading(false));
  }, [auth.address]);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnlUsd, 0);

  return (
    <div className="pixel-panel overflow-hidden">
      <div className="px-3 py-2 border-b-2 border-pixel-border flex items-center justify-between">
        <span className="text-[7px] text-pixel-gray-light tracking-wider">MY POSITIONS</span>
        <div className="flex items-center gap-3">
          <span className="text-[6px] text-pixel-amber">
            VALUE: ${totalValue.toFixed(2)}
          </span>
          <span className={`text-[6px] ${totalPnl >= 0 ? "text-pixel-green" : "text-pixel-red"}`}>
            P&L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {!auth.address ? (
        <div className="p-6 text-center text-[7px] text-pixel-gray">
          CONNECT WALLET TO VIEW POSITIONS
        </div>
      ) : loading ? (
        <div className="p-6 text-center text-[7px] text-pixel-green animate-pulse">
          LOADING POSITIONS...
        </div>
      ) : positions.length === 0 ? (
        <div className="p-6 text-center text-[7px] text-pixel-gray">
          NO OPEN POSITIONS
        </div>
      ) : (
        <table className="pixel-table">
          <thead>
            <tr>
              <th>MARKET</th>
              <th>SIDE</th>
              <th className="text-right">SIZE</th>
              <th className="text-right">AVG</th>
              <th className="text-right">NOW</th>
              <th className="text-right">VALUE</th>
              <th className="text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const isProfit = pos.pnlUsd >= 0;
              return (
                <tr key={`${pos.conditionId}-${i}`}>
                  <td className="text-pixel-white max-w-[200px] truncate">{pos.market}</td>
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
                  <td className="text-right text-pixel-white font-mono">{pos.size.toFixed(1)}</td>
                  <td className="text-right text-pixel-gray-light font-mono">
                    {Math.round(pos.avgPrice * 100)}c
                  </td>
                  <td className="text-right text-pixel-amber font-mono">
                    {Math.round(pos.currentPrice * 100)}c
                  </td>
                  <td className="text-right text-pixel-white font-mono">${pos.value.toFixed(2)}</td>
                  <td className={`text-right font-mono ${isProfit ? "text-pixel-green" : "text-pixel-red"}`}>
                    {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
