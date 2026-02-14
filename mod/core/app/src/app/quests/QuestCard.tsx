"use client";

import Link from 'next/link';
import { Quest, getStatusStyle, formatTime } from './types';

interface QuestCardProps {
  quest: Quest;
  userKey?: string;
}

export default function QuestCard({ quest, userKey }: QuestCardProps) {
  const canRespond = quest.status === 'open' && userKey;
  return (
    <Link
      href={`/quests/${quest.id}`}
      className="group relative bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-all duration-200 cursor-pointer block"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-[15px] font-medium text-neutral-100 leading-snug tracking-tight">
            {quest.title}
          </h3>
          <span className={`shrink-0 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider border ${getStatusStyle(quest.status)}`}>
            {quest.status}
          </span>
        </div>

        {/* Description */}
        <p className="text-[13px] text-neutral-400 leading-relaxed line-clamp-2 mb-4">
          {quest.description}
        </p>

        {/* Tags */}
        {quest.tags && quest.tags.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {quest.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[11px] font-mono text-purple-400/80 bg-purple-500/8 border border-purple-500/15"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Response prompt */}
        {canRespond && (
          <div className="mb-3 px-3 py-2.5 bg-purple-500/5 border border-purple-500/20 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            <span className="text-[12px] font-mono text-purple-300">Accepting responses — click to submit yours</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800/60">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-mono font-medium text-emerald-400">${quest.reward}</span>
          </div>
          <div className="flex items-center gap-3">
            {canRespond && (
              <span className="px-3 py-1 text-[11px] font-mono font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors">
                Respond
              </span>
            )}
            <span className="text-[11px] font-mono text-neutral-500">
              {quest.responses?.length || 0} responses
            </span>
            <span className="text-[11px] font-mono text-neutral-600">
              {formatTime(quest.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
