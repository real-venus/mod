"use client";

import { FunctionSelector } from './FunctionSelector'
import type { Module, ModuleSchema, TabType } from '../types'

interface UnifiedControlBarProps {
  // Function control
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  fetchedSchemas?: Map<string, ModuleSchema>

  // Tabs
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  pendingCount?: number
}

/**
 * Unified control bar combining function selector and tabs
 * Function selector takes 1/3 width, tabs take 2/3 width
 * IBM-style ASCII terminal aesthetics
 */
export function UnifiedControlBar({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  fetchedSchemas,
  activeTab,
  setActiveTab,
  pendingCount = 0
}: UnifiedControlBarProps) {

  return (
    <div className="flex-shrink-0">
      {/* Function Selector (1/3) + Tabs (2/3) in same row */}
      <div
        className="relative rounded-lg overflow-visible"
        style={{
          fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
        }}
      >
        <div className="flex gap-3 items-stretch p-1">
          {/* Function Selector - 1/3 width */}
          <div className="w-1/3 relative flex items-stretch">
            <FunctionSelector
              selectedModules={selectedModules}
              selectedFunction={selectedFunction}
              setSelectedFunction={setSelectedFunction}
              fetchedSchemas={fetchedSchemas}
            />
          </div>

          {/* Tab Navigation - Full width */}
          <div className="flex-1 flex gap-0 p-0">
          {/* CHAT Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative rounded-2xl border-2 ${
              activeTab === 'chat'
                ? 'text-green-500 border-green-500'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em',
              minHeight: '64px',
              backgroundColor: activeTab === 'chat' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'chat' ? undefined : 'var(--text-tertiary)',
            }}
          >
            {activeTab === 'chat' && (
              <>
                <span className="absolute top-0 left-0 text-green-500 text-[8px] leading-none p-0.5">┌</span>
                <span className="absolute top-0 right-0 text-green-500 text-[8px] leading-none p-0.5">┐</span>
                <span className="absolute bottom-0 left-0 text-green-500 text-[8px] leading-none p-0.5">└</span>
                <span className="absolute bottom-0 right-0 text-green-500 text-[8px] leading-none p-0.5">┘</span>
              </>
            )}
            <span>💬</span>
            <span>CHAT</span>
          </button>

          {/* PARAMS Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative rounded-2xl border-2 ${
              activeTab === 'params'
                ? 'border-current'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em',
              minHeight: '64px',
              backgroundColor: activeTab === 'params' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'params' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderColor: activeTab === 'params' ? 'var(--border-strong)' : 'transparent',
            }}
          >
            {activeTab === 'params' && (
              <>
                <span className="absolute top-0 left-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┌</span>
                <span className="absolute top-0 right-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┐</span>
                <span className="absolute bottom-0 left-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>└</span>
                <span className="absolute bottom-0 right-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┘</span>
              </>
            )}
            <span>📋</span>
            <span>PARAMS</span>
          </button>

          {/* CODE Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative rounded-2xl border-2 ${
              activeTab === 'code'
                ? 'border-current'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em',
              minHeight: '64px',
              backgroundColor: activeTab === 'code' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'code' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderColor: activeTab === 'code' ? 'var(--border-strong)' : 'transparent',
            }}
          >
            {activeTab === 'code' && (
              <>
                <span className="absolute top-0 left-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┌</span>
                <span className="absolute top-0 right-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┐</span>
                <span className="absolute bottom-0 left-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>└</span>
                <span className="absolute bottom-0 right-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┘</span>
              </>
            )}
            <span>💻</span>
            <span>CODE</span>
          </button>

          {/* OUTPUTS Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('outputs')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative rounded-2xl border-2 ${
              activeTab === 'outputs'
                ? 'border-current'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em',
              minHeight: '64px',
              backgroundColor: activeTab === 'outputs' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'outputs' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderColor: activeTab === 'outputs' ? 'var(--border-strong)' : 'transparent',
            }}
          >
            {activeTab === 'outputs' && (
              <>
                <span className="absolute top-0 left-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┌</span>
                <span className="absolute top-0 right-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┐</span>
                <span className="absolute bottom-0 left-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>└</span>
                <span className="absolute bottom-0 right-0 text-[8px] leading-none p-0.5" style={{ color: 'var(--text-secondary)' }}>┘</span>
              </>
            )}
            <span className="flex items-center gap-2">
              <span>📤</span>
              <span>OUTPUTS</span>
              {pendingCount > 0 && (
                <span className="text-[9px] font-black rounded px-1.5 py-0.5 min-w-[18px] text-center" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', border: '1px solid var(--border-strong)' }}>
                  {pendingCount}
                </span>
              )}
            </span>
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
