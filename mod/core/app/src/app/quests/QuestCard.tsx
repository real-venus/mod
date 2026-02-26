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
      className="group block rounded-2xl transition-all duration-200 font-mono relative overflow-hidden"
      style={{
        border: `2px solid ${colorWithOpacity(cardColor, 0.45)}`,
        backgroundColor: 'var(--bg-secondary)',
        boxShadow: `0 0 25px ${colorWithOpacity(cardColor, 0.12)}, inset 0 0 25px ${colorWithOpacity(cardColor, 0.06)}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = cardColor;
        e.currentTarget.style.boxShadow = `0 0 35px ${colorWithOpacity(cardColor, 0.25)}, inset 0 0 30px ${colorWithOpacity(cardColor, 0.1)}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = colorWithOpacity(cardColor, 0.45);
        e.currentTarget.style.boxShadow = `0 0 25px ${colorWithOpacity(cardColor, 0.12)}, inset 0 0 25px ${colorWithOpacity(cardColor, 0.06)}`;
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ backgroundColor: cardColor }}
      />

      <div className="px-6 py-5 pl-7">
        {/* Top row: status + meta */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-[13px] font-extrabold uppercase tracking-wider border-2 ${getStatusStyle(quest.status)}`}>
              {quest.status.replace('_', ' ')}
            </span>
            <span className="text-[14px] font-bold" style={{ color: 'var(--text-tertiary)' }}>{formatTime(quest.created_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            {isCreator && <span className="text-[13px] font-extrabold uppercase" style={{ color: colorWithOpacity(cardColor, 0.8) }}>[YOU]</span>}
            <span className="text-[14px] font-bold" style={{ color: 'var(--text-tertiary)' }}>{quest.responses?.length || 0} resp</span>
          </div>
        </div>

        {/* Title */}
        <h3
          className="text-[20px] font-extrabold leading-tight mb-2 transition-colors truncate group-hover:brightness-110"
          style={{ color: cardColor }}
        >
          {quest.title}
        </h3>

        {/* Description - single line */}
        <p className="text-[15px] leading-snug line-clamp-1 mb-4 font-medium" style={{ color: 'var(--text-secondary)' }}>
          {quest.description}
        </p>

        {/* Bottom row: tags + reward */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            {quest.tags && quest.tags.slice(0, 3).map((tag, i) => {
              const tagColor = text2color(tag);
              return (
                <span
                  key={i}
                  className="px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wider shrink-0 border-2"
                  style={{
                    color: tagColor,
                    borderColor: colorWithOpacity(tagColor, 0.3),
                    backgroundColor: colorWithOpacity(tagColor, 0.1),
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className="text-[22px] font-extrabold text-green-500 dark:text-green-400">
              {quest.reward.toLocaleString()} <span className="text-[13px] text-green-500/60 dark:text-green-400/60 uppercase font-extrabold">USDC</span>
            </span>
            {canRespond && (
              <span
                className="px-4 py-2 text-[13px] font-extrabold uppercase tracking-wider text-white"
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
