"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CopyConfig } from "../lib/types";
import {
  fetchCopies,
  pauseCopy,
  resumeCopy,
  deleteCopy,
  syncCopy,
  shortSs58,
  ago,
} from "../lib/api";

export default function CopyPage() {
  const [copies, setCopies] = useState<CopyConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetchCopies()
      .then(setCopies)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Copy Trading</h1>
        <Link href="/copy/new" className="btn-primary text-sm no-underline">
          New Copy
        </Link>
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : copies.length === 0 ? (
        <p className="text-muted">
          No active copy trades.{" "}
          <Link href="/copy/new">Create one</Link>.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Target</th>
              <th>Status</th>
              <th>Last Sync</th>
              <th>Max/Tx</th>
              <th>Daily Limit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {copies.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-sm">{c.id}</td>
                <td>
                  <Link
                    href={`/account/${c.target_ss58}`}
                    className="font-mono text-sm"
                  >
                    {c.label || shortSs58(c.target_ss58)}
                  </Link>
                </td>
                <td>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      c.status === "active"
                        ? "bg-positive/20 text-positive"
                        : c.status === "paused"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-negative"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="text-sm text-muted">
                  {c.last_sync_block ? `block ${c.last_sync_block}` : "-"}
                </td>
                <td className="font-mono text-sm">
                  {c.config.max_tao_per_tx} TAO
                </td>
                <td className="font-mono text-sm">
                  {c.config.daily_limit_tao} TAO
                </td>
                <td className="flex gap-1">
                  {c.status === "active" ? (
                    <button
                      className="btn-muted text-xs"
                      onClick={async () => {
                        await pauseCopy(c.id);
                        load();
                      }}
                    >
                      Pause
                    </button>
                  ) : c.status === "paused" ? (
                    <button
                      className="btn-primary text-xs"
                      onClick={async () => {
                        await resumeCopy(c.id);
                        load();
                      }}
                    >
                      Resume
                    </button>
                  ) : null}
                  <button
                    className="btn-muted text-xs"
                    onClick={async () => {
                      await syncCopy(c.id);
                      load();
                    }}
                  >
                    Sync
                  </button>
                  <button
                    className="btn-danger text-xs"
                    onClick={async () => {
                      if (confirm("Delete this copy trade?")) {
                        await deleteCopy(c.id);
                        load();
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
