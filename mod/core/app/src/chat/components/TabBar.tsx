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
      <div className="flex gap-0 rounded-2xl backdrop-blur-sm border p-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border-2 ${
            activeTab === 'params'
              ? 'bg-transparent shadow-lg'
              : 'border-transparent'
          }`}
          style={{
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            letterSpacing: '-0.01em',
            color: activeTab === 'params' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderColor: activeTab === 'params' ? 'var(--border-strong)' : 'transparent',
          }}
        >
          📥 PARAMS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outputs')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border-2 ${
            activeTab === 'outputs'
              ? 'bg-transparent shadow-lg'
              : 'border-transparent'
          }`}
          style={{
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            letterSpacing: '-0.01em',
            color: activeTab === 'outputs' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderColor: activeTab === 'outputs' ? 'var(--border-strong)' : 'transparent',
          }}
        >
          <span className="flex items-center gap-2">
            📤 OUTPUTS
            {pendingCount > 0 && (
              <span className="text-xs font-bold rounded-full min-w-[22px] h-5 px-1.5 flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                {pendingCount}
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
