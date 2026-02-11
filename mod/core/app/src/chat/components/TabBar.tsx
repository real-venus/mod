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
  pendingCount = 0
}: TabBarProps) {
  return (
    <div className="flex-shrink-0">
      {/* Tabs - Full width */}
      <div className="flex gap-0 rounded-2xl bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/50 p-1 overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('inputs')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'inputs'
              ? 'bg-transparent text-white border-2 border-white shadow-lg'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-2 border-transparent'
          }`}
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
        >
          📥 INPUTS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outputs')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'outputs'
              ? 'bg-transparent text-white border-2 border-white shadow-lg'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-2 border-transparent'
          }`}
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
        >
          <span className="flex items-center gap-2">
            📤 OUTPUTS
            {pendingCount > 0 && (
              <span className="bg-white text-black text-xs font-bold rounded-full min-w-[22px] h-5 px-1.5 flex items-center justify-center shadow-sm">
                {pendingCount}
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
