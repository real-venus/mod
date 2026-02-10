"use client";

import type { TabType } from '../types'

interface TabBarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  isLoading: boolean
  onSubmit: () => void
  onCancel: () => void
  canSubmit: boolean
  pendingCount?: number
  hasCode?: boolean
}

/**
 * Tab navigation bar with Send/Cancel button
 */
export function TabBar({
  activeTab,
  setActiveTab,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  pendingCount = 0,
  hasCode = false
}: TabBarProps) {
  return (
    <div className="flex-shrink-0 flex gap-2 items-center justify-between pb-3 mb-3">
      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-black/60 border border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
            activeTab === 'chat'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
        >
          💬 Chat
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
            activeTab === 'params'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
        >
          ⚙️ Params
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('txs')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
            activeTab === 'txs'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            📊 TXS
            {pendingCount > 0 && (
              <span className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-black text-xs font-black rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center border-2 border-white shadow-lg">
                {pendingCount}
              </span>
            )}
          </span>
        </button>

        {hasCode && (
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
              activeTab === 'code'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
          >
            💻 Code
          </button>
        )}
      </div>

      {/* Send/Cancel button */}
      <div className="flex gap-2">
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-4 text-lg font-black rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all border-2 border-red-400/50 shadow-lg shadow-red-500/30 flex items-center gap-3 uppercase tracking-wide transform hover:scale-105 active:scale-95"
          >
            <span className="animate-pulse text-2xl">⏹</span>
            <span>Cancel</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            className="px-8 py-4 text-lg font-black rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 transition-all border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 uppercase tracking-wide transform hover:scale-105 active:scale-95"
            disabled={!canSubmit}
          >
            <span className="text-2xl">⚡</span>
            <span>Send</span>
          </button>
        )}
      </div>
    </div>
  )
}
