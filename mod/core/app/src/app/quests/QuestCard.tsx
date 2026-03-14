"use client";

import Link from 'next/link';
import { Quest, getStatusStyle, formatTime } from './types';
import { text2color, colorWithOpacity } from '@/utils';

export default function QuestCard({ quest, userKey }: { quest: Quest; userKey?: string }) {
  const canRespond = quest.status === 'open' && userKey;
  const isCreator = userKey === quest.creator;
  const cardColor = text2color(quest.id + quest.title);

  return (
    <Link
      href={`/quests/${quest.id}`}
      className="group block transition-all duration-300 font-mono relative overflow-hidden border-4"
      style={{
        borderColor: colorWithOpacity(cardColor, 0.25),
        backgroundColor: 'var(--bg-secondary)',
        boxShadow: `0 4px 24px ${colorWithOpacity(cardColor, 0.08)}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = colorWithOpacity(cardColor, 0.5);
        e.currentTarget.style.boxShadow = `0 8px 32px ${colorWithOpacity(cardColor, 0.15)}`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = colorWithOpacity(cardColor, 0.25);
        e.currentTarget.style.boxShadow = `0 4px 24px ${colorWithOpacity(cardColor, 0.08)}`;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${cardColor} 0%, transparent 100%)`,
        }}
      />

      <div className="relative px-7 py-6">
        {/* Top row: status + meta */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-full ${getStatusStyle(quest.status)}`}>
              {quest.status.replace('_', ' ')}
            </span>
            <span className="text-[13px] font-medium opacity-50">{formatTime(quest.created_at)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            {isCreator && <span className="text-[11px] font-extrabold uppercase px-2 py-1 rounded-full" style={{ color: cardColor, backgroundColor: colorWithOpacity(cardColor, 0.1) }}>YOU</span>}
            <span className="text-[13px] font-medium opacity-50">{quest.responses?.length || 0} resp</span>
          </div>
        </div>

        {/* Title */}
        <h3
          className="text-[18px] font-bold leading-tight mb-2.5 transition-colors truncate"
          style={{ color: cardColor }}
        >
          {quest.title}
        </h3>

        {/* Description - single line */}
        <p className="text-[14px] leading-relaxed line-clamp-1 mb-5 font-normal opacity-60">
          {quest.description}
        </p>

        {/* Bottom row: tags + reward */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {quest.tags && quest.tags.slice(0, 3).map((tag, i) => {
              const tagColor = text2color(tag);
              return (
                <span
                  key={i}
                  className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shrink-0"
                  style={{
                    color: tagColor,
                    backgroundColor: colorWithOpacity(tagColor, 0.1),
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5 shrink-0 ml-2">
            <span className="text-[20px] font-bold text-green-500 dark:text-green-400">
              {quest.reward.toLocaleString()} <span className="text-[11px] opacity-60 uppercase font-bold">USDC</span>
            </span>
            {canRespond && (
              <span
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white rounded-full"
                style={{ backgroundColor: cardColor }}
              >
                RESPOND
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
