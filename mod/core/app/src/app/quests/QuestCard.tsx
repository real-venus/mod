"use client";

import Link from 'next/link';
import { Quest, getStatusStyle, formatTime } from './types';

interface QuestCardProps {
  quest: Quest;
  userKey?: string;
}

const QUEST_COLORS = [
  { border: 'border-purple-500/50', hoverBorder: 'hover:border-purple-400', title: 'group-hover:text-purple-400', glow: 'rgba(168,85,247,0.15)', tag: 'text-purple-400/80 border-purple-500/25 bg-purple-500/10' },
  { border: 'border-cyan-500/50', hoverBorder: 'hover:border-cyan-400', title: 'group-hover:text-cyan-400', glow: 'rgba(34,211,238,0.15)', tag: 'text-cyan-400/80 border-cyan-500/25 bg-cyan-500/10' },
  { border: 'border-pink-500/50', hoverBorder: 'hover:border-pink-400', title: 'group-hover:text-pink-400', glow: 'rgba(236,72,153,0.15)', tag: 'text-pink-400/80 border-pink-500/25 bg-pink-500/10' },
  { border: 'border-amber-500/50', hoverBorder: 'hover:border-amber-400', title: 'group-hover:text-amber-400', glow: 'rgba(245,158,11,0.15)', tag: 'text-amber-400/80 border-amber-500/25 bg-amber-500/10' },
  { border: 'border-emerald-500/50', hoverBorder: 'hover:border-emerald-400', title: 'group-hover:text-emerald-400', glow: 'rgba(16,185,129,0.15)', tag: 'text-emerald-400/80 border-emerald-500/25 bg-emerald-500/10' },
  { border: 'border-rose-500/50', hoverBorder: 'hover:border-rose-400', title: 'group-hover:text-rose-400', glow: 'rgba(244,63,94,0.15)', tag: 'text-rose-400/80 border-rose-500/25 bg-rose-500/10' },
  { border: 'border-blue-500/50', hoverBorder: 'hover:border-blue-400', title: 'group-hover:text-blue-400', glow: 'rgba(59,130,246,0.15)', tag: 'text-blue-400/80 border-blue-500/25 bg-blue-500/10' },
  { border: 'border-orange-500/50', hoverBorder: 'hover:border-orange-400', title: 'group-hover:text-orange-400', glow: 'rgba(249,115,22,0.15)', tag: 'text-orange-400/80 border-orange-500/25 bg-orange-500/10' },
];

function getQuestColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return QUEST_COLORS[Math.abs(hash) % QUEST_COLORS.length];
}

export default function QuestCard({ quest, userKey }: QuestCardProps) {
  const canRespond = quest.status === 'open' && userKey;
  const isCreator = userKey === quest.creator;
  const color = getQuestColor(quest.id);

  return (
    <Link
      href={`/quests/${quest.id}`}
      className={`group block bg-[#0a0a0e] border-2 ${color.border} ${color.hoverBorder} transition-all duration-150 font-mono`}
      style={{ boxShadow: `0 0 20px ${color.glow}, inset 0 0 20px ${color.glow}` }}
    >
      <div className="px-6 py-5">
        {/* Top row: status + meta */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-[13px] font-extrabold uppercase tracking-wider border-2 ${getStatusStyle(quest.status)}`}>
              {quest.status.replace('_', ' ')}
            </span>
            <span className="text-[14px] text-white/35 font-bold">{formatTime(quest.created_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            {isCreator && <span className="text-[13px] font-extrabold text-cyan-400/70 uppercase">[YOU]</span>}
            <span className="text-[14px] text-white/35 font-bold">{quest.responses?.length || 0} resp</span>
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-[20px] font-extrabold text-white leading-tight mb-2 ${color.title} transition-colors truncate`}>
          {quest.title}
        </h3>

        {/* Description - single line */}
        <p className="text-[15px] text-white/45 leading-snug line-clamp-1 mb-4 font-medium">
          {quest.description}
        </p>

        {/* Bottom row: tags + reward */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            {quest.tags && quest.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className={`px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wider shrink-0 border-2 ${color.tag}`}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-[22px] font-extrabold text-green-400">
              {quest.reward.toLocaleString()} <span className="text-[13px] text-green-400/60 uppercase font-extrabold">USDC</span>
            </span>
            {canRespond && (
              <span className="px-4 py-2 text-[13px] font-extrabold text-black bg-blue-400 uppercase tracking-wider">
                RESPOND
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
