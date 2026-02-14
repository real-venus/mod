"use client";

import { LeaderboardEntry } from './types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  loading: boolean;
}

function getRankDisplay(rank: number) {
  switch (rank) {
    case 1: return { color: 'text-amber-400', prefix: '>>>', border: 'border-amber-500/40', bg: 'bg-amber-500/[0.06]' };
    case 2: return { color: 'text-white/70', prefix: ' >>', border: 'border-white/15', bg: 'bg-white/[0.03]' };
    case 3: return { color: 'text-amber-600', prefix: '  >', border: 'border-amber-600/25', bg: 'bg-amber-600/[0.06]' };
    default: return { color: 'text-white/40', prefix: '   ', border: 'border-white/[0.06]', bg: 'bg-transparent' };
  }
}

export default function Leaderboard({ entries, loading }: LeaderboardProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 animate-pulse">_</span>
          <span className="text-[13px] text-white/35 font-bold">LOADING LEADERBOARD...</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#0a0a0e] border-2 border-white/[0.08] font-mono">
        <span className="text-[13px] text-white/25 font-bold">NO COMPLETED QUESTS YET</span>
        <span className="text-[12px] text-white/15 mt-1.5 font-medium">Be the first to earn rewards.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono">
      {/* Header */}
      <div className="bg-[#0a0a0e] border-2 border-white/[0.08] px-6 py-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-amber-400 text-[12px] font-extrabold">[LDR]</span>
          <span className="text-[12px] font-extrabold text-white/50 uppercase tracking-[0.2em]">Top Earners</span>
        </div>
        <p className="text-[12px] text-white/25 font-medium">Ranked by total rewards earned from approved quest responses.</p>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 flex items-center text-[10px] text-white/25 uppercase tracking-[0.2em] border-b-2 border-white/[0.08] font-extrabold">
        <span className="w-14">RANK</span>
        <span className="flex-1">ADDRESS</span>
        <span className="w-24 text-right">QUESTS</span>
        <span className="w-32 text-right">EARNED</span>
      </div>

      {/* Entries */}
      <div className="space-y-px">
        {entries.map((entry, i) => {
          const rank = i + 1;
          const style = getRankDisplay(rank);
          return (
            <div
              key={entry.responder}
              className={`${style.bg} border-2 ${style.border} px-5 py-3.5 flex items-center hover:bg-white/[0.03] transition-colors`}
            >
              {/* Rank */}
              <div className="w-14 shrink-0">
                <span className={`text-[15px] font-extrabold ${style.color}`}>
                  {String(rank).padStart(2, '0')}
                </span>
              </div>

              {/* Address */}
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] font-bold ${rank <= 3 ? style.color : 'text-white/50'} truncate block`}>
                  {entry.responder.length > 20
                    ? `${entry.responder.slice(0, 8)}...${entry.responder.slice(-8)}`
                    : entry.responder}
                </span>
              </div>

              {/* Quests completed */}
              <div className="w-24 text-right">
                <span className="text-[13px] text-white/35 font-bold">{entry.quests_completed}</span>
              </div>

              {/* Total earned */}
              <div className="w-32 text-right">
                <span className={`text-[16px] font-extrabold ${style.color}`}>
                  {entry.total_earned.toLocaleString()}
                </span>
                <span className="text-[10px] text-white/25 ml-1 font-bold">TKN</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
