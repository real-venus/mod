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
    <div className="flex flex-col items-center justify-center py-20 bg-[#0a0a0e] border-2 border-white/[0.1] font-mono">
      <span className="text-emerald-400/50 text-[15px] mb-2 font-extrabold">[EMPTY]</span>
      <p className="text-[15px] text-white/40 font-bold">{message}</p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center py-20 font-mono">
      <div className="flex items-center gap-3">
        <span className="text-emerald-400 animate-pulse text-lg">_</span>
        <span className="text-[15px] text-white/45 font-extrabold">LOADING...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden font-mono">
      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      />

      {/* Subtle corner vignette */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }} />

      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-8 z-20">

        {/* Header + Tabs + Create */}
        <div className="mb-6">
          <div className="flex items-end gap-5 border-b border-white/[0.08] pb-0">
            <div className="flex items-center gap-2.5 shrink-0 pb-3">
              <span className="text-emerald-400/60 text-[16px] font-extrabold select-none">&gt;_</span>
              <h1 className="text-[24px] font-extrabold text-white tracking-tight uppercase leading-none" style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>QUESTS</h1>
            </div>
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
              {TABS.filter(t => t.key !== 'create').map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key as QuestTab); setStatusFilter('all'); setValueFilter('all'); setSearchQuery(''); }}
                  className={`relative px-4 py-3.5 text-[14px] font-extrabold tracking-wider transition-all whitespace-nowrap shrink-0 uppercase border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'text-emerald-400 border-emerald-400 bg-emerald-500/[0.06]'
                      : 'text-white/35 border-transparent hover:text-white/60 hover:border-white/15'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setActiveTab('create'); setStatusFilter('all'); setValueFilter('all'); setSearchQuery(''); }}
              className={`shrink-0 px-6 py-2.5 mb-1.5 text-[14px] font-extrabold uppercase tracking-widest transition-all border-2 ${
                activeTab === 'create'
                  ? 'bg-green-400 text-black border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.3)]'
                  : 'bg-green-500/15 text-green-400 border-green-500/50 hover:bg-green-500/25 hover:border-green-400 hover:shadow-[0_0_15px_rgba(74,222,128,0.2)]'
              }`}
            >
              + CREATE QUEST
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        {showFilters && (
          <div className="mb-5 flex flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-[15px] font-extrabold">&gt;</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="search quests..."
                className="w-full pl-9 pr-4 py-3.5 bg-[#0a0a0e] border-2 border-white/[0.08] text-[15px] text-white/80 placeholder-white/25 focus:outline-none focus:border-emerald-500/40 font-mono font-bold transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-[13px] font-extrabold"
                >
                  [x]
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-3.5 bg-[#0a0a0e] border-2 border-white/[0.08] text-[14px] text-white/55 focus:outline-none transition-colors appearance-none cursor-pointer shrink-0 font-mono uppercase font-extrabold hover:border-white/[0.15]"
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
                className="px-4 py-3.5 bg-[#0a0a0e] border-2 border-white/[0.08] text-[14px] text-white/55 focus:outline-none transition-colors appearance-none cursor-pointer shrink-0 font-mono uppercase font-extrabold hover:border-white/[0.15]"
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
                className="px-4 py-3.5 text-[13px] font-extrabold text-red-400/60 hover:text-red-400 bg-[#0a0a0e] border-2 border-white/[0.08] hover:border-red-400/30 transition-colors whitespace-nowrap shrink-0 uppercase tracking-wider"
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
                  className={`px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wider transition-all border-2 ${
                    questSubFilter === sub
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-transparent text-white/30 border-white/[0.08] hover:text-white/50 hover:border-white/[0.15]'
                  } ${sub === 'mine' ? 'border-r-0' : ''}`}
                >
                  {sub === 'mine' ? 'MY QUESTS' : 'ALL QUESTS'}
                </button>
              ))}
            </div>
            {questSubFilter === 'mine' && !user?.token ? renderEmpty('Sign in to view your quests.') :
            loading ? renderLoading() :
            displayedQuests.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all' || valueFilter !== 'all') ? 'No quests match your filters.' : questSubFilter === 'mine' ? 'No quests created yet.' : 'No quests found.') : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                  className={`px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wider transition-all border-2 ${
                    responseSubFilter === sub
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-transparent text-white/30 border-white/[0.08] hover:text-white/50 hover:border-white/[0.15]'
                  } ${sub === 'mine' ? 'border-r-0' : ''}`}
                >
                  {sub === 'mine' ? 'MY RESPONSES' : "OTHERS' RESPONSES"}
                </button>
              ))}
            </div>
            {responseSubFilter === 'mine' && !user?.token ? renderEmpty('Sign in to view your responses.') :
            loading ? renderLoading() :
            displayedResponses.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all') ? 'No responses match your filters.' : responseSubFilter === 'mine' ? 'No responses submitted yet.' : 'No responses found.') : (
              <div className="space-y-px">
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
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08] p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-400 text-[13px] font-extrabold">[REF]</span>
                <span className="text-[12px] font-extrabold text-white/35 uppercase tracking-[0.2em]">API Reference</span>
              </div>
              <p className="text-[14px] text-white/40 leading-relaxed font-medium">
                Interact with quests programmatically via the mod API. All endpoints are called via <code className="px-2 py-0.5 bg-white/[0.04] text-emerald-400 text-[13px] border-2 border-white/[0.08] font-bold">client.call(method, params)</code>. Authenticated endpoints require a valid <code className="px-2 py-0.5 bg-white/[0.04] text-emerald-400 text-[13px] border-2 border-white/[0.08] font-bold">token</code>.
              </p>
            </div>

            {/* Respond to a Quest */}
            <div className="bg-[#0a0a0e] border-2 border-emerald-500/25">
              <div className="px-6 py-3.5 border-b border-emerald-500/15 flex items-center gap-2">
                <span className="text-emerald-400 text-[12px] font-bold">&gt;</span>
                <span className="text-[14px] font-extrabold text-emerald-400">RESPOND TO QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] text-white/35 leading-relaxed font-medium">Submit your solution or deliverable to an open quest. The quest creator will review and can approve your response to release the token reward.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/25 mb-2 font-bold">// Submit a response to a quest</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/respond&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span> <span className="text-amber-400">&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">content:</span>  <span className="text-amber-400">&apos;Here is my solution...&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">token:</span>   <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> quest_id <span className="text-white/20">string</span> | content <span className="text-white/20">string</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* Browse Quests */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-white/55">LIST ALL QUESTS</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold text-green-400 bg-green-400/10 border-2 border-green-400/25 uppercase tracking-wider">PUBLIC</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] text-white/35 font-medium">Browse all available quests. No authentication required.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/25 mb-2 font-bold">// Fetch all open quests</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">const</span> quests = <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/quests&apos;</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Get Quest Details */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-white/55">GET QUEST DETAILS</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold text-green-400 bg-green-400/10 border-2 border-green-400/25 uppercase tracking-wider">PUBLIC</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] text-white/35 font-medium">Fetch full details and responses for a specific quest.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/25 mb-2 font-bold">// Get quest by ID</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">const</span> quest = <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/get_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span> <span className="text-amber-400">&apos;quest_abc123&apos;</span><br/>
                    {'}'})
                  </div>
                  <div className="text-white/70 font-bold mt-3">
                    <div className="text-white/25 mb-2">// Get responses for that quest</div>
                    <span className="text-cyan-400">const</span> responses = <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/get_responses&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span> <span className="text-amber-400">&apos;quest_abc123&apos;</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Quest */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-white/55">EDIT A QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] text-white/35 font-medium">Edit your own quest while it is still open. Only the creator can edit.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/25 mb-2 font-bold">// Edit quest fields</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/edit_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span>    <span className="text-amber-400">&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">title:</span>       <span className="text-amber-400">&apos;Updated title&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">description:</span> <span className="text-amber-400">&apos;Updated description...&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">reward:</span>      <span className="text-green-400">750</span>,<br/>
                    <span className="ml-4 text-white/35">tags:</span>        [<span className="text-amber-400">&apos;updated&apos;</span>],<br/>
                    <span className="ml-4 text-white/35">token:</span>       <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> quest_id <span className="text-white/20">string</span> | title? <span className="text-white/20">string</span> | description? <span className="text-white/20">string</span> | reward? <span className="text-white/20">number</span> | tags? <span className="text-white/20">string[]</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* Create Quest */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-white/55">CREATE A QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] text-white/35 font-medium">Post a new quest with a token reward. Your token balance must cover the reward amount.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/25 mb-2 font-bold">// Create a new quest</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/create_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">title:</span>       <span className="text-amber-400">&apos;Build a landing page&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">description:</span> <span className="text-amber-400">&apos;Need a responsive landing page...&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">reward:</span>      <span className="text-green-400">500</span>,<br/>
                    <span className="ml-4 text-white/35">tags:</span>        [<span className="text-amber-400">&apos;frontend&apos;</span>, <span className="text-amber-400">&apos;design&apos;</span>],<br/>
                    <span className="ml-4 text-white/35">token:</span>       <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> title <span className="text-white/20">string</span> | description <span className="text-white/20">string</span> | reward <span className="text-white/20">number</span> | tags <span className="text-white/20">string[]</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* My Quests & My Responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-[#0a0a0e] p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[14px] font-extrabold text-white/55">MY QUESTS</span>
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
                </div>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/my_quests&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">token:</span> <span className="text-amber-400">yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
              <div className="bg-[#0a0a0e] p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[14px] font-extrabold text-white/55">MY RESPONSES</span>
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
                </div>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/my_responses&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">token:</span> <span className="text-amber-400">yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Approve Response */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-white/55">APPROVE A RESPONSE</span>
                <span className="ml-auto px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[14px] text-white/35 font-medium">As the quest creator, approve a response to release the token reward to the responder.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/25 mb-2 font-bold">// Approve and pay reward</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/approve&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span>    <span className="text-amber-400">&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">response_id:</span> <span className="text-amber-400">&apos;resp_xyz789&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">token:</span>       <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> quest_id <span className="text-white/20">string</span> | response_id <span className="text-white/20">string</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06]">
                <span className="text-[14px] font-extrabold text-white/55">GET STATS</span>
              </div>
              <div className="p-6">
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[14px]">
                  <div className="text-white/70 font-bold">
                    <span className="text-cyan-400">const</span> stats = <span className="text-cyan-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/stats&apos;</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-green-400 text-[13px] font-extrabold">[WRK]</span>
                <span className="text-[12px] font-extrabold text-white/35 uppercase tracking-[0.2em]">Typical Workflow</span>
              </div>
              <div className="space-y-2">
                {[
                  { step: '01', label: 'Browse quests', desc: "Call quests/quests to find open tasks" },
                  { step: '02', label: 'Pick one and respond', desc: "Call quests/respond with your solution" },
                  { step: '03', label: 'Wait for review', desc: "Creator reviews your submission" },
                  { step: '04', label: 'Get paid', desc: "Creator approves — tokens transfer to you" },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 px-4 py-3 border-2 border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <span className="text-emerald-400 text-[14px] font-extrabold shrink-0">{item.step}</span>
                    <span className="text-[14px] text-white/55 font-bold">{item.label}</span>
                    <span className="text-[13px] text-white/20 ml-auto hidden md:block font-medium">// {item.desc}</span>
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
