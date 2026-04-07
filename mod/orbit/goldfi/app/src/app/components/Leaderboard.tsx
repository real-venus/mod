'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50095';

interface LeaderboardEntry {
  rank: number;
  address: string;
  pnl_pct: number;
  pnl_abs: number;
  score: number;
  reward: number;
  share: number;
}

export default function Leaderboard() {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/leaderboard`);
        const data = await res.json();
        setBoard(Array.isArray(data) ? data : []);
      } catch {
        setBoard([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-center text-muted py-20">Loading leaderboard...</div>;

  if (board.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-10 text-center">
        <p className="text-muted text-lg">No traders yet</p>
        <p className="text-muted text-sm mt-2">Register traders and start an epoch to see the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-card-border">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Live Leaderboard</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs uppercase tracking-wide border-b border-card-border">
            <th className="text-left p-3 w-16">#</th>
            <th className="text-left p-3">Trader</th>
            <th className="text-right p-3">PnL %</th>
            <th className="text-right p-3">PnL $</th>
            <th className="text-right p-3">Score (x&sup2;)</th>
            <th className="text-right p-3">Reward</th>
            <th className="text-right p-3">Share</th>
          </tr>
        </thead>
        <tbody>
          {board.map((entry) => (
            <tr key={entry.address} className="border-b border-card-border/50 hover:bg-white/[0.02] transition-colors">
              <td className="p-3">
                <RankBadge rank={entry.rank} />
              </td>
              <td className="p-3 font-mono text-xs">
                {entry.address.length > 12
                  ? `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`
                  : entry.address}
              </td>
              <td className={`p-3 text-right font-mono ${entry.pnl_pct >= 0 ? 'text-pos' : 'text-neg'}`}>
                {entry.pnl_pct >= 0 ? '+' : ''}{entry.pnl_pct.toFixed(2)}%
              </td>
              <td className={`p-3 text-right font-mono ${entry.pnl_abs >= 0 ? 'text-pos' : 'text-neg'}`}>
                {entry.pnl_abs >= 0 ? '+' : ''}{entry.pnl_abs.toFixed(2)}
              </td>
              <td className={`p-3 text-right font-mono ${entry.score >= 0 ? 'text-pos' : 'text-neg'}`}>
                {entry.score.toFixed(1)}
              </td>
              <td className="p-3 text-right font-mono text-gold">
                {entry.reward > 0 ? entry.reward.toFixed(2) : '—'}
              </td>
              <td className="p-3 text-right font-mono text-muted">
                {entry.share > 0 ? `${entry.share.toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-gold font-bold">1st</span>;
  if (rank === 2) return <span className="text-silver font-bold">2nd</span>;
  if (rank === 3) return <span className="text-[#cd7f32] font-bold">3rd</span>;
  return <span className="text-muted">{rank}th</span>;
}
