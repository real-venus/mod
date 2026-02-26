"use client";

import { useState } from 'react';
import { LeaderboardEntry, QuestCreatorEntry } from './types';

interface LeaderboardProps {
  responders: LeaderboardEntry[];
  questers: QuestCreatorEntry[];
  loading: boolean;
}

type LeaderboardView = 'responders' | 'questers';

function getRankDisplay(rank: number) {
  switch (rank) {
    case 1: return { color: 'text-amber-500 dark:text-amber-400', prefix: '>>>', border: 'border-amber-400 dark:border-amber-500/40', bg: 'bg-amber-50 dark:bg-amber-500/[0.06]' };
    case 2: return { color: 'text-gray-600 dark:text-white/70', prefix: ' >>', border: 'border-gray-300 dark:border-white/15', bg: 'bg-gray-50 dark:bg-white/[0.03]' };
    case 3: return { color: 'text-amber-700 dark:text-amber-600', prefix: '  >', border: 'border-amber-300 dark:border-amber-600/25', bg: 'bg-amber-50/50 dark:bg-amber-600/[0.06]' };
    default: return { color: 'text-gray-500 dark:text-white/40', prefix: '   ', border: 'border-gray-200 dark:border-white/[0.06]', bg: 'bg-transparent' };
  }
}

function truncateAddress(addr: string) {
  return addr.length > 20 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;
}

export default function Leaderboard({ responders, questers, loading }: LeaderboardProps) {
  const [view, setView] = useState<LeaderboardView>('responders');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <div className="flex items-center gap-3">
          <span className="text-blue-500 dark:text-blue-400 animate-pulse">_</span>
          <span className="text-[14px] text-gray-400 dark:text-white/35 font-bold">LOADING LEADERBOARD...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono">
      {/* Toggle */}
      <div className="flex items-center gap-0 border-b-2 border-gray-200 dark:border-white/[0.08]">
        <button
          onClick={() => setView('responders')}
          className={`px-5 py-3 text-[14px] font-extrabold tracking-wider uppercase border-b-2 -mb-px transition-all ${
            view === 'responders'
              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-500/[0.06]'
              : 'text-gray-400 dark:text-white/35 border-transparent hover:text-gray-600 dark:hover:text-white/60 hover:border-gray-300 dark:hover:border-white/15'
          }`}
        >
          TOP RESPONDERS
        </button>
        <button
          onClick={() => setView('questers')}
          className={`px-5 py-3 text-[14px] font-extrabold tracking-wider uppercase border-b-2 -mb-px transition-all ${
            view === 'questers'
              ? 'text-cyan-600 dark:text-cyan-400 border-cyan-500 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-500/[0.06]'
              : 'text-gray-400 dark:text-white/35 border-transparent hover:text-gray-600 dark:hover:text-white/60 hover:border-gray-300 dark:hover:border-white/15'
          }`}
        >
          TOP QUESTERS
        </button>
      </div>

      {view === 'responders' ? (
        <ResponderBoard entries={responders} />
      ) : (
        <QuesterBoard entries={questers} />
      )}
    </div>
  );
}

function ResponderBoard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#0a0a0e] border-2 border-gray-200 dark:border-white/[0.08] font-mono">
        <span className="text-[14px] text-gray-400 dark:text-white/25 font-bold">NO COMPLETED QUESTS YET</span>
        <span className="text-[13px] text-gray-300 dark:text-white/15 mt-1.5 font-medium">Be the first to earn rewards.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white dark:bg-[#0a0a0e] border-2 border-gray-200 dark:border-white/[0.08] px-6 py-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-emerald-500 dark:text-emerald-400 text-[13px] font-extrabold">[RSP]</span>
          <span className="text-[13px] font-extrabold text-gray-500 dark:text-white/50 uppercase tracking-[0.2em]">Top Responders</span>
        </div>
        <p className="text-[13px] text-gray-400 dark:text-white/25 font-medium">Ranked by total rewards earned from approved quest responses.</p>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 flex items-center text-[11px] text-gray-400 dark:text-white/25 uppercase tracking-[0.2em] border-b-2 border-gray-200 dark:border-white/[0.08] font-extrabold">
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
              className={`${style.bg} border-2 ${style.border} px-5 py-3.5 flex items-center hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors`}
            >
              <div className="w-14 shrink-0">
                <span className={`text-[15px] font-extrabold ${style.color}`}>
                  {String(rank).padStart(2, '0')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[14px] font-bold ${rank <= 3 ? style.color : 'text-gray-500 dark:text-white/50'} truncate block`}>
                  {truncateAddress(entry.responder)}
                </span>
              </div>
              <div className="w-24 text-right">
                <span className="text-[14px] text-gray-400 dark:text-white/35 font-bold">{entry.quests_completed}</span>
              </div>
              <div className="w-32 text-right">
                <span className={`text-[16px] font-extrabold ${style.color}`}>
                  {entry.total_earned.toLocaleString()}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-white/25 ml-1 font-bold">USDC</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuesterBoard({ entries }: { entries: QuestCreatorEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#0a0a0e] border-2 border-gray-200 dark:border-white/[0.08] font-mono">
        <span className="text-[14px] text-gray-400 dark:text-white/25 font-bold">NO QUESTS CREATED YET</span>
        <span className="text-[13px] text-gray-300 dark:text-white/15 mt-1.5 font-medium">Be the first to post a quest.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white dark:bg-[#0a0a0e] border-2 border-gray-200 dark:border-white/[0.08] px-6 py-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-cyan-500 dark:text-cyan-400 text-[13px] font-extrabold">[QST]</span>
          <span className="text-[13px] font-extrabold text-gray-500 dark:text-white/50 uppercase tracking-[0.2em]">Top Questers</span>
        </div>
        <p className="text-[13px] text-gray-400 dark:text-white/25 font-medium">Ranked by total rewards posted across all quests created.</p>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 flex items-center text-[11px] text-gray-400 dark:text-white/25 uppercase tracking-[0.2em] border-b-2 border-gray-200 dark:border-white/[0.08] font-extrabold">
        <span className="w-14">RANK</span>
        <span className="flex-1">ADDRESS</span>
        <span className="w-20 text-right">CREATED</span>
        <span className="w-20 text-right">DONE</span>
        <span className="w-32 text-right">POSTED</span>
      </div>

      {/* Entries */}
      <div className="space-y-px">
        {entries.map((entry, i) => {
          const rank = i + 1;
          const style = getRankDisplay(rank);
          return (
            <div
              key={entry.creator}
              className={`${style.bg} border-2 ${style.border} px-5 py-3.5 flex items-center hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors`}
            >
              <div className="w-14 shrink-0">
                <span className={`text-[15px] font-extrabold ${style.color}`}>
                  {String(rank).padStart(2, '0')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[14px] font-bold ${rank <= 3 ? style.color : 'text-gray-500 dark:text-white/50'} truncate block`}>
                  {truncateAddress(entry.creator)}
                </span>
              </div>
              <div className="w-20 text-right">
                <span className="text-[14px] text-gray-400 dark:text-white/35 font-bold">{entry.quests_created}</span>
              </div>
              <div className="w-20 text-right">
                <span className="text-[14px] text-gray-400 dark:text-white/35 font-bold">{entry.quests_completed}</span>
              </div>
              <div className="w-32 text-right">
                <span className={`text-[16px] font-extrabold ${style.color}`}>
                  {entry.total_reward_posted.toLocaleString()}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-white/25 ml-1 font-bold">USDC</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
