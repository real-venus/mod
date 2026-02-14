"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { userContext } from '@/context/UserContext';
import { Quest, QuestResponse, QuestTab } from './types';
import QuestCard from './QuestCard';
import CreateQuestForm from './CreateQuestForm';
import StatsBar from './StatsBar';
import ResponseCard from './ResponseCard';
import { getFreshToken } from '@/utils/tokenUtils';
import { toast } from 'react-toastify';

const TABS: { key: QuestTab; label: string }[] = [
  { key: 'browse', label: 'Browse' },
  { key: 'myQuests', label: 'My Quests' },
  { key: 'myResponses', label: 'My Responses' },
  { key: 'create', label: 'Create' },
  { key: 'docs', label: 'API Docs' },
];

export default function QuestsPage() {
  const { client, user } = userContext();
  const [activeTab, setActiveTab] = useState<QuestTab>('browse');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [myResponses, setMyResponses] = useState<QuestResponse[]>([]);
  const [loading, setLoading] = useState(false);
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
      // Get fresh token to avoid stale token errors
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
      // Get fresh token to avoid stale token errors
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
      // Get fresh token to avoid stale token errors
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

  const renderEmpty = (message: string) => (
    <div className="flex items-center justify-center py-20">
      <p className="text-[13px] font-mono text-neutral-500">{message}</p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] font-mono text-neutral-500">Loading...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-purple-500" />
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">Platform</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 border border-neutral-800">
          <StatsBar stats={stats} />
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-neutral-800 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setStatusFilter('all'); setValueFilter('all'); }}
              className={`relative px-5 py-3 text-[13px] font-mono tracking-wide transition-colors ${
                activeTab === tab.key
                  ? 'text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500" />
              )}
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        {activeTab !== 'create' && activeTab !== 'docs' && (
          <div className="mb-5 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search quests..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 text-[13px] font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-[13px] font-mono text-neutral-200 focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              {activeTab === 'myResponses' ? (
                <>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </>
              ) : (
                <>
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
            </select>
            {activeTab !== 'myResponses' && (
              <select
                value={valueFilter}
                onChange={e => setValueFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-[13px] font-mono text-neutral-200 focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All Value</option>
                <option value="0-100">0 - 100</option>
                <option value="100-500">100 - 500</option>
                <option value="500-1000">500 - 1,000</option>
                <option value="1000+">1,000+</option>
              </select>
            )}
            {(statusFilter !== 'all' || valueFilter !== 'all') && (
              <button
                onClick={() => { setStatusFilter('all'); setValueFilter('all'); }}
                className="px-3 py-2 text-[12px] font-mono text-neutral-500 hover:text-neutral-300 border border-neutral-800 bg-neutral-900 transition-colors whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'browse' && (
          loading ? renderLoading() :
          filteredQuests.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all' || valueFilter !== 'all') ? 'No quests match your filters.' : 'No open quests found.') : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-neutral-800 border border-neutral-800">
              {filteredQuests.map(quest => (
                <QuestCard key={quest.id} quest={quest} userKey={user?.key} />
              ))}
            </div>
          )
        )}

        {activeTab === 'myQuests' && (
          !user?.token ? renderEmpty('Sign in to view your quests.') :
          loading ? renderLoading() :
          filteredMyQuests.length === 0 ? renderEmpty((searchQuery || statusFilter !== 'all' || valueFilter !== 'all') ? 'No quests match your filters.' : 'No quests created yet.') : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-neutral-800 border border-neutral-800">
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
            <div className="space-y-[1px] bg-neutral-800 border border-neutral-800">
              {filteredMyResponses.map(response => (
                <ResponseCard key={response.id} response={response} />
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
          <div className="space-y-6">
            {/* Intro */}
            <div className="border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-purple-500" />
                <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">API Reference</span>
              </div>
              <p className="text-[14px] text-neutral-300 leading-relaxed">
                Interact with quests programmatically using the mod API. All endpoints are called via <code className="px-1.5 py-0.5 bg-neutral-800 text-purple-400 text-[13px] font-mono">client.call(method, params)</code>. Authenticated endpoints require a valid <code className="px-1.5 py-0.5 bg-neutral-800 text-purple-400 text-[13px] font-mono">token</code>.
              </p>
            </div>

            {/* Respond to a Quest */}
            <div className="border border-purple-500/30 bg-purple-500/5">
              <div className="px-5 py-3 border-b border-purple-500/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                <span className="text-[13px] font-mono font-medium text-purple-300">Respond to a Quest</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 uppercase">Auth Required</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[13px] text-neutral-400 leading-relaxed">Submit your solution or deliverable to an open quest. The quest creator will review and can approve your response to release the token reward.</p>
                <div className="bg-neutral-900 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-500 mb-2">// Submit a response to a quest</div>
                  <div className="text-neutral-200">
                    <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/respond'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">quest_id:</span> <span className="text-amber-300">'quest_abc123'</span>,<br/>
                    <span className="ml-4 text-neutral-400">content:</span>  <span className="text-amber-300">'Here is my solution...'</span>,<br/>
                    <span className="ml-4 text-neutral-400">token:</span>   <span className="text-amber-300">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] font-mono text-neutral-500 mt-2">
                  <span className="text-neutral-400">Params:</span> quest_id <span className="text-neutral-600">string</span> · content <span className="text-neutral-600">string</span> · token <span className="text-neutral-600">string</span>
                </div>
              </div>
            </div>

            {/* Browse Quests */}
            <div className="border border-neutral-800 bg-neutral-900">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <span className="text-[13px] font-mono font-medium text-neutral-300">List All Quests</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 uppercase">Public</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[13px] text-neutral-400">Browse all available quests. No authentication required.</p>
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-500 mb-2">// Fetch all open quests</div>
                  <div className="text-neutral-200">
                    <span className="text-blue-400">const</span> quests = <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/quests'</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Get Quest Details */}
            <div className="border border-neutral-800 bg-neutral-900">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <span className="text-[13px] font-mono font-medium text-neutral-300">Get Quest Details</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 uppercase">Public</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[13px] text-neutral-400">Fetch full details and responses for a specific quest.</p>
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-500 mb-2">// Get quest by ID</div>
                  <div className="text-neutral-200">
                    <span className="text-blue-400">const</span> quest = <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/get_quest'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">quest_id:</span> <span className="text-amber-300">'quest_abc123'</span><br/>
                    {'}'})
                  </div>
                  <div className="text-neutral-200 mt-3">
                    <div className="text-neutral-500 mb-2">// Get responses for that quest</div>
                    <span className="text-blue-400">const</span> responses = <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/get_responses'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">quest_id:</span> <span className="text-amber-300">'quest_abc123'</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Create Quest */}
            <div className="border border-neutral-800 bg-neutral-900">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <span className="text-[13px] font-mono font-medium text-neutral-300">Create a Quest</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 uppercase">Auth Required</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[13px] text-neutral-400">Post a new quest with a token reward. Your token balance must cover the reward amount.</p>
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-500 mb-2">// Create a new quest</div>
                  <div className="text-neutral-200">
                    <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/create_quest'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">title:</span>       <span className="text-amber-300">'Build a landing page'</span>,<br/>
                    <span className="ml-4 text-neutral-400">description:</span> <span className="text-amber-300">'Need a responsive landing page...'</span>,<br/>
                    <span className="ml-4 text-neutral-400">reward:</span>      <span className="text-emerald-400">500</span>,<br/>
                    <span className="ml-4 text-neutral-400">tags:</span>        [<span className="text-amber-300">'frontend'</span>, <span className="text-amber-300">'design'</span>],<br/>
                    <span className="ml-4 text-neutral-400">token:</span>       <span className="text-amber-300">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] font-mono text-neutral-500 mt-2">
                  <span className="text-neutral-400">Params:</span> title <span className="text-neutral-600">string</span> · description <span className="text-neutral-600">string</span> · reward <span className="text-neutral-600">number</span> · tags <span className="text-neutral-600">string[]</span> · token <span className="text-neutral-600">string</span>
                </div>
              </div>
            </div>

            {/* My Quests & My Responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-neutral-800">
              <div className="bg-neutral-900 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-mono font-medium text-neutral-300">My Quests</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 uppercase">Auth</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-200">
                    <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/my_quests'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">token:</span> <span className="text-amber-300">yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
              <div className="bg-neutral-900 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-mono font-medium text-neutral-300">My Responses</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 uppercase">Auth</span>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-200">
                    <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/my_responses'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">token:</span> <span className="text-amber-300">yourAuthToken</span><br/>
                    {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Approve Response */}
            <div className="border border-neutral-800 bg-neutral-900">
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
                <span className="text-[13px] font-mono font-medium text-neutral-300">Approve a Response</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 uppercase">Auth Required</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[13px] text-neutral-400">As the quest creator, approve a response to release the token reward to the responder.</p>
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-500 mb-2">// Approve and pay reward</div>
                  <div className="text-neutral-200">
                    <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/approve'</span>, {'{'}<br/>
                    <span className="ml-4 text-neutral-400">quest_id:</span>    <span className="text-amber-300">'quest_abc123'</span>,<br/>
                    <span className="ml-4 text-neutral-400">response_id:</span> <span className="text-amber-300">'resp_xyz789'</span>,<br/>
                    <span className="ml-4 text-neutral-400">token:</span>       <span className="text-amber-300">yourAuthToken</span>,<br/>
                    {'}'})
                  </div>
                </div>
                <div className="text-[12px] font-mono text-neutral-500 mt-2">
                  <span className="text-neutral-400">Params:</span> quest_id <span className="text-neutral-600">string</span> · response_id <span className="text-neutral-600">string</span> · token <span className="text-neutral-600">string</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="border border-neutral-800 bg-neutral-900">
              <div className="px-5 py-3 border-b border-neutral-800">
                <span className="text-[13px] font-mono font-medium text-neutral-300">Get Stats</span>
              </div>
              <div className="p-5">
                <div className="bg-neutral-950 border border-neutral-800 p-4 font-mono text-[13px]">
                  <div className="text-neutral-200">
                    <span className="text-blue-400">const</span> stats = <span className="text-blue-400">await</span> client.<span className="text-emerald-400">call</span>(<span className="text-amber-300">'quests/stats'</span>, {'{'} {'}'})
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow */}
            <div className="border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-emerald-500" />
                <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">Typical Workflow</span>
              </div>
              <div className="space-y-3">
                {[
                  { step: '1', label: 'Browse quests', desc: "Call quests/quests to find open tasks", color: 'text-purple-400' },
                  { step: '2', label: 'Pick one and respond', desc: "Call quests/respond with your solution", color: 'text-blue-400' },
                  { step: '3', label: 'Wait for review', desc: "Creator reviews your submission", color: 'text-amber-400' },
                  { step: '4', label: 'Get paid', desc: "Creator approves — tokens transfer to you", color: 'text-emerald-400' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span className={`text-[14px] font-mono font-medium ${item.color} shrink-0 w-5`}>{item.step}</span>
                    <div>
                      <span className="text-[13px] font-mono text-neutral-200">{item.label}</span>
                      <span className="text-[12px] font-mono text-neutral-500 ml-2">— {item.desc}</span>
                    </div>
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
