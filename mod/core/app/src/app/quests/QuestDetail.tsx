"use client";

import { useState } from 'react';
import { Quest, QuestResponse, getStatusStyle, formatTime } from './types';

interface QuestDetailProps {
  quest: Quest;
  responses: QuestResponse[];
  userKey?: string;
  onClose: () => void;
  onRespond: (questId: string, content: string) => Promise<void>;
  onApprove: (questId: string, responseId: string) => Promise<void>;
}

export default function QuestDetail({
  quest,
  responses,
  userKey,
  onClose,
  onRespond,
  onApprove,
}: QuestDetailProps) {
  const [responseContent, setResponseContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitResponse = async () => {
    if (!responseContent.trim()) return;
    setSubmitting(true);
    await onRespond(quest.id, responseContent);
    setResponseContent('');
    setSubmitting(false);
  };

  const isCreator = userKey === quest.creator;
  const canRespond = quest.status === 'open' && userKey && !isCreator;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className={`shrink-0 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider border ${getStatusStyle(quest.status)}`}>
                {quest.status}
              </span>
              <span className="text-[11px] font-mono text-neutral-500">
                {formatTime(quest.created_at)}
              </span>
            </div>
            <h2 className="text-xl font-medium text-neutral-100 tracking-tight">{quest.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Meta row */}
          <div className="flex gap-4">
            <div className="flex-1 bg-neutral-800/50 border border-neutral-800 px-4 py-3">
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">Reward</div>
              <div className="text-2xl font-mono font-medium text-emerald-400">{quest.reward}</div>
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">tokens</div>
            </div>
            <div className="flex-1 bg-neutral-800/50 border border-neutral-800 px-4 py-3">
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">Responses</div>
              <div className="text-2xl font-mono font-medium text-purple-400">{responses.length}</div>
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">submitted</div>
            </div>
            <div className="flex-1 bg-neutral-800/50 border border-neutral-800 px-4 py-3">
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">Creator</div>
              <div className="text-[13px] font-mono text-neutral-300 truncate">{quest.creator}</div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-2">Description</div>
            <p className="text-[14px] text-neutral-300 leading-relaxed whitespace-pre-wrap">{quest.description}</p>
          </div>

          {/* Tags */}
          {quest.tags && quest.tags.length > 0 && (
            <div>
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-2">Tags</div>
              <div className="flex gap-1.5 flex-wrap">
                {quest.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 text-[11px] font-mono text-purple-400/80 bg-purple-500/8 border border-purple-500/15">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submit Response */}
          {canRespond && (
            <div className="border border-neutral-800 bg-neutral-800/30">
              <div className="px-4 py-3 border-b border-neutral-800">
                <span className="text-[12px] font-mono text-neutral-400 uppercase tracking-wider">Submit a response</span>
              </div>
              <div className="p-4 space-y-3">
                <textarea
                  value={responseContent}
                  onChange={e => setResponseContent(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 text-[14px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none h-24 font-mono"
                  placeholder="Describe your solution or deliverable..."
                />
                <button
                  onClick={handleSubmitResponse}
                  disabled={submitting || !responseContent.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-[13px] font-medium tracking-wide transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </div>
          )}

          {/* Responses list */}
          {responses.length > 0 && (
            <div>
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-3">
                Responses ({responses.length})
              </div>
              <div className="space-y-2">
                {responses.map(response => (
                  <div key={response.id} className="border border-neutral-800 bg-neutral-800/20">
                    <div className="px-4 py-3 border-b border-neutral-800/60 flex items-center justify-between">
                      <span className="text-[12px] font-mono text-neutral-400">
                        {response.responder.slice(0, 16)}...
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-neutral-500">
                          {formatTime(response.created_at)}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${getStatusStyle(response.status)}`}>
                          {response.status}
                        </span>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[13px] text-neutral-300 leading-relaxed">{response.content}</p>
                      {isCreator && response.status === 'pending' && (
                        <button
                          onClick={() => onApprove(quest.id, response.id)}
                          className="mt-3 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-medium tracking-wide transition-colors"
                        >
                          Approve & Pay Reward
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
