"use client";

import { useState } from 'react';
import { QuestResponse, getStatusStyle, formatTime } from './types';

interface ResponseCardProps {
  response: QuestResponse;
  onEdit?: (responseId: string, content: string) => Promise<void>;
}

export default function ResponseCard({ response, onEdit }: ResponseCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(response.content);
  const [saving, setSaving] = useState(false);

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
    <div className="bg-[#0a0a0e] border-2 border-white/[0.08] hover:border-white/[0.15] transition-colors font-mono">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider border-2 ${getStatusStyle(response.status)}`}>
            {response.status}
          </span>
          <span className="text-[12px] text-white/25 truncate font-bold">
            QID:{response.quest_id.slice(0, 12)}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {(response as any).edited_at && (
            <span className="text-[10px] text-white/20 uppercase font-bold">[edited]</span>
          )}
          <span className="text-[11px] text-white/25 font-bold">
            {formatTime(response.created_at)}
          </span>
        </div>
      </div>
      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/[0.1] text-[14px] text-white/80 placeholder-white/15 focus:outline-none focus:border-blue-500/50 transition-colors resize-none h-32 font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editContent.trim()}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-white/10 disabled:text-white/20 text-black text-[11px] font-extrabold uppercase tracking-wider transition-colors"
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditContent(response.content); }}
                className="px-5 py-2 border-2 border-white/[0.12] text-white/40 hover:text-white/60 text-[11px] font-extrabold uppercase tracking-wider transition-colors hover:bg-white/[0.03]"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[14px] text-white/55 leading-relaxed font-medium">{response.content}</p>
            {response.status === 'approved' && (response as any).payment_hash && (
              <div className="mt-3 px-3 py-2 border border-green-500/20 bg-green-500/5">
                <span className="text-[9px] text-green-400/60 uppercase tracking-wider font-bold">TX HASH</span>
                <div className="text-[11px] text-green-400/80 mt-0.5 break-all font-mono">{(response as any).payment_hash}</div>
              </div>
            )}
            {onEdit && response.status === 'pending' && (
              <button
                onClick={() => setEditing(true)}
                className="mt-3 px-4 py-1.5 border-2 border-white/[0.1] text-white/35 hover:text-white/60 text-[11px] font-extrabold uppercase tracking-wider transition-colors hover:bg-white/[0.03]"
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
