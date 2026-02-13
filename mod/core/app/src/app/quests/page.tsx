"use client";

import { useState, useEffect, useCallback } from 'react';
import { userContext } from '@/context/UserContext';
import { Quest, QuestResponse, QuestTab } from './types';
import QuestCard from './QuestCard';
import QuestDetail from './QuestDetail';
import CreateQuestForm from './CreateQuestForm';
import StatsBar from './StatsBar';
import ResponseCard from './ResponseCard';
import { getFreshToken, isTokenExpiryError } from '@/utils/tokenUtils';

const TABS: { key: QuestTab; label: string }[] = [
  { key: 'browse', label: 'Browse' },
  { key: 'myQuests', label: 'My Quests' },
  { key: 'myResponses', label: 'My Responses' },
  { key: 'create', label: 'Create' },
];

export default function QuestsPage() {
  const { client, user } = userContext();
  const [activeTab, setActiveTab] = useState<QuestTab>('browse');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [myResponses, setMyResponses] = useState<QuestResponse[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [questResponses, setQuestResponses] = useState<QuestResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // --- Data fetching ---

  const fetchQuests = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const result = await client.call('quests/quests', {  });
      setQuests(result || []);
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
      setMyQuests(result?.data || []);
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
      setMyResponses(result?.data || []);
    } catch (e) {
      console.error('Failed to fetch my responses:', e);
    }
    setLoading(false);
  }, [client, user?.key, user?.wallet_mode]);

  const fetchStats = useCallback(async () => {
    if (!client) return;
    try {
      const result = await client.call('quests/stats', {});
      setStats(result?.data || null);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [client]);

  const fetchQuestDetails = useCallback(async (questId: string) => {
    if (!client) return;
    try {
      const questResult = await client.call('quests/get_quest', { quest_id: questId });
      setSelectedQuest(questResult?.data || null);
      const responsesResult = await client.call('quests/get_responses', { quest_id: questId });
      setQuestResponses(responsesResult?.data || []);
    } catch (e) {
      console.error('Failed to fetch quest details:', e);
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
      alert('Please sign in to create a quest');
      return;
    }
    setLoading(true);
    try {
      // Get fresh token to avoid stale token errors
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        alert('Failed to get authentication token. Please try signing in again.');
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
          alert('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
        } else {
          alert(`Failed to create quest: ${errorMsg}`);
        }
      } else if (result?.data) {
        alert('Quest created successfully!');
        setActiveTab('myQuests');
      }
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        alert('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        alert(`Failed to create quest: ${errorMsg}`);
      }
    }
    setLoading(false);
  };

  const handleRespondToQuest = async (questId: string, content: string) => {
    if (!user?.key) {
      alert('Please sign in to respond to a quest');
      return;
    }
    try {
      // Get fresh token to avoid stale token errors
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        alert('Failed to get authentication token. Please try signing in again.');
        return;
      }

      await client.call('quests/respond', {
        quest_id: questId,
        content,
        token: freshToken,
      });
      alert('Response submitted successfully!');
      fetchQuestDetails(questId);
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        alert('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        alert(`Failed to submit response: ${errorMsg}`);
      }
    }
  };

  const handleApproveResponse = async (questId: string, responseId: string) => {
    if (!user?.key) return;
    if (!confirm('Are you sure you want to approve this response? This will transfer the reward.')) return;
    try {
      // Get fresh token to avoid stale token errors
      const freshToken = await getFreshToken(user.key, user.wallet_mode);
      if (!freshToken) {
        alert('Failed to get authentication token. Please try signing in again.');
        return;
      }

      await client.call('quests/approve', {
        quest_id: questId,
        response_id: responseId,
        token: freshToken,
      });
      alert('Response approved! Reward sent.');
      fetchQuestDetails(questId);
      fetchMyQuests();
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes('Token is stale') || errorMsg.includes('stale')) {
        alert('Your session has expired. Please refresh your token using the TOKEN button in your wallet.');
      } else {
        alert(`Failed to approve response: ${errorMsg}`);
      }
    }
  };

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
          <h1 className="text-2xl font-medium text-neutral-100 tracking-tight">Quests</h1>
          <p className="text-[13px] text-neutral-500 mt-1">Post tasks, earn tokens, build together.</p>
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
              onClick={() => setActiveTab(tab.key)}
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

        {/* Tab content */}
        {activeTab === 'browse' && (
          loading ? renderLoading() :
          quests.length === 0 ? renderEmpty('No open quests found.') : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-neutral-800 border border-neutral-800">
              {quests.map(quest => (
                <QuestCard key={quest.id} quest={quest} onClick={fetchQuestDetails} />
              ))}
            </div>
          )
        )}

        {activeTab === 'myQuests' && (
          !user?.token ? renderEmpty('Sign in to view your quests.') :
          loading ? renderLoading() :
          myQuests.length === 0 ? renderEmpty('No quests created yet.') : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-neutral-800 border border-neutral-800">
              {myQuests.map(quest => (
                <QuestCard key={quest.id} quest={quest} onClick={fetchQuestDetails} />
              ))}
            </div>
          )
        )}

        {activeTab === 'myResponses' && (
          !user?.token ? renderEmpty('Sign in to view your responses.') :
          loading ? renderLoading() :
          myResponses.length === 0 ? renderEmpty('No responses submitted yet.') : (
            <div className="space-y-[1px] bg-neutral-800 border border-neutral-800">
              {myResponses.map(response => (
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
      </div>

      {/* Quest Detail Modal */}
      {selectedQuest && (
        <QuestDetail
          quest={selectedQuest}
          responses={questResponses}
          userKey={user?.key}
          onClose={() => setSelectedQuest(null)}
          onRespond={handleRespondToQuest}
          onApprove={handleApproveResponse}
        />
      )}
    </div>
  );
}
