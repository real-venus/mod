"use client";

import { useState } from 'react';
import { QuestResponse, getStatusStyle, formatTime } from './types';
import { text2color, colorWithOpacity } from '@/utils';

interface ResponseCardProps {
  response: QuestResponse;
  onEdit?: (responseId: string, content: string) => Promise<void>;
}

export default function ResponseCard({ response, onEdit }: ResponseCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(response.content || '');
  const [saving, setSaving] = useState(false);

  const cardColor = text2color(response.id + (response.content || '').slice(0, 20));

  const handleSave = async () => {
    if (!editContent.trim() || !onEdit) return;
    setSaving(true);
    try {
      await onEdit(response.id, editContent);
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  return (
    <div
      className="font-mono mb-3 relative overflow-hidden transition-all duration-200"
      style={{
        border: `4px solid ${colorWithOpacity(cardColor, 0.4)}`,
        backgroundColor: 'var(--bg-secondary)',
        boxShadow: `0 0 20px ${colorWithOpacity(cardColor, 0.1)}, inset 0 0 20px ${colorWithOpacity(cardColor, 0.05)}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = colorWithOpacity(cardColor, 0.7);
        e.currentTarget.style.boxShadow = `0 0 30px ${colorWithOpacity(cardColor, 0.2)}, inset 0 0 25px ${colorWithOpacity(cardColor, 0.08)}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = colorWithOpacity(cardColor, 0.4);
        e.currentTarget.style.boxShadow = `0 0 20px ${colorWithOpacity(cardColor, 0.1)}, inset 0 0 20px ${colorWithOpacity(cardColor, 0.05)}`;
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: cardColor }}
      />

      {/* Header */}
      <div
        className="px-5 py-4 pl-7 border-b flex items-center justify-between gap-3"
        style={{
          borderColor: colorWithOpacity(cardColor, 0.15),
          backgroundColor: colorWithOpacity(cardColor, 0.04),
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wider border-4 ${getStatusStyle(response.status)}`}>
            {response.status}
          </span>
          <span
            className="text-[14px] truncate font-extrabold"
            style={{ color: cardColor }}
          >
            QID:{response.quest_id.slice(0, 12)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {(response as any).edited_at && (
            <span className="text-[12px] uppercase font-extrabold" style={{ color: 'var(--text-tertiary)' }}>[edited]</span>
          )}
          <span className="text-[13px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
            {formatTime(response.created_at)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5 pl-7">
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-4 py-3 text-[15px] focus:outline-none transition-colors resize-none h-32 font-mono font-bold"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: `4px solid ${colorWithOpacity(cardColor, 0.3)}`,
                color: 'var(--text-primary)',
              }}
              placeholder="Edit your response..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editContent.trim()}
                className="px-5 py-2.5 text-white text-[13px] font-extrabold uppercase tracking-wider transition-colors disabled:opacity-30"
                style={{ backgroundColor: cardColor }}
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditContent(response.content || ''); }}
                className="px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wider transition-colors"
                style={{
                  border: `4px solid ${colorWithOpacity(cardColor, 0.3)}`,
                  color: 'var(--text-secondary)',
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <>
            <p
              className="text-[15px] leading-relaxed font-bold"
              style={{ color: 'var(--text-primary)', opacity: 0.85 }}
            >
              {response.content || ''}
            </p>
            {response.status === 'approved' && (response as any).payment_hash && (
              <div
                className="mt-3 px-4 py-2.5"
                style={{
                  border: `4px solid rgb(16 185 129 / 0.3)`,
                  backgroundColor: 'rgb(16 185 129 / 0.05)',
                }}
              >
                <span className="text-[11px] uppercase tracking-wider font-extrabold" style={{ color: 'rgb(16 185 129)' }}>TX HASH</span>
                <div className="text-[13px] mt-0.5 break-all font-mono font-bold" style={{ color: 'rgb(16 185 129 / 0.9)' }}>{(response as any).payment_hash}</div>
              </div>
            )}
            {onEdit && response.status === 'pending' && (
              <button
                onClick={() => setEditing(true)}
                className="mt-3 px-5 py-2 text-[13px] font-extrabold uppercase tracking-wider transition-all"
                style={{
                  border: `4px solid ${colorWithOpacity(cardColor, 0.4)}`,
                  color: cardColor,
                }}
              >
                EDIT
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
