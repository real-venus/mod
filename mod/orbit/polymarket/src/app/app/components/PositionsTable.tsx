"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchPositions } from "../lib/polymarket";
import { PolymarketPosition } from "../lib/types";

type PosSort = "market" | "size" | "avgPrice" | "currentPrice" | "value" | "pnlUsd";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-pixel-gray/40 ml-1">-</span>;
  return <span className="ml-1">{dir === "desc" ? "\u25BC" : "\u25B2"}</span>;
}

export default function PositionsTable() {
  const { auth } = useAuth();
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<PosSort>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!auth.address) return;
    setLoading(true);
    fetchPositions(auth.address)
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setLoading(false));
  }, [auth.address]);

  const handleSort = (col: PosSort) => {
    if (sort === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      let cmp = 0;
      switch (sort) {
        case "market": cmp = a.market.localeCompare(b.market); break;
        case "size": cmp = a.size - b.size; break;
        case "avgPrice": cmp = a.avgPrice - b.avgPrice; break;
        case "currentPrice": cmp = a.currentPrice - b.currentPrice; break;
        case "value": cmp = a.value - b.value; break;
        case "pnlUsd": cmp = a.pnlUsd - b.pnlUsd; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [positions, sort, sortDir]);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnlUsd, 0);

  const columns: { key: PosSort; label: string; align: "left" | "right" }[] = [
    { key: "market", label: "MARKET", align: "left" },
    { key: "size", label: "SIZE", align: "right" },
    { key: "avgPrice", label: "AVG", align: "right" },
    { key: "currentPrice", label: "NOW", align: "right" },
    { key: "value", label: "VALUE", align: "right" },
    { key: "pnlUsd", label: "P&L", align: "right" },
  ];

  return (
    <div className="pixel-panel overflow-hidden">
      <div className="px-5 py-4 border-b-2 border-pixel-border flex items-center justify-between">
        <span className="text-[16px] text-pixel-gray-light tracking-wider">MY POSITIONS</span>
        <div className="flex items-center gap-4">
          <span className="text-[16px] text-pixel-white">
            VALUE: ${totalValue.toFixed(2)}
          </span>
          <span className={`text-[16px] ${totalPnl >= 0 ? "text-pixel-white" : "text-pixel-gray"}`}>
            P&L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {!auth.address ? (
        <div className="p-10 text-center text-sm text-pixel-gray">
          CONNECT WALLET TO VIEW POSITIONS
        </div>
      ) : loading ? (
        <div className="p-10 text-center text-sm text-pixel-white animate-pulse">
          LOADING POSITIONS...
        </div>
      ) : positions.length === 0 ? (
        <div className="p-10 text-center text-sm text-pixel-gray">
          NO OPEN POSITIONS
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="pixel-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "650px" }}>
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "55px" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr>
                {columns.slice(0, 1).map((col) => (
                  <th
                    key={col.key}
                    className={`sortable ${sort === col.key ? "sorted" : ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortArrow active={sort === col.key} dir={sortDir} />
                  </th>
                ))}
                <th>SIDE</th>
                {columns.slice(1).map((col) => (
                  <th
                    key={col.key}
                    className={`sortable ${sort === col.key ? "sorted" : ""} text-${col.align}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortArrow active={sort === col.key} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pos, i) => {
                const isProfit = pos.pnlUsd >= 0;
                return (
                  <tr key={`${pos.conditionId}-${i}`}>
                    <td className="text-pixel-white truncate" title={pos.market}>{pos.market}</td>
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
                    <td className="text-right text-pixel-white font-mono">{pos.size.toFixed(1)}</td>
                    <td className="text-right text-pixel-gray-light font-mono">
                      {Math.round(pos.avgPrice * 100)}c
                    </td>
                    <td className="text-right text-pixel-white font-mono">
                      {Math.round(pos.currentPrice * 100)}c
                    </td>
                    <td className="text-right text-pixel-white font-mono">${pos.value.toFixed(2)}</td>
                    <td className={`text-right font-mono ${isProfit ? "text-pixel-white" : "text-pixel-gray"}`}>
                      {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)}
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
