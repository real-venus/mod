"use client";

import { useEffect, useState } from "react";
import { useStore, type LeaderboardEntry } from "@/lib/store";
import { buildLeaderboard } from "@/lib/bittensor";
import { toast } from "react-toastify";
import { shortAddress } from "@/lib/wallet";

export default function Leaderboard() {
  const { leaderboard, setLeaderboard } = useStore();
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("30d");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (leaderboard.length === 0) load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await buildLeaderboard(30);
      setLeaderboard(data);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-btcard border border-btborder rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold">Top Performers</h2>
          <span className="text-[10px] text-btmuted">Last 30 days</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-btdark rounded-md p-0.5">
            {(["7d", "30d"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                  timeframe === t ? "bg-btgreen/20 text-btgreen" : "text-btmuted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1 bg-btgreen/10 text-btgreen border border-btgreen/30 rounded-md text-xs hover:bg-btgreen/20 transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-btdark/50">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Rank</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Address</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Total Value</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">ROI (30d)</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">PnL</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Trades</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Win Rate</th>
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <LeaderboardRow
                key={entry.rank}
                entry={entry}
                expanded={expanded === entry.rank}
                onToggle={() => setExpanded(expanded === entry.rank ? null : entry.rank)}
              />
            ))}
            {leaderboard.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-btmuted">
                  Click Refresh to scan for top performers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: LeaderboardEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { setActiveTab } = useStore();
  const isPositive = entry.roi_30d > 0;

  return (
    <>
      <tr
        className="border-t border-btborder/50 row-hover cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2.5">
          <span
            className={`text-xs font-bold ${
              entry.rank <= 3 ? "text-btyellow" : "text-btmuted"
            }`}
          >
            #{entry.rank}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-xs font-mono">{shortAddress(entry.coldkey)}</span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-xs font-mono">{entry.total_value_tao.toFixed(2)} TAO</span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`text-xs font-mono font-bold ${isPositive ? "text-btgreen" : "text-btred"}`}
          >
            {isPositive ? "+" : ""}
            {(entry.roi_30d * 100).toFixed(2)}%
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`text-xs font-mono ${entry.pnl_30d >= 0 ? "text-btgreen" : "text-btred"}`}
          >
            {entry.pnl_30d >= 0 ? "+" : ""}
            {entry.pnl_30d.toFixed(2)}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-xs font-mono text-btmuted">{entry.trade_count}</span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-xs font-mono text-btmuted">
            {(entry.win_rate * 100).toFixed(0)}%
          </span>
        </td>
        <td className="px-3 py-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("copytrade");
            }}
            className="px-2 py-0.5 text-[10px] bg-btblue/10 text-btblue border border-btblue/20 rounded hover:bg-btblue/20 transition-all"
          >
            Copy
          </button>
        </td>
      </tr>

      {/* Expanded positions */}
      {expanded && entry.top_subnets.length > 0 && (
        <tr className="bg-btdark/30">
          <td colSpan={8} className="px-6 py-3">
            <p className="text-[10px] text-btmuted uppercase mb-2">Top Positions</p>
            <div className="grid grid-cols-3 gap-2">
              {entry.top_subnets.map((pos) => (
                <div
                  key={pos.netuid}
                  className="bg-btdark border border-btborder/50 rounded-lg p-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-btgreen">SN{pos.netuid}</span>
                    <span className="text-[10px] text-btmuted">
                      {(pos.weight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-btmuted">{pos.name}</p>
                  <p className="text-xs font-mono">{pos.value_tao.toFixed(2)} TAO</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
