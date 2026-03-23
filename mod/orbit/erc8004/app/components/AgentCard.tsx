'use client';

import { AgentIdentity, AgentMetadata } from '@/types/erc8004';
import { Bot, Star, Shield, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AgentCardProps {
  agent: AgentIdentity;
  metadata?: AgentMetadata;
  reputationScore?: number;
  validationCount?: number;
}

export default function AgentCard({ agent, metadata, reputationScore = 0, validationCount = 0 }: AgentCardProps) {
  return (
    <Link
      href={`/agent/${agent.tokenId}`}
      className="block bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-all hover:shadow-lg"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
          {metadata?.avatar ? (
            <img src={metadata.avatar} alt={metadata.name} className="w-full h-full rounded-lg object-cover" />
          ) : (
            <Bot className="w-6 h-6 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {metadata?.name || `Agent #${agent.tokenId}`}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {metadata?.description || 'No description available'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1 text-sm">
          <Star className="w-4 h-4 text-yellow-500 fill-current" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {reputationScore.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Shield className="w-4 h-4 text-green-500" />
          <span className="text-gray-600 dark:text-gray-400">
            {validationCount} proofs
          </span>
        </div>
      </div>

      {/* Capabilities */}
      {metadata?.capabilities && metadata.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {metadata.capabilities.slice(0, 3).map((cap, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded text-xs font-medium"
            >
              {cap}
            </span>
          ))}
          {metadata.capabilities.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
              +{metadata.capabilities.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Owner */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Owner: {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400" />
      </div>
    </Link>
  );
}
