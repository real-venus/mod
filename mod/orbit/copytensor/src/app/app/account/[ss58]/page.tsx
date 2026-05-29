"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { AccountData, PnlData } from "../../lib/types";
import {
  fetchAccount,
  fetchPnl,
  fmtTao,
  shortSs58,
  watchAccount,
} from "../../lib/api";
import PnlBadge from "../../components/PnlBadge";
import SubnetPositions from "../../components/SubnetPositions";

const WINDOWS = [1, 3, 7, 14, 30];

export default function AccountPage() {
  const { ss58 } = useParams<{ ss58: string }>();
  const [days, setDays] = useState(7);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    if (!ss58) return;
    setLoading(true);
    setError("");
    Promise.all([fetchAccount(ss58, days), fetchPnl(ss58, days)])
      .then(([a, p]) => {
        setAccount(a);
        setPnl(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ss58, days]);

  if (loading)
    return <p className="text-muted">Loading account {shortSs58(ss58)}...</p>;
  if (error) return <p className="text-negative">{error}</p>;
  if (!account) return <p className="text-muted">Account not found.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono">{shortSs58(ss58)}</h1>
          <p className="text-xs text-muted font-mono break-all">{ss58}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-muted text-sm"
            onClick={async () => {
              await watchAccount(ss58);
              setWatched(true);
            }}
            disabled={watched}
          >
            {watched ? "Watched" : "Watch"}
          </button>
          <Link
            href={`/copy/new?target=${ss58}`}
            className="btn-primary text-sm no-underline inline-block"
          >
            Copy
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded p-4">
          <p className="text-xs text-muted mb-1">Total Stake</p>
          <p className="text-lg font-mono">{fmtTao(account.total_stake_tao)}</p>
        </div>
        <div className="bg-surface border border-border rounded p-4">
          <p className="text-xs text-muted mb-1">{days}d PnL</p>
          <PnlBadge tao={account.pnl_tao} pct={account.pnl_pct} size="lg" />
        </div>
        <div className="bg-surface border border-border rounded p-4">
          <p className="text-xs text-muted mb-1">Subnets</p>
          <p className="text-lg">{account.allocations.length}</p>
        </div>
      </div>

      {/* Day selector */}
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

      {/* PnL by subnet */}
      {pnl && pnl.by_subnet.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">PnL by Subnet</h2>
          <table>
            <thead>
              <tr>
                <th>Subnet</th>
                <th>Alpha Start</th>
                <th>Alpha End</th>
                <th>Price Start</th>
                <th>Price End</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {pnl.by_subnet
                .sort((a, b) => b.pnl_tao - a.pnl_tao)
                .map((s) => (
                  <tr key={s.netuid}>
                    <td className="font-semibold">
                      SN{s.netuid}{" "}
                      <span className="text-xs text-muted">{s.subnet_name}</span>
                    </td>
                    <td className="font-mono text-sm">
                      {s.alpha_start.toFixed(4)}
                    </td>
                    <td className="font-mono text-sm">
                      {s.alpha_end.toFixed(4)}
                    </td>
                    <td className="font-mono text-sm">
                      {s.price_start_tao.toFixed(6)}
                    </td>
                    <td className="font-mono text-sm">
                      {s.price_end_tao.toFixed(6)}
                    </td>
                    <td>
                      <PnlBadge tao={s.pnl_tao} pct={s.pnl_pct} size="sm" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Positions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Subnet Positions</h2>
        <SubnetPositions allocations={account.allocations} />
      </div>
    </div>
  );
}
