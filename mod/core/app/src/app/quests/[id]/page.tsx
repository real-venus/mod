"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { userContext } from '@/context/UserContext';
import { Quest, QuestResponse, getStatusStyle, formatTime } from '../types';
import { getFreshToken } from '@/utils/tokenUtils';
import { toast } from 'react-toastify';

export default function QuestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { client, user } = userContext();

  const [quest, setQuest] = useState<Quest | null>(null);
  const [responses, setResponses] = useState<QuestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseContent, setResponseContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuest = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setError(null);
    try {
      const questResult = await client.call('quests/get_quest', { quest_id: id });
      const questData = questResult?.data ?? questResult ?? null;
      if (!questData) {
        setError('Quest not found');
        setLoading(false);
        return;
      }
      setQuest(questData);

      const responsesResult = await client.call('quests/get_responses', { quest_id: id });
      setResponses(Array.isArray(responsesResult) ? responsesResult : responsesResult?.data || []);
    } catch (e: any) {
      console.error('Failed to fetch quest:', e);
      setError('Failed to load quest');
    }
    setLoading(false);
  }, [client, id]);

  useEffect(() => {
    fetchQuest();
  }, [fetchQuest]);

  const handleSubmitResponse = async () => {
    if (!responseContent.trim() || !quest || !user?.key) return;
    setSubmitting(true);
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        toast.error('Failed to get authentication token. Please try signing in again.');
        setSubmitting(false);
        return;
      }

      await client!.call('quests/respond', {
        quest_id: quest.id,
        content: responseContent,
        token: freshToken,
      });
      toast.success('Response submitted successfully!');
      setResponseContent('');
      fetchQuest();
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        toast.error(`Failed to submit response: ${errorMsg}`);
      }
    }
    setSubmitting(false);
  };

  const handleApproveResponse = async (responseId: string) => {
    if (!user?.key || !quest) return;
    if (!confirm('Are you sure you want to approve this response? This will transfer the reward.')) return;
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        toast.error('Failed to get authentication token. Please try signing in again.');
        return;
      }

      await client!.call('quests/approve', {
        quest_id: quest.id,
        response_id: responseId,
        token: freshToken,
      });
      toast.success('Response approved! Reward sent.');
      fetchQuest();
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        toast.error(`Failed to approve response: ${errorMsg}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[13px] font-mono text-neutral-500">Loading quest...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quest) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <button
            onClick={() => router.push('/quests')}
            className="flex items-center gap-2 text-[13px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Quests
          </button>
          <div className="flex items-center justify-center py-20">
            <p className="text-[13px] font-mono text-neutral-500">{error || 'Quest not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = user?.key === quest.creator;
  const canRespond = quest.status === 'open' && user?.key;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Back button */}
        <button
          onClick={() => router.push('/quests')}
          className="flex items-center gap-2 text-[13px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Quests
        </button>

        {/* Quest header */}
        <div className="border border-neutral-800 bg-neutral-900 mb-6">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <span className={`shrink-0 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider border ${getStatusStyle(quest.status)}`}>
                {quest.status}
              </span>
              <span className="text-[11px] font-mono text-neutral-600">
                {formatTime(quest.created_at)}
              </span>
            </div>
            <h1 className="text-xl font-medium text-neutral-100 tracking-tight mb-1">{quest.title}</h1>
            <span className="text-[11px] font-mono text-neutral-600">{quest.id}</span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex gap-[1px] bg-neutral-800 border border-neutral-800 mb-6">
          <div className="flex-1 bg-neutral-900 px-4 py-3">
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">Reward</div>
            <div className="text-2xl font-mono font-medium text-emerald-400">${quest.reward}</div>
          </div>
          <div className="flex-1 bg-neutral-900 px-4 py-3">
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">Responses</div>
            <div className="text-2xl font-mono font-medium text-purple-400">{responses.length}</div>
          </div>
          <div className="flex-1 bg-neutral-900 px-4 py-3">
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">Creator</div>
            <div className="text-[13px] font-mono text-neutral-300 truncate">{quest.creator}</div>
          </div>
        </div>

        {/* Description */}
        <div className="border border-neutral-800 bg-neutral-900 mb-6">
          <div className="px-6 py-4 border-b border-neutral-800">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">Description</span>
          </div>
          <div className="px-6 py-4">
            <p className="text-[14px] text-neutral-300 leading-relaxed whitespace-pre-wrap">{quest.description}</p>
          </div>
        </div>

        {/* Tags */}
        {quest.tags && quest.tags.length > 0 && (
          <div className="mb-6">
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
        {quest.status === 'open' && !user?.key && (
          <div className="border border-neutral-800 bg-neutral-800/30 px-4 py-4 mb-6">
            <p className="text-[13px] font-mono text-neutral-500">Sign in to respond to this quest.</p>
          </div>
        )}
        {canRespond && (
          <div className="border border-neutral-800 bg-neutral-900 mb-6">
            <div className="px-6 py-3 border-b border-neutral-800">
              <span className="text-[12px] font-mono text-neutral-400 uppercase tracking-wider">Submit a response</span>
            </div>
            <div className="p-6 space-y-3">
              <textarea
                value={responseContent}
                onChange={e => setResponseContent(e.target.value)}
                className="w-full px-3 py-2.5 bg-black border border-neutral-700 text-[14px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none h-32 font-mono"
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
            <div className="space-y-[1px] bg-neutral-800 border border-neutral-800">
              {responses.map(response => (
                <div key={response.id} className="bg-neutral-900">
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
                        onClick={() => handleApproveResponse(response.id)}
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

        {responses.length === 0 && (
          <div className="flex items-center justify-center py-12 border border-neutral-800 bg-neutral-900">
            <p className="text-[13px] font-mono text-neutral-500">No responses yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
