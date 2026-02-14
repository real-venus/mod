"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CubeIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  WrenchScrewdriverIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  content: string[];
}

const sections: DocSection[] = [
  {
    id: 'what-is-mod',
    title: 'What is Mod?',
    icon: CubeIcon,
    color: '#a78bfa',
    content: [
      'Mod is a modular platform for building, deploying, and composing AI-powered modules on-chain.',
      'It combines a module registry, an AI chat interface, a multi-chain wallet, and a quest system into one unified experience.',
      'Modules are self-contained units of logic — functions, APIs, smart contracts, or AI agents — that can be created, forked, and composed together.',
    ],
  },
  {
    id: 'modules',
    title: 'Modules',
    icon: WrenchScrewdriverIcon,
    color: '#10b981',
    content: [
      'Modules are the core building blocks of Mod. Each module encapsulates a specific capability — from simple utility functions to full AI agents.',
      'You can browse existing modules in the Explore page, fork them to customize, or build your own from scratch in the Build page.',
      'Modules support versioning, tagging, and dependency management so you can compose complex workflows from simple parts.',
    ],
  },
  {
    id: 'chat',
    title: 'AI Chat',
    icon: ChatBubbleLeftRightIcon,
    color: '#8b5cf6',
    content: [
      'The Chat interface lets you interact with AI models and invoke modules through natural language.',
      'You can test your modules, chain function calls, and build conversational workflows all from the chat.',
      'Chat sessions persist so you can pick up where you left off and iterate on your module integrations.',
    ],
  },
  {
    id: 'network',
    title: 'Multi-Chain Network',
    icon: GlobeAltIcon,
    color: '#3b82f6',
    content: [
      'Mod supports multiple EVM-compatible chains including Ethereum, Base, Polygon, Arbitrum, Optimism, and Avalanche.',
      'Non-EVM chains like Solana and Sui are on the roadmap.',
      'The Network page lets you monitor chain status, view RPC endpoints, and switch between networks.',
    ],
  },
  {
    id: 'wallet',
    title: 'Wallet & Keys',
    icon: ShieldCheckIcon,
    color: '#f59e0b',
    content: [
      'Mod includes a built-in wallet that supports MetaMask and local key management.',
      'You can manage tokens, view balances, and sign transactions directly within the platform.',
      'The key manager lets you generate and store keys locally for development and testing.',
    ],
  },
  {
    id: 'quests',
    title: 'Quests & Rewards',
    icon: BoltIcon,
    color: '#0bf58c',
    content: [
      'Quests are structured challenges that guide you through learning and building on Mod.',
      'Complete quests to earn rewards, unlock new capabilities, and climb the leaderboard.',
      'Quests range from beginner tutorials to advanced module-building challenges.',
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: ArrowsRightLeftIcon,
    color: '#ec4899',
    content: [
      'Mod is built with a Next.js frontend, a Python backend server handling auth and module orchestration, and on-chain smart contracts for the module registry.',
      'The frontend communicates with the backend via REST APIs and WebSocket connections for real-time updates.',
      'Modules are executed in sandboxed environments and their outputs are validated before being committed on-chain.',
    ],
  },
];

export default function DocsPage() {
  const [expandedId, setExpandedId] = useState<string | null>('what-is-mod');

  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-black uppercase tracking-wider mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
            Documentation
          </h1>
          <p className="text-gray-400 font-mono">Learn what Mod is and how it works</p>
        </div>

        <div className="space-y-4">
          {sections.map((section, index) => {
            const Icon = section.icon;
            const isExpanded = expandedId === section.id;

            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border-2 overflow-hidden backdrop-blur-xl"
                style={{
                  borderColor: isExpanded ? `${section.color}70` : `${section.color}30`,
                  backgroundColor: isExpanded ? `${section.color}08` : 'rgba(255,255,255,0.02)',
                  boxShadow: isExpanded ? `0 0 30px ${section.color}20` : 'none',
                }}
              >
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center gap-4 p-5 text-left transition-all hover:bg-white/5"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg border"
                    style={{
                      borderColor: `${section.color}50`,
                      backgroundColor: `${section.color}15`,
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: section.color }} />
                  </div>
                  <h2
                    className="flex-1 text-lg font-black uppercase tracking-wider"
                    style={{ color: section.color }}
                  >
                    {section.title}
                  </h2>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <div className="px-5 pb-5 space-y-3">
                        {section.content.map((paragraph, idx) => (
                          <motion.p
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="text-sm text-gray-300 leading-relaxed pl-14"
                          >
                            {paragraph}
                          </motion.p>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
