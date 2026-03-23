'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getIdentityContract } from '@/lib/ethereum';
import { AgentIdentity, AgentMetadata } from '@/types/erc8004';
import WalletConnect from '@/components/WalletConnect';
import ReputationPanel from '@/components/ReputationPanel';
import ValidationPanel from '@/components/ValidationPanel';
import { Bot, ArrowLeft, ExternalLink, Globe, Code, Loader2 } from 'lucide-react';
import Link from 'next/link';

type TabType = 'overview' | 'reputation' | 'validation';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentIdentity | null>(null);
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  const loadAgent = async () => {
    setIsLoading(true);
    try {
      const contract = getIdentityContract();
      const [owner, metadataURI, createdAt] = await contract.getAgentIdentity(agentId);

      if (owner === '0x0000000000000000000000000000000000000000') {
        throw new Error('Agent not found');
      }

      const agentData: AgentIdentity = {
        tokenId: agentId,
        owner,
        metadataURI,
        capabilities: [],
        protocols: [],
        createdAt: Number(createdAt),
      };

      setAgent(agentData);

      // Load metadata
      if (metadataURI.startsWith('data:application/json')) {
        try {
          const base64Data = metadataURI.split(',')[1];
          const jsonStr = atob(base64Data);
          const meta = JSON.parse(jsonStr);
          setMetadata(meta);
        } catch (e) {
          console.error('Failed to parse metadata:', e);
        }
      }
    } catch (error) {
      console.error('Error loading agent:', error);
      alert('Failed to load agent. It may not exist.');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading agent...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Agent Not Found
          </h2>
          <Link href="/" className="text-primary-600 hover:underline">
            Return to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {metadata?.name || `Agent #${agentId}`}
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Token ID: {agentId}
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Agent Header */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              {metadata?.avatar ? (
                <img
                  src={metadata.avatar}
                  alt={metadata.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <Bot className="w-12 h-12" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">
                {metadata?.name || `Agent #${agentId}`}
              </h2>
              <p className="text-primary-100 mb-4">
                {metadata?.description || 'No description available'}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-primary-200">Owner:</span>
                  <span className="font-mono">
                    {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary-200">Version:</span>
                  <span>{metadata?.version || '1.0.0'}</span>
                </div>
                {metadata?.endpoint && (
                  <a
                    href={metadata.endpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Globe className="w-4 h-4" />
                    Endpoint
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('reputation')}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'reputation'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Reputation
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'validation'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Validation
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Description
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {metadata?.description || 'No description available'}
                </p>
              </div>

              {metadata?.capabilities && metadata.capabilities.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Capabilities
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {metadata.capabilities.map((cap, index) => (
                      <span
                        key={index}
                        className="px-3 py-2 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-lg text-sm font-medium"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {metadata?.communicationProtocols && metadata.communicationProtocols.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Communication Protocols
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {metadata.communicationProtocols.map((proto, index) => (
                      <span
                        key={index}
                        className="px-3 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg text-sm font-medium"
                      >
                        {proto}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Details
                </h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-600 dark:text-gray-400">Token ID</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">{agentId}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600 dark:text-gray-400">Owner</dt>
                    <dd className="font-mono text-gray-900 dark:text-white break-all">
                      {agent.owner}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-600 dark:text-gray-400">Created</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {new Date(agent.createdAt * 1000).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-600 dark:text-gray-400">Version</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {metadata?.version || 'Unknown'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reputation' && <ReputationPanel agentId={agentId} />}
        {activeTab === 'validation' && <ValidationPanel agentId={agentId} />}
      </main>
    </div>
  );
}
