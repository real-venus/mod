"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { userContext } from '@/context/UserContext';
import { Quest, QuestResponse, QuestTab, LeaderboardEntry, QuestCreatorEntry } from './types';
import QuestCard from './QuestCard';
import CreateQuestForm from './CreateQuestForm';
import StatsBar from './StatsBar';
import ResponseCard from './ResponseCard';
import Leaderboard from './Leaderboard';
import { getFreshToken } from '@/utils/tokenUtils';
import { toast } from 'react-toastify';

const TABS: { key: QuestTab; label: string; prefix: string }[] = [
  { key: 'quests', label: 'QUESTS', prefix: 'QST' },
  { key: 'responses', label: 'RESPONSES', prefix: 'RSP' },
  { key: 'stats', label: 'STATS', prefix: 'STS' },
  { key: 'leaderboard', label: 'RANKS', prefix: 'LDR' },
  { key: 'create', label: 'CREATE', prefix: 'NEW' },
  { key: 'docs', label: 'API DOCS', prefix: 'DOC' },
];

export default function QuestsPage() {
  const { client, user } = userContext();
  const [activeTab, setActiveTab] = useState<QuestTab>('quests');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [myResponses, setMyResponses] = useState<QuestResponse[]>([]);
  const [allResponses, setAllResponses] = useState<QuestResponse[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [questerBoard, setQuesterBoard] = useState<QuestCreatorEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [valueFilter, setValueFilter] = useState<string>('all');
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [questSubFilter, setQuestSubFilter] = useState<'mine' | 'all'>('mine');
  const [responseSubFilter, setResponseSubFilter] = useState<'mine' | 'all'>('mine');

  // --- Data fetching ---

  const fetchQuests = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const result = await client.call('quests/quests', {  });
      setQuests(Array.isArray(result) ? result : result?.data || []);
    } catch (e) {
      console.error('Failed to fetch quests:', e);
    }
    setLoading(false);
  }, [client]);

  const fetchMyQuests = useCallback(async () => {
    if (!client || !user?.key) return;
    setLoading(true);
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        console.error('No token available');
        setLoading(false);
        return;
      }
      const result = await client.call('quests/my_quests', { token: freshToken });
      setMyQuests(Array.isArray(result) ? result : result?.data || []);
    } catch (e) {
      console.error('Failed to fetch my quests:', e);
    }
    setLoading(false);
  }, [client, user?.key, user?.wallet_mode]);

  const fetchMyResponses = useCallback(async () => {
    if (!client || !user?.key) return;
    setLoading(true);
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        console.error('No token available');
        setLoading(false);
        return;
      }
      const result = await client.call('quests/my_responses', { token: freshToken });
      setMyResponses(Array.isArray(result) ? result : result?.data || []);
    } catch (e) {
      console.error('Failed to fetch my responses:', e);
    }
    setLoading(false);
  }, [client, user?.key, user?.wallet_mode]);

  const fetchLeaderboard = useCallback(async () => {
    if (!client) return;
    setLeaderboardLoading(true);
    try {
      const result = await client.call('quests/leaderboard', {});
      const data = result?.data || result || {};
      if (data.responders) {
        setLeaderboard(data.responders);
        setQuesterBoard(data.questers || []);
      } else if (Array.isArray(data)) {
        setLeaderboard(data);
        setQuesterBoard([]);
      }
    } catch (e) {
      console.warn('Leaderboard endpoint not available, building from quests data');
      try {
        const allQuests = await client.call('quests/quests', {});
        const questList: Quest[] = Array.isArray(allQuests) ? allQuests : allQuests?.data || [];

        // Build responder leaderboard
        const earnerMap = new Map<string, { total_earned: number; quests_completed: number }>();
        // Build quester leaderboard
        const creatorMap = new Map<string, { quests_created: number; total_reward_posted: number; quests_completed: number; total_responses: number }>();

        for (const q of questList) {
          // Quester stats
          const cKey = q.creator;
          const existing = creatorMap.get(cKey) || { quests_created: 0, total_reward_posted: 0, quests_completed: 0, total_responses: 0 };
          existing.quests_created += 1;
          existing.total_reward_posted += q.reward;
          existing.total_responses += (q.responses?.length || 0);
          if (q.status === 'completed') existing.quests_completed += 1;
          creatorMap.set(cKey, existing);

          // Responder stats
          if (q.status === 'completed' && q.approved_response && q.responses) {
            const approvedResp = q.responses.find((r: any) => r.id === q.approved_response || r.status === 'approved');
            if (approvedResp) {
              const rKey = approvedResp.responder;
              const rExisting = earnerMap.get(rKey) || { total_earned: 0, quests_completed: 0 };
              rExisting.total_earned += q.reward;
              rExisting.quests_completed += 1;
              earnerMap.set(rKey, rExisting);
            }
          }
        }

        const responderEntries: LeaderboardEntry[] = Array.from(earnerMap.entries())
          .map(([responder, d]) => ({ responder, ...d }))
          .sort((a, b) => b.total_earned - a.total_earned);

        const questerEntries: QuestCreatorEntry[] = Array.from(creatorMap.entries())
          .map(([creator, d]) => ({ creator, ...d }))
          .sort((a, b) => b.total_reward_posted - a.total_reward_posted);

        setLeaderboard(responderEntries);
        setQuesterBoard(questerEntries);
      } catch (e2) {
        console.error('Failed to build leaderboard:', e2);
        setLeaderboard([]);
        setQuesterBoard([]);
      }
    }
    setLeaderboardLoading(false);
  }, [client]);

  const fetchStats = useCallback(async () => {
    if (!client) return;
    try {
      const result = await client.call('quests/stats', {});
      setStats(result?.data ?? result ?? null);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [client]);

  useEffect(() => {
    if (activeTab === 'quests') {
      fetchQuests();
      if (user?.key) fetchMyQuests();
    }
  }, [activeTab, fetchQuests, fetchMyQuests, user?.key]);

  const fetchAllResponses = useCallback(async () => {
    if (!client) return;
    try {
      const result = await client.call('quests/quests', {});
      const questList: Quest[] = Array.isArray(result) ? result : result?.data || [];
      const responses: QuestResponse[] = [];
      for (const q of questList) {
        if (q.responses && Array.isArray(q.responses)) {
          for (const r of q.responses) {
            if (!user?.key || r.responder !== user.key) {
              responses.push(r);
            }
          }
        }
      }
      responses.sort((a, b) => b.created_at - a.created_at);
      setAllResponses(responses);
    } catch (e) {
      console.error('Failed to fetch all responses:', e);
    }
  }, [client, user?.key]);

  useEffect(() => {
    if (activeTab === 'responses') {
      if (user?.key) fetchMyResponses();
      fetchAllResponses();
    }
  }, [activeTab, fetchMyResponses, fetchAllResponses, user?.key]);

  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab, fetchLeaderboard]);

  useEffect(() => {
    if (activeTab === 'create' && client && user?.key) {
      client.call('api/get_balances', { address: user.key }).then((result: any) => {
        setUserBalance(result?.MARKET || 0);
      }).catch(() => setUserBalance(null));
    }
  }, [activeTab, client, user?.key]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---

  const handleCreateQuest = async (data: { title: string; description: string; reward: number; tags: string[] }) => {
    if (!user?.key) {
      toast.error('Please sign in to create a quest');
      return;
    }
    setLoading(true);
    try {
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        toast.error('Failed to get authentication token. Please try signing in again.');
        setLoading(false);
        return;
      }

      if (!client) {
        toast.error('Connection not available. Please try again.');
        setLoading(false);
        return;
      }

      const result = await client.call('quests/create_quest', {
        title: data.title,
        description: data.description,
        reward: data.reward,
        token: freshToken,
        tags: data.tags,
      });

      if (result?.success === false || result?.error) {
        const errorMsg = result?.error || 'Unknown error';
        if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
          toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
        } else {
          toast.error(`Failed to create quest: ${errorMsg}`);
        }
      } else if (result?.data || result?.id) {
        toast.success('Quest created successfully!');
        setActiveTab('quests');
        setQuestSubFilter('mine');
      }
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        toast.error(`Failed to create quest: ${errorMsg}`);
      }
    }
    setLoading(false);
  };

  const handleEditResponse = async (responseId: string, content: string) => {
    if (!user?.key) {
      toast.error('Please sign in to edit');
      return;
    }
    const freshToken = await getFreshToken(user.key, user.wallet_mode);
    if (!freshToken) {
      toast.error('Failed to get authentication token. Please try signing in again.');
      return;
    }
    try {
      await client!.call('quests/edit_response', {
        response_id: responseId,
        content,
        token: freshToken,
      });
      toast.success('Response updated!');
      fetchMyResponses();
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        toast.warning('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        toast.error(`Failed to edit response: ${errorMsg}`);
      }
      throw e;
    }
  };

  // --- Client-side search + filters ---
  const applyQuestFilters = useCallback((list: Quest[]) => {
    let result = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(quest =>
        quest.title.toLowerCase().includes(q) ||
        quest.description.toLowerCase().includes(q) ||
        quest.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(quest => quest.status === statusFilter);
    }
    if (valueFilter !== 'all') {
      result = result.filter(quest => {
        switch (valueFilter) {
          case '0-100': return quest.reward <= 100;
          case '100-500': return quest.reward > 100 && quest.reward <= 500;
          case '500-1000': return quest.reward > 500 && quest.reward <= 1000;
          case '1000+': return quest.reward > 1000;
          default: return true;
        }
      });
    }
    return result;
  }, [searchQuery, statusFilter, valueFilter]);

  const filteredQuests = useMemo(() => applyQuestFilters(quests), [quests, applyQuestFilters]);

  const filteredMyQuests = useMemo(() => applyQuestFilters(myQuests), [myQuests, applyQuestFilters]);

  const displayedQuests = useMemo(() => {
    return questSubFilter === 'mine' ? filteredMyQuests : filteredQuests;
  }, [questSubFilter, filteredMyQuests, filteredQuests]);

  const filteredMyResponses = useMemo(() => {
    let result = myResponses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(response => response.content.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter(response => response.status === statusFilter);
    }
    return result;
  }, [myResponses, searchQuery, statusFilter]);

  const filteredAllResponses = useMemo(() => {
    let result = allResponses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(response => response.content.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter(response => response.status === statusFilter);
    }
    return result;
  }, [allResponses, searchQuery, statusFilter]);

  const displayedResponses = useMemo(() => {
    return responseSubFilter === 'mine' ? filteredMyResponses : filteredAllResponses;
  }, [responseSubFilter, filteredMyResponses, filteredAllResponses]);

  // --- Render helpers ---

  const showFilters = activeTab === 'quests' || activeTab === 'responses';

  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center py-20 font-mono border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
      <span className="text-[15px] mb-2 font-extrabold" style={{ color: 'rgb(16 185 129 / 0.5)' }}>[EMPTY]</span>
      <p className="text-[15px] font-bold" style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center py-20 font-mono">
      <div className="flex items-center gap-3">
        <span className="animate-pulse text-lg" style={{ color: 'rgb(16 185 129)' }}>_</span>
        <span className="text-[15px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>LOADING...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden font-mono" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-8">

        {/* Header + Tabs + Create */}
        <div className="mb-6">
          <div className="flex items-end gap-5 pb-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2.5 shrink-0 pb-3">
              <span className="text-[16px] font-extrabold select-none" style={{ color: 'rgb(16 185 129 / 0.6)' }}>&gt;_</span>
              <h1 className="text-[24px] font-extrabold tracking-tight uppercase leading-none" style={{ color: 'var(--text-primary)', textShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>QUESTS</h1>
            </div>
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
              {TABS.filter(t => t.key !== 'create').map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key as QuestTab); setStatusFilter('all'); setValueFilter('all'); setSearchQuery(''); }}
                  className="relative px-4 py-3.5 text-[14px] font-extrabold tracking-wider transition-all whitespace-nowrap shrink-0 uppercase -mb-px"
                  style={{
                    color: activeTab === tab.key ? 'rgb(16 185 129)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab.key ? '2px solid rgb(16 185 129)' : '2px solid transparent',
                    backgroundColor: activeTab === tab.key ? 'rgb(16 185 129 / 0.06)' : 'transparent'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setActiveTab('create'); setStatusFilter('all'); setValueFilter('all'); setSearchQuery(''); }}
              className="shrink-0 px-6 py-2.5 mb-1.5 text-[14px] font-extrabold uppercase tracking-widest transition-all border-4"
              style={{
                backgroundColor: activeTab === 'create' ? 'rgb(16 185 129)' : 'rgb(16 185 129 / 0.15)',
                color: activeTab === 'create' ? '#000' : 'rgb(16 185 129)',
                borderColor: activeTab === 'create' ? 'rgb(16 185 129)' : 'rgb(16 185 129 / 0.5)',
                boxShadow: activeTab === 'create' ? '0 0 20px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              + CREATE QUEST
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        {showFilters && (
          <div className="mb-5 flex flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>&gt;</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="search quests..."
                className="w-full pl-9 pr-4 py-3.5 border-4 text-[15px] font-mono font-bold transition-colors focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors text-[13px] font-extrabold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  [x]
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-3.5 border-4 text-[14px] focus:outline-none transition-colors appearance-none cursor-pointer shrink-0 font-mono uppercase font-extrabold"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              <option value="all">ALL STATUS</option>
              {activeTab === 'responses' ? (
                <>
                  <option value="pending">PENDING</option>
                  <option value="approved">APPROVED</option>
                  <option value="rejected">REJECTED</option>
                </>
              ) : (
                <>
                  <option value="open">OPEN</option>
                  <option value="in_review">IN REVIEW</option>
                  <option value="completed">COMPLETED</option>
                  <option value="cancelled">CANCELLED</option>
                </>
              )}
            </select>
            {activeTab !== 'responses' && (
              <select
                value={valueFilter}
                onChange={e => setValueFilter(e.target.value)}
                className="px-4 py-3.5 border-4 text-[14px] focus:outline-none transition-colors appearance-none cursor-pointer shrink-0 font-mono uppercase font-extrabold"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
              >
                <option value="all">ALL VALUE</option>
                <option value="0-100">0 - 100</option>
                <option value="100-500">100 - 500</option>
                <option value="500-1000">500 - 1,000</option>
                <option value="1000+">1,000+</option>
              </select>
            )}
            {(searchQuery || statusFilter !== 'all' || valueFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setValueFilter('all'); }}
                className="px-4 py-3.5 text-[13px] font-extrabold transition-colors whitespace-nowrap shrink-0 uppercase tracking-wider border-4"
                style={{
                  color: 'rgb(239 68 68 / 0.7)',
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-color)'
                }}
              >
                CLEAR
              </button>
            )}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'quests' && (
          <>
            {/* Sub-filter toggle */}
            <div className="flex items-center gap-0 mb-4">
              {(['mine', 'all'] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setQuestSubFilter(sub)}
                  className="px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wider transition-all border-4"
                  style={{
                    backgroundColor: questSubFilter === sub ? 'rgb(16 185 129 / 0.15)' : 'transparent',
                    color: questSubFilter === sub ? 'rgb(16 185 129)' : 'var(--text-secondary)',
                    borderColor: questSubFilter === sub ? 'rgb(16 185 129 / 0.4)' : 'var(--border-color)',
                    borderRight: sub === 'mine' ? 'none' : undefined
                  }}
                >
                  {sub === 'mine' ? 'MY QUESTS' : 'ALL QUESTS'}
                </button>
              ))}
            </div>
            {questSubFilter === 'mine' && !user?.token ? renderEmpty('Sign in to view your quests.') :
            loading ? renderLoading() :
            displayedQuests.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all' || valueFilter !== 'all') ? 'No quests match your filters.' : questSubFilter === 'mine' ? 'No quests created yet.' : 'No quests found.') : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedQuests.map(quest => (
                  <QuestCard key={quest.id} quest={quest} userKey={user?.key} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'responses' && (
          <>
            {/* Sub-filter toggle */}
            <div className="flex items-center gap-0 mb-4">
              {(['mine', 'all'] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setResponseSubFilter(sub)}
                  className="px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wider transition-all border-4"
                  style={{
                    backgroundColor: responseSubFilter === sub ? 'rgb(16 185 129 / 0.15)' : 'transparent',
                    color: responseSubFilter === sub ? 'rgb(16 185 129)' : 'var(--text-secondary)',
                    borderColor: responseSubFilter === sub ? 'rgb(16 185 129 / 0.4)' : 'var(--border-color)',
                    borderRight: sub === 'mine' ? 'none' : undefined
                  }}
                >
                  {sub === 'mine' ? 'MY RESPONSES' : "OTHERS' RESPONSES"}
                </button>
              ))}
            </div>
            {responseSubFilter === 'mine' && !user?.token ? renderEmpty('Sign in to view your responses.') :
            loading ? renderLoading() :
            displayedResponses.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all') ? 'No responses match your filters.' : responseSubFilter === 'mine' ? 'No responses submitted yet.' : 'No responses found.') : (
              <div>
                {displayedResponses.map(response => (
                  <ResponseCard key={response.id} response={response} onEdit={responseSubFilter === 'mine' ? handleEditResponse : undefined} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'stats' && (
          <StatsBar stats={stats} />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard responders={leaderboard} questers={questerBoard} loading={leaderboardLoading} />
        )}

        {activeTab === 'create' && (
          !user?.token ? renderEmpty('Sign in to create a quest.') : (
            <CreateQuestForm loading={loading} onSubmit={handleCreateQuest} userBalance={userBalance} />
          )
        )}

        {activeTab === 'docs' && (
          <div className="space-y-3">
            {/* Intro */}
            <div className="p-6 border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-extrabold" style={{ color: 'rgb(16 185 129)' }}>[REF]</span>
                <span className="text-[12px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>API Reference</span>
              </div>
              <p className="text-[14px] leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
                Interact with quests programmatically via the mod API. All endpoints are called via <code className="px-2 py-0.5 text-[13px] font-bold border-4" style={{ backgroundColor: 'var(--bg-input)', color: 'rgb(16 185 129)', borderColor: 'var(--border-color)' }}>client.call(method, params)</code>. Authenticated endpoints require a valid <code className="px-2 py-0.5 text-[13px] font-bold border-4" style={{ backgroundColor: 'var(--bg-input)', color: 'rgb(16 185 129)', borderColor: 'var(--border-color)' }}>token</code>.
              </p>
            </div>

            {/* Respond to a Quest */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'rgb(16 185 129 / 0.3)' }}>
              <div className="px-6 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgb(16 185 129 / 0.15)' }}>
                <span className="text-[12px] font-bold" style={{ color: 'rgb(16 185 129)' }}>&gt;</span>
                <span className="text-[14px] font-extrabold" style={{ color: 'rgb(16 185 129)' }}>RESPOND TO QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(217 119 6)', backgroundColor: 'rgb(217 119 6 / 0.1)', borderColor: 'rgb(217 119 6 / 0.25)' }}>AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>Submit your solution or deliverable to an open quest. The quest creator will review and can approve your response to release the token reward.</p>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>// Submit a response to a quest</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/respond&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>quest_id:</span> <span style={{ color: 'rgb(217 119 6)' }}>&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>content:</span>  <span style={{ color: 'rgb(217 119 6)' }}>&apos;Here is my solution...&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>token:</span>   <span style={{ color: 'rgb(217 119 6)' }}>yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] mt-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <span>PARAMS:</span> quest_id <span style={{ opacity: 0.6 }}>string</span> | content <span style={{ opacity: 0.6 }}>string</span> | token <span style={{ opacity: 0.6 }}>string</span>
                </div>
              </div>
            </div>

            {/* Browse Quests */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="px-6 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>LIST ALL QUESTS</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(16 185 129)', backgroundColor: 'rgb(16 185 129 / 0.1)', borderColor: 'rgb(16 185 129 / 0.25)' }}>PUBLIC</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>Browse all available quests. No authentication required.</p>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>// Fetch all open quests</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>const</span> quests = <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/quests&apos;</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Get Quest Details */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="px-6 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>GET QUEST DETAILS</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(16 185 129)', backgroundColor: 'rgb(16 185 129 / 0.1)', borderColor: 'rgb(16 185 129 / 0.25)' }}>PUBLIC</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>Fetch full details and responses for a specific quest.</p>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>// Get quest by ID</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>const</span> quest = <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/get_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>quest_id:</span> <span style={{ color: 'rgb(217 119 6)' }}>&apos;quest_abc123&apos;</span><br/>
                    {'}'})
                  </div>
                  <div className="font-bold mt-3" style={{ color: 'var(--text-primary)' }}>
                    <div className="mb-2" style={{ color: 'var(--text-secondary)' }}>// Get responses for that quest</div>
                    <span style={{ color: 'rgb(34 211 238)' }}>const</span> responses = <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/get_responses&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>quest_id:</span> <span style={{ color: 'rgb(217 119 6)' }}>&apos;quest_abc123&apos;</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Quest */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="px-6 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>EDIT A QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(217 119 6)', backgroundColor: 'rgb(217 119 6 / 0.1)', borderColor: 'rgb(217 119 6 / 0.25)' }}>AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>Edit your own quest while it is still open. Only the creator can edit.</p>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>// Edit quest fields</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/edit_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>quest_id:</span>    <span style={{ color: 'rgb(217 119 6)' }}>&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>title:</span>       <span style={{ color: 'rgb(217 119 6)' }}>&apos;Updated title&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>description:</span> <span style={{ color: 'rgb(217 119 6)' }}>&apos;Updated description...&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>reward:</span>      <span style={{ color: 'rgb(16 185 129)' }}>750</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>tags:</span>        [<span style={{ color: 'rgb(217 119 6)' }}>&apos;updated&apos;</span>],<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>token:</span>       <span style={{ color: 'rgb(217 119 6)' }}>yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] mt-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <span>PARAMS:</span> quest_id <span style={{ opacity: 0.6 }}>string</span> | title? <span style={{ opacity: 0.6 }}>string</span> | description? <span style={{ opacity: 0.6 }}>string</span> | reward? <span style={{ opacity: 0.6 }}>number</span> | tags? <span style={{ opacity: 0.6 }}>string[]</span> | token <span style={{ opacity: 0.6 }}>string</span>
                </div>
              </div>
            </div>

            {/* Create Quest */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="px-6 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>CREATE A QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(217 119 6)', backgroundColor: 'rgb(217 119 6 / 0.1)', borderColor: 'rgb(217 119 6 / 0.25)' }}>AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>Post a new quest with a token reward. Your token balance must cover the reward amount.</p>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>// Create a new quest</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/create_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>title:</span>       <span style={{ color: 'rgb(217 119 6)' }}>&apos;Build a landing page&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>description:</span> <span style={{ color: 'rgb(217 119 6)' }}>&apos;Need a responsive landing page...&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>reward:</span>      <span style={{ color: 'rgb(16 185 129)' }}>500</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>tags:</span>        [<span style={{ color: 'rgb(217 119 6)' }}>&apos;frontend&apos;</span>, <span style={{ color: 'rgb(217 119 6)' }}>&apos;design&apos;</span>],<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>token:</span>       <span style={{ color: 'rgb(217 119 6)' }}>yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] mt-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <span>PARAMS:</span> title <span style={{ opacity: 0.6 }}>string</span> | description <span style={{ opacity: 0.6 }}>string</span> | reward <span style={{ opacity: 0.6 }}>number</span> | tags <span style={{ opacity: 0.6 }}>string[]</span> | token <span style={{ opacity: 0.6 }}>string</span>
                </div>
              </div>
            </div>

            {/* My Quests & My Responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>MY QUESTS</span>
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(217 119 6)', backgroundColor: 'rgb(217 119 6 / 0.1)', borderColor: 'rgb(217 119 6 / 0.25)' }}>AUTH</span>
                </div>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/my_quests&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>token:</span> <span style={{ color: 'rgb(217 119 6)' }}>yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
              <div className="p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>MY RESPONSES</span>
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(217 119 6)', backgroundColor: 'rgb(217 119 6 / 0.1)', borderColor: 'rgb(217 119 6 / 0.25)' }}>AUTH</span>
                </div>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/my_responses&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>token:</span> <span style={{ color: 'rgb(217 119 6)' }}>yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Approve Response */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="px-6 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>APPROVE A RESPONSE</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-4" style={{ color: 'rgb(217 119 6)', backgroundColor: 'rgb(217 119 6 / 0.1)', borderColor: 'rgb(217 119 6 / 0.25)' }}>AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>As the quest creator, approve a response to release the token reward to the responder.</p>
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>// Approve and pay reward</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/approve&apos;</span>, {'{'}<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>quest_id:</span>    <span style={{ color: 'rgb(217 119 6)' }}>&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>response_id:</span> <span style={{ color: 'rgb(217 119 6)' }}>&apos;resp_xyz789&apos;</span>,<br/>
                    <span className="ml-4" style={{ color: 'var(--text-secondary)' }}>token:</span>       <span style={{ color: 'rgb(217 119 6)' }}>yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] mt-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <span>PARAMS:</span> quest_id <span style={{ opacity: 0.6 }}>string</span> | response_id <span style={{ opacity: 0.6 }}>string</span> | token <span style={{ opacity: 0.6 }}>string</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="px-6 py-3.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>GET STATS</span>
              </div>
              <div className="p-6">
                <div className="p-5 text-[14px] border-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'rgb(34 211 238)' }}>const</span> stats = <span style={{ color: 'rgb(34 211 238)' }}>await</span> client.<span style={{ color: 'rgb(16 185 129)' }}>call</span>(<span style={{ color: 'rgb(217 119 6)' }}>&apos;quests/stats&apos;</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow */}
            <div className="p-6 border-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px] font-extrabold" style={{ color: 'rgb(16 185 129)' }}>[WRK]</span>
                <span className="text-[12px] font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>Typical Workflow</span>
              </div>
              <div className="space-y-2">
                {[
                  { step: '01', label: 'Browse quests', desc: "Call quests/quests to find open tasks" },
                  { step: '02', label: 'Pick one and respond', desc: "Call quests/respond with your solution" },
                  { step: '03', label: 'Wait for review', desc: "Creator reviews your submission" },
                  { step: '04', label: 'Get paid', desc: "Creator approves — tokens transfer to you" },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 px-4 py-3 border-4 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <span className="text-[14px] font-extrabold shrink-0" style={{ color: 'rgb(16 185 129)' }}>{item.step}</span>
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-[13px] ml-auto hidden md:block font-medium" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>// {item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
