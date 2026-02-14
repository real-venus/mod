"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { userContext } from '@/context/UserContext';
import { Quest, QuestResponse, QuestTab, LeaderboardEntry } from './types';
import QuestCard from './QuestCard';
import CreateQuestForm from './CreateQuestForm';
import StatsBar from './StatsBar';
import ResponseCard from './ResponseCard';
import Leaderboard from './Leaderboard';
import { getFreshToken } from '@/utils/tokenUtils';
import { toast } from 'react-toastify';

const TABS: { key: QuestTab; label: string; prefix: string }[] = [
  { key: 'browse', label: 'BROWSE', prefix: 'BRW' },
  { key: 'leaderboard', label: 'RANKS', prefix: 'LDR' },
  { key: 'myQuests', label: 'MY QUESTS', prefix: 'MYQ' },
  { key: 'myResponses', label: 'RESPONSES', prefix: 'RSP' },
  { key: 'create', label: 'CREATE', prefix: 'NEW' },
  { key: 'docs', label: 'API DOCS', prefix: 'DOC' },
];

export default function QuestsPage() {
  const { client, user } = userContext();
  const [activeTab, setActiveTab] = useState<QuestTab>('browse');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [myResponses, setMyResponses] = useState<QuestResponse[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [valueFilter, setValueFilter] = useState<string>('all');

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
      const data = Array.isArray(result) ? result : result?.data || [];
      setLeaderboard(data);
    } catch (e) {
      // Fallback: build leaderboard client-side from completed quests
      console.warn('Leaderboard endpoint not available, building from quests data');
      try {
        const allQuests = await client.call('quests/quests', {});
        const questList: Quest[] = Array.isArray(allQuests) ? allQuests : allQuests?.data || [];
        const earnerMap = new Map<string, { total_earned: number; quests_completed: number }>();

        for (const q of questList) {
          if (q.status === 'completed' && q.approved_response && q.responses) {
            const approvedResp = q.responses.find((r: any) => r.id === q.approved_response || r.status === 'approved');
            if (approvedResp) {
              const key = approvedResp.responder;
              const existing = earnerMap.get(key) || { total_earned: 0, quests_completed: 0 };
              existing.total_earned += q.reward;
              existing.quests_completed += 1;
              earnerMap.set(key, existing);
            }
          }
        }

        const entries: LeaderboardEntry[] = Array.from(earnerMap.entries())
          .map(([responder, data]) => ({ responder, ...data }))
          .sort((a, b) => b.total_earned - a.total_earned);

        setLeaderboard(entries);
      } catch (e2) {
        console.error('Failed to build leaderboard:', e2);
        setLeaderboard([]);
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
    if (activeTab === 'browse') fetchQuests();
  }, [activeTab, fetchQuests]);

  useEffect(() => {
    if (activeTab === 'myQuests') fetchMyQuests();
  }, [activeTab, fetchMyQuests]);

  useEffect(() => {
    if (activeTab === 'myResponses') fetchMyResponses();
  }, [activeTab, fetchMyResponses]);

  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab, fetchLeaderboard]);

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
        setActiveTab('myQuests');
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

  // --- Render helpers ---

  const showFilters = activeTab === 'browse' || activeTab === 'myQuests' || activeTab === 'myResponses';

  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center py-20 bg-[#0a0a0e] border-2 border-white/[0.08] font-mono">
      <span className="text-blue-400/40 text-[13px] mb-2 font-bold">[EMPTY]</span>
      <p className="text-[13px] text-white/30 font-medium">{message}</p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center py-20 font-mono">
      <div className="flex items-center gap-3">
        <span className="text-blue-400 animate-pulse">_</span>
        <span className="text-[13px] text-white/35 font-bold">LOADING...</span>
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

      <div className="relative max-w-5xl mx-auto px-6 py-8 z-20">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-400 text-[12px] font-extrabold">[SYS]</span>
            <span className="text-[11px] text-white/25 uppercase tracking-[0.25em] font-bold">Quest Terminal</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white/95 tracking-tight">QUESTS</h1>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <StatsBar stats={stats} />
        </div>

        {/* Tab navigation */}
        <div className="flex gap-px mb-6 overflow-x-auto pb-1 scrollbar-none bg-white/[0.04]">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setStatusFilter('all'); setValueFilter('all'); setSearchQuery(''); }}
              className={`relative px-5 py-3 text-[12px] font-extrabold tracking-wider transition-all whitespace-nowrap shrink-0 uppercase ${
                activeTab === tab.key
                  ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-400'
                  : 'bg-[#0a0a0a] text-white/30 hover:text-white/55 hover:bg-white/[0.03] border-b-2 border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-[10px] opacity-50">[{tab.prefix}]</span>
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        {showFilters && (
          <div className="mb-5 flex flex-row gap-px bg-white/[0.04]">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-[12px] font-bold">&gt;</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="search quests..."
                className="w-full pl-8 pr-4 py-3 bg-[#0a0a0a] border-none text-[13px] text-white/70 placeholder-white/20 focus:outline-none font-mono font-bold"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors text-[11px] font-bold"
                >
                  [x]
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-[#0a0a0a] text-[12px] text-white/45 focus:outline-none transition-colors appearance-none cursor-pointer shrink-0 font-mono uppercase font-bold"
            >
              <option value="all">ALL STATUS</option>
              {activeTab === 'myResponses' ? (
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
            {activeTab !== 'myResponses' && (
              <select
                value={valueFilter}
                onChange={e => setValueFilter(e.target.value)}
                className="px-4 py-3 bg-[#0a0a0a] text-[12px] text-white/45 focus:outline-none transition-colors appearance-none cursor-pointer shrink-0 font-mono uppercase font-bold"
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
                className="px-4 py-3 text-[11px] font-extrabold text-white/30 hover:text-white/55 bg-[#0a0a0a] transition-colors whitespace-nowrap shrink-0 uppercase tracking-wider"
              >
                CLEAR
              </button>
            )}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'browse' && (
          loading ? renderLoading() :
          filteredQuests.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all' || valueFilter !== 'all') ? 'No quests match your filters.' : 'No open quests found.') : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04]">
              {filteredQuests.map(quest => (
                <QuestCard key={quest.id} quest={quest} userKey={user?.key} />
              ))}
            </div>
          )
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
        )}

        {activeTab === 'myQuests' && (
          !user?.token ? renderEmpty('Sign in to view your quests.') :
          loading ? renderLoading() :
          filteredMyQuests.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all' || valueFilter !== 'all') ? 'No quests match your filters.' : 'No quests created yet.') : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04]">
              {filteredMyQuests.map(quest => (
                <QuestCard key={quest.id} quest={quest} userKey={user?.key} />
              ))}
            </div>
          )
        )}

        {activeTab === 'myResponses' && (
          !user?.token ? renderEmpty('Sign in to view your responses.') :
          loading ? renderLoading() :
          filteredMyResponses.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all') ? 'No responses match your filters.' : 'No responses submitted yet.') : (
            <div className="space-y-px">
              {filteredMyResponses.map(response => (
                <ResponseCard key={response.id} response={response} onEdit={handleEditResponse} />
              ))}
            </div>
          )
        )}

        {activeTab === 'create' && (
          !user?.token ? renderEmpty('Sign in to create a quest.') : (
            <CreateQuestForm loading={loading} onSubmit={handleCreateQuest} />
          )
        )}

        {activeTab === 'docs' && (
          <div className="space-y-3">
            {/* Intro */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08] p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-400 text-[12px] font-extrabold">[REF]</span>
                <span className="text-[11px] font-extrabold text-white/35 uppercase tracking-[0.2em]">API Reference</span>
              </div>
              <p className="text-[13px] text-white/40 leading-relaxed font-medium">
                Interact with quests programmatically via the mod API. All endpoints are called via <code className="px-2 py-0.5 bg-white/[0.04] text-blue-400 text-[12px] border-2 border-white/[0.08] font-bold">client.call(method, params)</code>. Authenticated endpoints require a valid <code className="px-2 py-0.5 bg-white/[0.04] text-blue-400 text-[12px] border-2 border-white/[0.08] font-bold">token</code>.
              </p>
            </div>

            {/* Respond to a Quest */}
            <div className="bg-[#0a0a0e] border-2 border-blue-500/25">
              <div className="px-6 py-3.5 border-b border-blue-500/15 flex items-center gap-2">
                <span className="text-blue-400 text-[11px] font-bold">&gt;</span>
                <span className="text-[13px] font-extrabold text-blue-400">RESPOND TO QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[13px] text-white/35 leading-relaxed font-medium">Submit your solution or deliverable to an open quest. The quest creator will review and can approve your response to release the token reward.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/25 mb-2 font-bold">// Submit a response to a quest</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/respond&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span> <span className="text-amber-400">&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">content:</span>  <span className="text-amber-400">&apos;Here is my solution...&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">token:</span>   <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[11px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> quest_id <span className="text-white/20">string</span> | content <span className="text-white/20">string</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* Browse Quests */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-white/55">LIST ALL QUESTS</span>
                <span className="ml-auto px-2.5 py-0.5 text-[10px] font-extrabold text-green-400 bg-green-400/10 border-2 border-green-400/25 uppercase tracking-wider">PUBLIC</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[13px] text-white/35 font-medium">Browse all available quests. No authentication required.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/25 mb-2 font-bold">// Fetch all open quests</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">const</span> quests = <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/quests&apos;</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Get Quest Details */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-white/55">GET QUEST DETAILS</span>
                <span className="ml-auto px-2.5 py-0.5 text-[10px] font-extrabold text-green-400 bg-green-400/10 border-2 border-green-400/25 uppercase tracking-wider">PUBLIC</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[13px] text-white/35 font-medium">Fetch full details and responses for a specific quest.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/25 mb-2 font-bold">// Get quest by ID</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">const</span> quest = <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/get_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span> <span className="text-amber-400">&apos;quest_abc123&apos;</span><br/>
                    {'}'})
                  </div>
                  <div className="text-white/70 font-bold mt-3">
                    <div className="text-white/25 mb-2">// Get responses for that quest</div>
                    <span className="text-blue-400">const</span> responses = <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/get_responses&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span> <span className="text-amber-400">&apos;quest_abc123&apos;</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Quest */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-white/55">EDIT A QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[13px] text-white/35 font-medium">Edit your own quest while it is still open. Only the creator can edit.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/25 mb-2 font-bold">// Edit quest fields</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/edit_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span>    <span className="text-amber-400">&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">title:</span>       <span className="text-amber-400">&apos;Updated title&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">description:</span> <span className="text-amber-400">&apos;Updated description...&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">reward:</span>      <span className="text-green-400">750</span>,<br/>
                    <span className="ml-4 text-white/35">tags:</span>        [<span className="text-amber-400">&apos;updated&apos;</span>],<br/>
                    <span className="ml-4 text-white/35">token:</span>       <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[11px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> quest_id <span className="text-white/20">string</span> | title? <span className="text-white/20">string</span> | description? <span className="text-white/20">string</span> | reward? <span className="text-white/20">number</span> | tags? <span className="text-white/20">string[]</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* Create Quest */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-white/55">CREATE A QUEST</span>
                <span className="ml-auto px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[13px] text-white/35 font-medium">Post a new quest with a token reward. Your token balance must cover the reward amount.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/25 mb-2 font-bold">// Create a new quest</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/create_quest&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">title:</span>       <span className="text-amber-400">&apos;Build a landing page&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">description:</span> <span className="text-amber-400">&apos;Need a responsive landing page...&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">reward:</span>      <span className="text-green-400">500</span>,<br/>
                    <span className="ml-4 text-white/35">tags:</span>        [<span className="text-amber-400">&apos;frontend&apos;</span>, <span className="text-amber-400">&apos;design&apos;</span>],<br/>
                    <span className="ml-4 text-white/35">token:</span>       <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[11px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> title <span className="text-white/20">string</span> | description <span className="text-white/20">string</span> | reward <span className="text-white/20">number</span> | tags <span className="text-white/20">string[]</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* My Quests & My Responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04]">
              <div className="bg-[#0a0a0e] p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-extrabold text-white/55">MY QUESTS</span>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
                </div>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/my_quests&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">token:</span> <span className="text-amber-400">yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
              <div className="bg-[#0a0a0e] p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-extrabold text-white/55">MY RESPONSES</span>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
                </div>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/my_responses&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">token:</span> <span className="text-amber-400">yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Approve Response */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-white/55">APPROVE A RESPONSE</span>
                <span className="ml-auto px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border-2 border-amber-400/25 uppercase tracking-wider">AUTH</span>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-[13px] text-white/35 font-medium">As the quest creator, approve a response to release the token reward to the responder.</p>
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/25 mb-2 font-bold">// Approve and pay reward</div>
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/approve&apos;</span>, {'{'}<br/>
                    <span className="ml-4 text-white/35">quest_id:</span>    <span className="text-amber-400">&apos;quest_abc123&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">response_id:</span> <span className="text-amber-400">&apos;resp_xyz789&apos;</span>,<br/>
                    <span className="ml-4 text-white/35">token:</span>       <span className="text-amber-400">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[11px] text-white/25 mt-2 font-bold">
                  <span className="text-white/35">PARAMS:</span> quest_id <span className="text-white/20">string</span> | response_id <span className="text-white/20">string</span> | token <span className="text-white/20">string</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08]">
              <div className="px-6 py-3.5 border-b border-white/[0.06]">
                <span className="text-[13px] font-extrabold text-white/55">GET STATS</span>
              </div>
              <div className="p-6">
                <div className="bg-black/50 border-2 border-white/[0.06] p-5 text-[13px]">
                  <div className="text-white/70 font-bold">
                    <span className="text-blue-400">const</span> stats = <span className="text-blue-400">await</span> client.<span className="text-green-400">call</span>(<span className="text-amber-400">&apos;quests/stats&apos;</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow */}
            <div className="bg-[#0a0a0e] border-2 border-white/[0.08] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-green-400 text-[12px] font-extrabold">[WRK]</span>
                <span className="text-[11px] font-extrabold text-white/35 uppercase tracking-[0.2em]">Typical Workflow</span>
              </div>
              <div className="space-y-2">
                {[
                  { step: '01', label: 'Browse quests', desc: "Call quests/quests to find open tasks" },
                  { step: '02', label: 'Pick one and respond', desc: "Call quests/respond with your solution" },
                  { step: '03', label: 'Wait for review', desc: "Creator reviews your submission" },
                  { step: '04', label: 'Get paid', desc: "Creator approves — tokens transfer to you" },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 px-4 py-3 border-2 border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <span className="text-blue-400 text-[13px] font-extrabold shrink-0">{item.step}</span>
                    <span className="text-[13px] text-white/55 font-bold">{item.label}</span>
                    <span className="text-[12px] text-white/20 ml-auto hidden md:block font-medium">// {item.desc}</span>
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
