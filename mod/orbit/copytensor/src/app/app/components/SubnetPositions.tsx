"use client";

import type { Allocation } from "../lib/types";
import { fmtTao, shortSs58 } from "../lib/api";

export default function SubnetPositions({
  allocations,
}: {
  allocations: Allocation[];
}) {
  if (!allocations.length) {
    return <p className="text-muted">No alpha positions found.</p>;
  }

  const sorted = [...allocations].sort((a, b) => b.value_tao - a.value_tao);

  return (
    <div>
      {/* Bar chart */}
      <div className="flex gap-1 h-8 mb-4 rounded overflow-hidden">
        {sorted.map((a) => (
          <div
            key={`${a.netuid}-${a.hotkey}`}
            className="bg-accent/30 hover:bg-accent/50 transition-colors relative group"
            style={{ width: `${Math.max(a.pct_of_total, 1)}%` }}
            title={`SN${a.netuid}: ${a.pct_of_total.toFixed(1)}%`}
          >
            {a.pct_of_total > 8 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-mono">
                SN{a.netuid}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Subnet</th>
            <th>Alpha</th>
            <th>Price</th>
            <th>Value</th>
            <th>%</th>
            <th>Hotkey</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={`${a.netuid}-${a.hotkey}`}>
              <td className="font-semibold">
                SN{a.netuid}
                <span className="text-muted text-xs ml-1">{a.subnet_name}</span>
              </td>
              <td className="font-mono text-sm">{a.alpha_amount.toFixed(4)}</td>
              <td className="font-mono text-sm">{a.alpha_price_tao.toFixed(6)}</td>
              <td className="font-mono text-sm">{fmtTao(a.value_tao)}</td>
              <td className="font-mono text-sm">{a.pct_of_total.toFixed(1)}%</td>
              <td className="font-mono text-xs text-muted">
                {shortSs58(a.hotkey)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
