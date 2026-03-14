"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { userContext } from '@/context/UserContext';
import { Quest, QuestResponse, getStatusStyle, formatTime } from '../types';
import { getFreshToken } from '@/utils/tokenUtils';
import { toast } from 'react-toastify';
import { text2color, colorWithOpacity } from '@/utils';

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
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Quest editing state
  const [editingQuest, setEditingQuest] = useState(false);
  const [questEditForm, setQuestEditForm] = useState({ title: '', description: '', reward: 0, tags: '' });
  const [questEditSubmitting, setQuestEditSubmitting] = useState(false);

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

  const startEditingQuest = () => {
    if (!quest) return;
    setQuestEditForm({
      title: quest.title,
      description: quest.description,
      reward: quest.reward,
      tags: quest.tags?.join(', ') || '',
    });
    setEditingQuest(true);
  };

  const handleEditQuest = async () => {
    if (!questEditForm.title.trim() || !quest || !user?.key) return;
    setQuestEditSubmitting(true);
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        toast.error('Failed to get authentication token. Please try signing in again.');
        setQuestEditSubmitting(false);
        return;
      }

      const tags = questEditForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      await client!.call('quests/edit_quest', {
        quest_id: quest.id,
        title: questEditForm.title,
        description: questEditForm.description,
        reward: questEditForm.reward,
        tags,
        token: freshToken,
      });
      toast.success('Quest updated!');
      setEditingQuest(false);
      fetchQuest();
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        toast.error(`Failed to edit quest: ${errorMsg}`);
      }
    }
    setQuestEditSubmitting(false);
  };

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

  const handleEditResponse = async (responseId: string) => {
    if (!editContent.trim() || !user?.key) return;
    setEditSubmitting(true);
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        toast.error('Failed to get authentication token. Please try signing in again.');
        setEditSubmitting(false);
        return;
      }
      await client!.call('quests/edit_response', {
        response_id: responseId,
        content: editContent,
        token: freshToken,
      });
      toast.success('Response updated!');
      setEditingResponseId(null);
      setEditContent('');
      fetchQuest();
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        toast.error(`Failed to edit response: ${errorMsg}`);
      }
    }
    setEditSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden font-mono" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div
          className="fixed inset-0 pointer-events-none z-10 opacity-0 dark:opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-8 z-20">
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3">
              <span className="animate-pulse" style={{ color: 'rgb(59 130 246)' }}>_</span>
              <span className="text-[13px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>LOADING QUEST...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quest) {
    return (
      <div className="min-h-screen relative overflow-hidden font-mono" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div
          className="fixed inset-0 pointer-events-none z-10 opacity-0 dark:opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-8 z-20">
          <button
            onClick={() => router.push('/quests')}
            className="flex items-center gap-2 text-[12px] font-extrabold transition-colors mb-8 uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            &lt;-- BACK TO QUESTS
          </button>
          <div className="flex flex-col items-center justify-center py-20" style={{ backgroundColor: 'var(--bg-secondary)', border: '4px solid var(--border-color)' }}>
            <span className="text-[13px] mb-2 font-extrabold" style={{ color: 'rgb(239 68 68)' }}>[ERR]</span>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>{error || 'Quest not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = user?.key === quest.creator;
  const userResponse = user?.key ? responses.find(r => r.responder === user.key) : null;
  const canRespond = quest.status === 'open' && user?.key && !userResponse;
  const canEditQuest = isCreator && quest.status === 'open';
  const questColor = text2color(quest.id + quest.title);

  return (
    <div className="min-h-screen relative overflow-hidden font-mono" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Scanline overlay - dark mode only */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-0 dark:opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-8 z-20">

        {/* Back button */}
        <button
          onClick={() => router.push('/quests')}
          className="flex items-center gap-2 px-4 py-2.5 text-[12px] font-extrabold transition-all mb-2 uppercase tracking-wider"
          style={{
            color: 'var(--text-secondary)',
            border: '4px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          &larr; BACK TO QUESTS
        </button>

        {/* Quest header */}
        <div
          className="mb-px relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: `4px solid ${colorWithOpacity(questColor, 0.4)}`,
            boxShadow: `0 0 25px ${colorWithOpacity(questColor, 0.1)}`,
          }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: questColor }} />
          <div className="px-5 py-3 pl-6 flex items-center justify-between" style={{ borderBottom: `1px solid ${colorWithOpacity(questColor, 0.15)}` }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold" style={{ color: questColor }}>[QST]</span>
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>ID:{quest.id}</span>
            </div>
            <div className="flex items-center gap-2">
              {(quest as any).edited_at && (
                <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>[edited]</span>
              )}
              {canEditQuest && !editingQuest && (
                <button
                  onClick={startEditingQuest}
                  className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition-colors"
                  style={{
                    border: '4px solid rgb(34 211 238 / 0.3)',
                    color: 'rgb(34 211 238)',
                  }}
                >
                  EDIT QUEST
                </button>
              )}
            </div>
          </div>

          {editingQuest ? (
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <input
                  value={questEditForm.title}
                  onChange={e => setQuestEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 text-[14px] focus:outline-none transition-colors font-mono"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '4px solid rgb(34 211 238 / 0.3)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  value={questEditForm.description}
                  onChange={e => setQuestEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 text-[14px] focus:outline-none transition-colors resize-none h-32 font-mono"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '4px solid rgb(34 211 238 / 0.3)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Reward (USDC)</label>
                  <input
                    type="number"
                    value={questEditForm.reward}
                    onChange={e => setQuestEditForm(f => ({ ...f, reward: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 text-[14px] focus:outline-none transition-colors font-mono"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '4px solid rgb(34 211 238 / 0.3)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tags (comma sep)</label>
                  <input
                    value={questEditForm.tags}
                    onChange={e => setQuestEditForm(f => ({ ...f, tags: e.target.value }))}
                    className="w-full px-4 py-2.5 text-[14px] focus:outline-none transition-colors font-mono"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '4px solid rgb(34 211 238 / 0.3)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="tag1, tag2"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleEditQuest}
                  disabled={questEditSubmitting || !questEditForm.title.trim()}
                  className="px-5 py-2 text-white text-[11px] font-extrabold uppercase tracking-wider transition-colors"
                  style={{
                    backgroundColor: 'rgb(34 211 238)',
                    opacity: (questEditSubmitting || !questEditForm.title.trim()) ? 0.5 : 1,
                  }}
                >
                  {questEditSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button
                  onClick={() => setEditingQuest(false)}
                  className="px-5 py-2 text-[11px] font-extrabold uppercase tracking-wider transition-colors"
                  style={{
                    border: '4px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider border-4 ${getStatusStyle(quest.status)}`}>
                  {quest.status.replace('_', ' ')}
                </span>
                <span className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
                  {formatTime(quest.created_at)}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: questColor }}>{quest.title}</h1>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-3 gap-px mb-px" style={{ backgroundColor: 'var(--border-color)' }}>
          <div className="px-5 py-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-[10px] uppercase tracking-[0.2em] mb-1 font-extrabold" style={{ color: 'var(--text-tertiary)' }}>REWARD</div>
            <div className="text-2xl font-extrabold" style={{ color: 'rgb(16 185 129)' }}>{quest.reward.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgb(16 185 129 / 0.5)' }}>USDC</div>
          </div>
          <div className="px-5 py-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-[10px] uppercase tracking-[0.2em] mb-1 font-extrabold" style={{ color: 'var(--text-tertiary)' }}>RESPONSES</div>
            <div className="text-2xl font-extrabold" style={{ color: 'rgb(59 130 246)' }}>{responses.length}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgb(59 130 246 / 0.5)' }}>TOTAL</div>
          </div>
          <div className="px-5 py-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-[10px] uppercase tracking-[0.2em] mb-1 font-extrabold" style={{ color: 'var(--text-tertiary)' }}>CREATOR</div>
            <div className="text-[13px] truncate mt-1 font-bold" style={{ color: 'var(--text-secondary)' }}>{quest.creator.length > 20 ? `${quest.creator.slice(0, 8)}...${quest.creator.slice(-6)}` : quest.creator}</div>
          </div>
        </div>

        {/* Description */}
        {!editingQuest && (
          <div className="mb-px" style={{ backgroundColor: 'var(--bg-secondary)', border: '4px solid var(--border-color)' }}>
            <div className="px-5 py-2.5 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>Description</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium" style={{ color: 'var(--text-primary)' }}>{quest.description}</p>
            </div>
          </div>
        )}

        {/* Tags */}
        {!editingQuest && quest.tags && quest.tags.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {quest.tags.map((tag, i) => {
              const tagColor = text2color(tag);
              return (
                <span
                  key={i}
                  className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider"
                  style={{
                    color: tagColor,
                    border: `4px solid ${colorWithOpacity(tagColor, 0.3)}`,
                    backgroundColor: colorWithOpacity(tagColor, 0.08),
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Submit Response */}
        {quest.status === 'open' && !user?.key && (
          <div className="px-5 py-3 mb-px" style={{ backgroundColor: 'var(--bg-secondary)', border: '4px solid var(--border-color)' }}>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>Sign in to respond to this quest.</p>
          </div>
        )}
        {canRespond && (
          <div className="mb-2" style={{ backgroundColor: 'var(--bg-secondary)', border: '4px solid var(--border-color)' }}>
            <div className="px-5 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.15em]" style={{ color: 'rgb(16 185 129)' }}>&gt;_</span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.15em]" style={{ color: 'var(--text-secondary)' }}>Submit a Response</span>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={responseContent}
                onChange={e => setResponseContent(e.target.value)}
                className="w-full px-4 py-3 text-[14px] focus:outline-none transition-colors resize-none h-32 font-mono"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '4px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Describe your solution or deliverable..."
              />
              <button
                onClick={handleSubmitResponse}
                disabled={submitting || !responseContent.trim()}
                className="px-5 py-2 text-white text-[12px] font-extrabold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: 'rgb(59 130 246)',
                  opacity: (submitting || !responseContent.trim()) ? 0.5 : 1,
                }}
              >
                {submitting ? 'SUBMITTING...' : 'SUBMIT RESPONSE >'}
              </button>
            </div>
          </div>
        )}
        {userResponse && quest.status === 'open' && (
          <div className="mb-2" style={{ backgroundColor: 'var(--bg-secondary)', border: '4px solid rgb(59 130 246 / 0.3)' }}>
            <div className="px-5 py-3 flex items-center gap-2">
              <span className="text-[11px] font-extrabold" style={{ color: 'rgb(59 130 246)' }}>[RSP]</span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.15em]" style={{ color: 'var(--text-secondary)' }}>You already responded to this quest</span>
              <span className={`ml-auto px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider border-4 ${getStatusStyle(userResponse.status)}`}>
                {userResponse.status}
              </span>
            </div>
          </div>
        )}

        {/* Responses list */}
        {responses.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>[{responses.length}]</span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
                Responses
              </span>
            </div>
            <div className="space-y-3">
              {[...responses].sort((a, b) => {
                const aIsMe = user?.key === a.responder ? -1 : 0;
                const bIsMe = user?.key === b.responder ? -1 : 0;
                return aIsMe - bIsMe;
              }).map(response => {
                const rColor = text2color(response.id + response.content.slice(0, 20));
                return (
                <div
                  key={response.id}
                  className="relative overflow-hidden transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `4px solid ${colorWithOpacity(rColor, 0.35)}`,
                    boxShadow: `0 0 15px ${colorWithOpacity(rColor, 0.08)}`,
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: rColor }} />
                  <div
                    className="px-5 py-3 pl-6 flex items-center justify-between"
                    style={{ borderBottom: `1px solid ${colorWithOpacity(rColor, 0.15)}`, backgroundColor: colorWithOpacity(rColor, 0.03) }}
                  >
                    <span className="text-[12px] font-bold" style={{ color: rColor }}>
                      {response.responder.length > 20
                        ? `${response.responder.slice(0, 8)}...${response.responder.slice(-6)}`
                        : response.responder}
                    </span>
                    <div className="flex items-center gap-2.5">
                      {(response as any).edited_at && (
                        <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>[edited]</span>
                      )}
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
                        {formatTime(response.created_at)}
                      </span>
                      <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider border-4 ${getStatusStyle(response.status)}`}>
                        {response.status}
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-4 pl-6">
                    {editingResponseId === response.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="w-full px-4 py-3 text-[14px] focus:outline-none transition-colors resize-none h-32 font-mono"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: `4px solid ${colorWithOpacity(rColor, 0.3)}`,
                            color: 'var(--text-primary)',
                          }}
                          placeholder="Update your response..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditResponse(response.id)}
                            disabled={editSubmitting || !editContent.trim()}
                            className="px-5 py-2 text-white text-[11px] font-extrabold uppercase tracking-wider transition-colors disabled:opacity-40"
                            style={{ backgroundColor: rColor }}
                          >
                            {editSubmitting ? 'SAVING...' : 'SAVE EDIT'}
                          </button>
                          <button
                            onClick={() => { setEditingResponseId(null); setEditContent(''); }}
                            className="px-5 py-2 text-[11px] font-extrabold uppercase tracking-wider transition-colors"
                            style={{ border: `4px solid ${colorWithOpacity(rColor, 0.3)}`, color: 'var(--text-secondary)' }}
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[14px] leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>{response.content}</p>
                        {response.status === 'approved' && (response as any).payment_hash && (
                          <div className="mt-3 px-3 py-2" style={{ border: `4px solid rgb(16 185 129 / 0.3)`, backgroundColor: 'rgb(16 185 129 / 0.05)' }}>
                            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'rgb(16 185 129)' }}>TX HASH</span>
                            <div className="text-[11px] mt-0.5 break-all font-mono" style={{ color: 'rgb(16 185 129 / 0.8)' }}>{(response as any).payment_hash}</div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {user?.key === response.responder && response.status === 'pending' && (
                            <button
                              onClick={() => { setEditingResponseId(response.id); setEditContent(response.content); }}
                              className="px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-all"
                              style={{ border: `4px solid ${colorWithOpacity(rColor, 0.4)}`, color: rColor }}
                            >
                              EDIT
                            </button>
                          )}
                          {isCreator && response.status === 'pending' && (
                            <button
                              onClick={() => handleApproveResponse(response.id)}
                              className="px-4 py-1.5 text-white text-[11px] font-extrabold uppercase tracking-wider transition-colors"
                              style={{ backgroundColor: 'rgb(16 185 129)' }}
                            >
                              APPROVE & PAY
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {responses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16" style={{ backgroundColor: 'var(--bg-secondary)', border: '4px solid var(--border-color)' }}>
            <span className="text-[13px] mb-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>---</span>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>No responses yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
