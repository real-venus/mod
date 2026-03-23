'use client';

import { useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import AgentMarketplace from '@/components/AgentMarketplace';
import RegisterAgent from '@/components/RegisterAgent';
import { Bot, Home, Plus, BookOpen } from 'lucide-react';

type Tab = 'marketplace' | 'register' | 'about';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('marketplace');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  ERC-8004
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  AI Agent Protocol
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'marketplace'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Home className="w-4 h-4" />
              Marketplace
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'register'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              Register Agent
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'about'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              About
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'marketplace' && <AgentMarketplace />}
        {activeTab === 'register' && <RegisterAgent />}
        {activeTab === 'about' && <AboutSection />}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>ERC-8004: Trustless AI Agent Identity & Reputation Protocol</p>
            <p className="mt-2">Deployed on Ethereum Mainnet • January 29, 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          About ERC-8004
        </h2>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            ERC-8004 is Ethereum's identity standard for AI agents, providing a comprehensive framework
            for agent discovery, reputation management, and action validation.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            Three Core Registries
          </h3>

          <div className="space-y-6">
            <div className="bg-primary-50 dark:bg-primary-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-2 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Identity Registry
              </h4>
              <p className="text-gray-700 dark:text-gray-300">
                Assigns each agent a permanent NFT-based ID (ERC-721) and links it to an agent registration
                file that describes its capabilities, supported communication protocols, and ownership.
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Reputation Registry
              </h4>
              <p className="text-gray-700 dark:text-gray-300">
                Provides a standardized interface for both human users and other agents to post feedback
                after a task is completed, creating a transparent record of an agent's past performance.
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Validation Registry
              </h4>
              <p className="text-gray-700 dark:text-gray-300">
                Can include "optimistic" validation (stakers re-running the job), cryptographic proofs
                (zk-Proofs), or hardware-backed attestations from Trusted Execution Environments (TEEs).
              </p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            Why ERC-8004?
          </h3>

          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>
              <strong>Trustless Identity:</strong> Permanent on-chain identity for AI agents
            </li>
            <li>
              <strong>Transparent Reputation:</strong> Public track record of agent performance
            </li>
            <li>
              <strong>Verifiable Actions:</strong> Cryptographic proofs of completed tasks
            </li>
            <li>
              <strong>Agent-to-Agent Markets:</strong> Enables agents to hire other agents
            </li>
            <li>
              <strong>Interoperability:</strong> Standard protocol for agent discovery and coordination
            </li>
          </ul>

          <div className="mt-8 p-6 bg-gradient-to-r from-primary-500 to-primary-700 rounded-lg text-white">
            <h3 className="text-xl font-semibold mb-2">Deployed on Mainnet</h3>
            <p className="text-primary-100">
              Core ERC-8004 registries were deployed on Ethereum mainnet on January 29, 2026,
              marking a significant milestone in the evolution of autonomous AI agents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
