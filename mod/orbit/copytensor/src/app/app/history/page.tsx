"use client";

import { useEffect, useState } from "react";
import type { Trade } from "../lib/types";
import { fetchTrades, fmtTao, ago, shortSs58 } from "../lib/api";

export default function HistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrades(100)
      .then(setTrades)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Trade History</h1>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : trades.length === 0 ? (
        <p className="text-muted">No trades executed yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Copy</th>
              <th>Action</th>
              <th>Subnet</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Block</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="text-sm text-muted">{ago(t.timestamp)}</td>
                <td className="font-mono text-xs">{t.copy_id}</td>
                <td>
                  <span
                    className={`text-xs font-semibold ${
                      t.action === "stake" ? "text-positive" : "text-negative"
                    }`}
                  >
                    {t.action}
                  </span>
                </td>
                <td>SN{t.netuid}</td>
                <td className="font-mono text-sm">{fmtTao(t.amount_tao)}</td>
                <td>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      t.status === "confirmed"
                        ? "bg-positive/20 text-positive"
                        : t.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-negative"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="text-sm text-muted">{t.block || "-"}</td>
                <td className="text-xs text-negative max-w-xs truncate">
                  {t.error || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
