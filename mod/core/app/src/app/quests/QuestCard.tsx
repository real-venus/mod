"use client";

import Link from 'next/link';
import { Quest, getStatusStyle, formatTime } from './types';

interface QuestCardProps {
  quest: Quest;
  userKey?: string;
}

export default function QuestCard({ quest, userKey }: QuestCardProps) {
  const canRespond = quest.status === 'open' && userKey;
  const isCreator = userKey === quest.creator;

  return (
    <Link
      href={`/quests/${quest.id}`}
      className="group block bg-[#0a0a0e] border-2 border-white/[0.08] hover:border-blue-500/50 transition-all duration-150 font-mono"
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
        <h3 className="text-[20px] font-extrabold text-white leading-tight mb-2 group-hover:text-blue-400 transition-colors truncate">
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
                className="px-2.5 py-1 text-[12px] font-extrabold text-blue-400/80 border-2 border-blue-500/25 bg-blue-500/10 uppercase tracking-wider shrink-0"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-[22px] font-extrabold text-green-400">
              {quest.reward.toLocaleString()} <span className="text-[13px] text-green-400/60 uppercase font-extrabold">tkn</span>
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
