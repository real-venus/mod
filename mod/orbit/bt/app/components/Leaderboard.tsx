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
    <div className="pixel-box overflow-hidden">
      <div className="px-4 py-3 border-b-2 border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[9px] font-pixel text-bttext">TOP PERFORMERS</h2>
          <span className="text-[7px] font-pixel text-btmuted">LAST 30D</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0 border-2 border-btborder">
            {(["7d", "30d"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2 py-0.5 font-pixel text-[7px] ${
                  timeframe === t ? "bg-btgreen text-black" : "bg-btcard text-btmuted"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="pixel-btn bg-btgreen text-black px-3 py-1 font-pixel text-[7px] border-btgreen disabled:opacity-50"
          >
            {loading ? "WAIT..." : "REFRESH"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-btdark">
            <tr>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">#</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">ADDR</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">VALUE</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">ROI</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">PNL</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">TRADES</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">WIN%</th>
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted">ACT</th>
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
                <td colSpan={8} className="px-4 py-8 text-center text-[8px] font-pixel text-btmuted">
                  {">> CLICK REFRESH TO SCAN"}
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
        className="border-t border-btborder/50 row-hover cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-2.5">
          <span
            className={`text-[8px] font-pixel ${
              entry.rank <= 3 ? "text-btyellow" : "text-btmuted"
            }`}
          >
            #{entry.rank}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[7px] font-pixel text-bttext">{shortAddress(entry.coldkey)}</span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[7px] font-pixel text-bttext">{entry.total_value_tao.toFixed(2)}</span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`text-[7px] font-pixel ${isPositive ? "text-btgreen" : "text-btred"}`}
          >
            {isPositive ? "+" : ""}
            {(entry.roi_30d * 100).toFixed(2)}%
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`text-[7px] font-pixel ${entry.pnl_30d >= 0 ? "text-btgreen" : "text-btred"}`}
          >
            {entry.pnl_30d >= 0 ? "+" : ""}
            {entry.pnl_30d.toFixed(2)}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[7px] font-pixel text-btmuted">{entry.trade_count}</span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[7px] font-pixel text-btmuted">
            {(entry.win_rate * 100).toFixed(0)}%
          </span>
        </td>
        <td className="px-3 py-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("copytrade");
            }}
            className="pixel-btn bg-btblue text-white px-2 py-0.5 text-[6px] font-pixel border-btblue"
          >
            COPY
          </button>
        </td>
      </tr>

      {expanded && entry.top_subnets.length > 0 && (
        <tr className="bg-btdark">
          <td colSpan={8} className="px-6 py-3">
            <p className="text-[7px] font-pixel text-btmuted uppercase mb-2">TOP POSITIONS</p>
            <div className="grid grid-cols-3 gap-2">
              {entry.top_subnets.map((pos) => (
                <div
                  key={pos.netuid}
                  className="bg-btcard border-2 border-btborder p-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[7px] font-pixel text-btgreen">SN{pos.netuid}</span>
                    <span className="text-[6px] font-pixel text-btmuted">
                      {(pos.weight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[6px] font-pixel text-btmuted">{pos.name}</p>
                  <p className="text-[8px] font-pixel text-bttext">{pos.value_tao.toFixed(2)} TAO</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
