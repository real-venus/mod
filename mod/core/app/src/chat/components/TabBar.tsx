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
    <div className="flex-shrink-0 flex gap-3 items-center justify-between">
      {/* Tabs */}
      <div className="flex gap-1.5 p-1.5 rounded-2xl bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/50">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'chat'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
        >
          💬 CHAT
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'params'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
        >
          ⚙️ PARAMS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'code'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
        >
          💻 CODE
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('txs')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'txs'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
          }`}
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
        >
          <span className="flex items-center gap-2">
            📊 TXS
            {pendingCount > 0 && (
              <span className="bg-white text-black text-xs font-bold rounded-full min-w-[22px] h-5 px-1.5 flex items-center justify-center shadow-sm">
                {pendingCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Send/Cancel button */}
      <div className="flex gap-2">
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3.5 text-base font-semibold rounded-2xl bg-white/10 text-white hover:bg-white/15 transition-all border border-white/10 shadow-lg flex items-center gap-3 transform hover:scale-[1.02] active:scale-98"
            style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
          >
            <span className="text-xl">⏹</span>
            <span>CANCEL</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            className="px-12 py-4.5 text-lg font-semibold rounded-2xl bg-white text-black hover:bg-neutral-100 transition-all shadow-[0_4px_16px_rgba(255,255,255,0.15)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
            disabled={!canSubmit}
            style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
          >
            <span className="text-2xl">⚡</span>
            <span>SEND</span>
          </button>
        )}
      </div>
    </div>
  )
}
