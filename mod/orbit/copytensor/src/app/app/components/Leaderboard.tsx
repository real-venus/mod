"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeaderboardEntry } from "../lib/types";
import { fetchLeaderboard, fmtPct, fmtTao, shortSs58 } from "../lib/api";
import PnlBadge from "./PnlBadge";

const WINDOWS = [1, 3, 7, 14, 30];

export default function Leaderboard() {
  const [days, setDays] = useState(7);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchLeaderboard(days, 50)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-lg font-semibold">Top Performers</h2>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`text-xs px-2 py-1 rounded ${
                days === w ? "btn-primary" : "btn-muted"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-negative text-sm mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-muted">
          No watched accounts yet. Use the search bar to look up an account,
          then add it to your watchlist.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Account</th>
              <th>Stake</th>
              <th>{days}d PnL</th>
              <th>Subnets</th>
              <th>Top SN</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.ss58}>
                <td className="text-muted">{i + 1}</td>
                <td>
                  <Link href={`/account/${e.ss58}`} className="font-mono text-sm">
                    {e.label || shortSs58(e.ss58)}
                  </Link>
                </td>
                <td className="font-mono text-sm">{fmtTao(e.total_stake_tao)}</td>
                <td>
                  <PnlBadge tao={e.pnl_tao} pct={e.pnl_pct} size="sm" />
                </td>
                <td>{e.num_subnets}</td>
                <td className="text-muted">
                  {e.top_subnet != null ? `SN${e.top_subnet}` : "-"}
                </td>
                <td>
                  <Link
                    href={`/copy/new?target=${e.ss58}`}
                    className="text-xs text-accent"
                  >
                    Copy
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
