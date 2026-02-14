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
      className="group block bg-[#0a0a0e] border border-white/[0.06] hover:border-blue-500/40 transition-all duration-150 font-mono"
    >
      <div className="px-4 py-3">
        {/* Top row: status + meta */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(quest.status)}`}>
              {quest.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-white/20">{formatTime(quest.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            {isCreator && <span className="text-[9px] font-bold text-cyan-400/50 uppercase">[YOU]</span>}
            <span className="text-[10px] text-white/20">{quest.responses?.length || 0} resp</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[14px] font-bold text-white/85 leading-tight mb-1 group-hover:text-blue-400 transition-colors truncate">
          {quest.title}
        </h3>

        {/* Description - single line */}
        <p className="text-[11px] text-white/30 leading-snug line-clamp-1 mb-2">
          {quest.description}
        </p>

        {/* Bottom row: tags + reward */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {quest.tags && quest.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-px text-[8px] font-bold text-blue-400/60 border border-blue-500/20 bg-blue-500/5 uppercase tracking-wider shrink-0"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-[14px] font-bold text-green-400">
              {quest.reward.toLocaleString()} <span className="text-[9px] text-green-400/50 uppercase">tkn</span>
            </span>
            {canRespond && (
              <span className="px-2.5 py-1 text-[9px] font-bold text-black bg-blue-400 uppercase tracking-wider">
                RESPOND
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
