'use client';

import { useState, useEffect } from 'react';
import { getIdentityContract, getReputationContract, getValidationContract } from '@/lib/ethereum';
import { AgentIdentity, AgentMetadata } from '@/types/erc8004';
import AgentCard from './AgentCard';
import { Search, Filter, Loader2, Bot } from 'lucide-react';

export default function AgentMarketplace() {
  const [agents, setAgents] = useState<AgentIdentity[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [agentMetadata, setAgentMetadata] = useState<Record<string, AgentMetadata>>({});
  const [agentStats, setAgentStats] = useState<Record<string, { reputation: number; validations: number }>>({});

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [searchTerm, agents]);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const identityContract = getIdentityContract();
      const reputationContract = getReputationContract();
      const validationContract = getValidationContract();

      // In a real implementation, you'd query events or have an indexer
      // For now, we'll try to load the first 20 agents
      const loadedAgents: AgentIdentity[] = [];
      const metadata: Record<string, AgentMetadata> = {};
      const stats: Record<string, { reputation: number; validations: number }> = {};

      for (let i = 1; i <= 20; i++) {
        try {
          const [owner, metadataURI, createdAt] = await identityContract.getAgentIdentity(i);

          if (owner !== '0x0000000000000000000000000000000000000000') {
            const agent: AgentIdentity = {
              tokenId: i.toString(),
              owner,
              metadataURI,
              capabilities: [],
              protocols: [],
              createdAt: Number(createdAt),
            };

            loadedAgents.push(agent);

            // Try to load metadata
            if (metadataURI.startsWith('data:application/json')) {
              try {
                const base64Data = metadataURI.split(',')[1];
                const jsonStr = atob(base64Data);
                metadata[i.toString()] = JSON.parse(jsonStr);
              } catch (e) {
                console.error(`Failed to parse metadata for agent ${i}:`, e);
              }
            }

            // Load reputation
            try {
              const [totalFeedback, positiveCount, averageRating] = await reputationContract.getReputation(i);
              stats[i.toString()] = {
                reputation: Number(averageRating) / 10,
                validations: 0,
              };
            } catch (e) {
              stats[i.toString()] = { reputation: 0, validations: 0 };
            }

            // Load validations count
            try {
              const validationIds = await validationContract.getAgentValidations(i);
              stats[i.toString()].validations = validationIds.length;
            } catch (e) {
              // Keep default 0
            }
          }
        } catch (error) {
          // Agent doesn't exist, stop loading
          break;
        }
      }

      setAgents(loadedAgents);
      setAgentMetadata(metadata);
      setAgentStats(stats);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAgents = () => {
    if (!searchTerm.trim()) {
      setFilteredAgents(agents);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = agents.filter((agent) => {
      const metadata = agentMetadata[agent.tokenId];
      return (
        agent.tokenId.includes(term) ||
        agent.owner.toLowerCase().includes(term) ||
        metadata?.name?.toLowerCase().includes(term) ||
        metadata?.description?.toLowerCase().includes(term) ||
        metadata?.capabilities?.some((cap) => cap.toLowerCase().includes(term))
      );
    });

    setFilteredAgents(filtered);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading AI agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search agents by name, capabilities, or owner..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
        </div>
        <button className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-primary-900 dark:text-primary-100">
            {agents.length}
          </div>
          <div className="text-sm text-primary-700 dark:text-primary-300">
            Total Agents
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-900 dark:text-green-100">
            {Object.values(agentStats).reduce((sum, s) => sum + s.validations, 0)}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            Total Validations
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
            {agents.length > 0
              ? (Object.values(agentStats).reduce((sum, s) => sum + s.reputation, 0) / agents.length).toFixed(1)
              : '0.0'}
          </div>
          <div className="text-sm text-yellow-700 dark:text-yellow-300">
            Avg Reputation
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      {filteredAgents.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No agents found' : 'No agents registered yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Be the first to register an AI agent!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.tokenId}
              agent={agent}
              metadata={agentMetadata[agent.tokenId]}
              reputationScore={agentStats[agent.tokenId]?.reputation || 0}
              validationCount={agentStats[agent.tokenId]?.validations || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
