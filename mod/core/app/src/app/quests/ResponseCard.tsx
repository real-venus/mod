"use client";

import { QuestResponse, getStatusStyle, formatTime } from './types';

interface ResponseCardProps {
  response: QuestResponse;
}

export default function ResponseCard({ response }: ResponseCardProps) {
  return (
    <div className="border border-neutral-800 bg-neutral-900">
      <div className="px-4 py-3 border-b border-neutral-800/60 flex items-center justify-between">
        <span className="text-[12px] font-mono text-neutral-400">
          Quest: {response.quest_id.slice(0, 12)}...
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
      </div>
    </div>
  );
}
