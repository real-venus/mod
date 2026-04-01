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
    case 1: return { color: 'text-amber-500 dark:text-amber-400', prefix: '>>>', border: 'border-amber-400 dark:border-amber-500/40', bgStyle: 'var(--bg-surface)' };
    case 2: return { color: 'text-gray-600 dark:text-white/70', prefix: ' >>', border: 'border-gray-300 dark:border-white/15', bgStyle: 'var(--bg-surface)' };
    case 3: return { color: 'text-amber-700 dark:text-amber-600', prefix: '  >', border: 'border-amber-300 dark:border-amber-600/25', bgStyle: 'var(--bg-surface)' };
    default: return { color: 'text-gray-500 dark:text-white/40', prefix: '   ', border: 'border-gray-200 dark:border-white/[0.06]', bgStyle: 'transparent' };
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
          <span className="animate-pulse" style={{ color: 'rgb(59 130 246)' }}>_</span>
          <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>LOADING LEADERBOARD...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono">
      {/* Toggle */}
      <div className="flex items-center gap-0 border-b-4" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => setView('responders')}
          className="px-5 py-3 text-[14px] font-extrabold tracking-wider uppercase border-b-4 -mb-1 transition-all"
          style={{
            color: view === 'responders' ? 'rgb(16 185 129)' : 'var(--text-secondary)',
            borderColor: view === 'responders' ? 'rgb(16 185 129)' : 'transparent',
            backgroundColor: view === 'responders' ? 'var(--bg-surface)' : 'transparent',
          }}
        >
          TOP RESPONDERS
        </button>
        <button
          onClick={() => setView('questers')}
          className="px-5 py-3 text-[14px] font-extrabold tracking-wider uppercase border-b-4 -mb-1 transition-all"
          style={{
            color: view === 'questers' ? 'rgb(34 211 238)' : 'var(--text-secondary)',
            borderColor: view === 'questers' ? 'rgb(34 211 238)' : 'transparent',
            backgroundColor: view === 'questers' ? 'var(--bg-surface)' : 'transparent',
          }}
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
      <div className="flex flex-col items-center justify-center py-20 font-mono" style={{ backgroundColor: 'var(--bg-primary)', border: '4px solid var(--border-color)' }}>
        <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>NO COMPLETED QUESTS YET</span>
        <span className="text-[13px] mt-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>Be the first to earn rewards.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="px-6 py-5" style={{ backgroundColor: 'var(--bg-primary)', border: '4px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-extrabold" style={{ color: 'rgb(16 185 129)' }}>[RSP]</span>
          <span className="text-[13px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>Top Responders</span>
        </div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Ranked by total rewards earned from approved quest responses.</p>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 flex items-center text-[11px] uppercase tracking-[0.2em] border-b-4 font-extrabold" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)' }}>
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
              className={`border-4 ${style.border} px-5 py-3.5 flex items-center transition-colors`}
              style={{ backgroundColor: style.bgStyle }}
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
                <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>{entry.quests_completed}</span>
              </div>
              <div className="w-32 text-right">
                <span className={`text-[16px] font-extrabold ${style.color}`}>
                  {entry.total_earned.toLocaleString()}
                </span>
                <span className="text-[11px] ml-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>USDC</span>
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
      <div className="flex flex-col items-center justify-center py-20 font-mono" style={{ backgroundColor: 'var(--bg-primary)', border: '4px solid var(--border-color)' }}>
        <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>NO QUESTS CREATED YET</span>
        <span className="text-[13px] mt-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>Be the first to post a quest.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="px-6 py-5" style={{ backgroundColor: 'var(--bg-primary)', border: '4px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-extrabold" style={{ color: 'rgb(34 211 238)' }}>[QST]</span>
          <span className="text-[13px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>Top Questers</span>
        </div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Ranked by total rewards posted across all quests created.</p>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 flex items-center text-[11px] uppercase tracking-[0.2em] border-b-4 font-extrabold" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)' }}>
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
              className={`border-4 ${style.border} px-5 py-3.5 flex items-center transition-colors`}
              style={{ backgroundColor: style.bgStyle }}
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
                <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>{entry.quests_created}</span>
              </div>
              <div className="w-20 text-right">
                <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>{entry.quests_completed}</span>
              </div>
              <div className="w-32 text-right">
                <span className={`text-[16px] font-extrabold ${style.color}`}>
                  {entry.total_reward_posted.toLocaleString()}
                </span>
                <span className="text-[11px] ml-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>USDC</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
