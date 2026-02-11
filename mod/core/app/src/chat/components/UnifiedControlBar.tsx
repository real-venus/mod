"use client";

import { FunctionSelector } from './FunctionSelector'
import type { Module, ModuleSchema, TabType } from '../types'

interface UnifiedControlBarProps {
  // Function control
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  fetchedSchemas?: Map<string, ModuleSchema>

  // Action buttons
  isLoading: boolean
  onSubmit: () => void
  onCancel: () => void
  canSubmit: boolean

  // Tabs
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  pendingCount?: number
}

/**
 * Unified control bar combining function selector, tabs, and action button
 * IBM-style ASCII terminal aesthetics
 */
export function UnifiedControlBar({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  fetchedSchemas,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  activeTab,
  setActiveTab,
  pendingCount = 0
}: UnifiedControlBarProps) {
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSubmit()
  }

  return (
    <div className="flex-shrink-0 flex flex-col gap-3">
      {/* ┌─ Function Selector + Action Button ─┐ */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
          background: 'linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)',
        }}
      >
        {/* ASCII top border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

        <div className="flex gap-3 items-stretch p-3 border border-neutral-700/50">
          {/* Function Selector */}
          <div className="flex-1 relative">
            <div className="absolute -top-1 -left-1 text-neutral-600 text-xs leading-none select-none">┌─</div>
            <div className="absolute -top-1 -right-1 text-neutral-600 text-xs leading-none select-none">─┐</div>
            <div className="absolute -bottom-1 -left-1 text-neutral-600 text-xs leading-none select-none">└─</div>
            <div className="absolute -bottom-1 -right-1 text-neutral-600 text-xs leading-none select-none">─┘</div>

            <FunctionSelector
              selectedModules={selectedModules}
              selectedFunction={selectedFunction}
              setSelectedFunction={setSelectedFunction}
              fetchedSchemas={fetchedSchemas}
            />
          </div>

          {/* Send/Stop Button */}
          <div className="flex-shrink-0 relative">
            {isLoading ? (
              <button
                type="button"
                onClick={onCancel}
                className="h-full px-8 text-sm font-bold uppercase tracking-widest rounded border-2 border-red-600 bg-red-950/40 text-red-400 hover:bg-red-900/60 hover:text-red-300 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  minHeight: '56px',
                  letterSpacing: '0.15em'
                }}
              >
                <span className="absolute inset-0 bg-red-600/10 group-hover:bg-red-600/20 transition-all" />
                <span className="text-xl relative z-10">■</span>
                <span className="relative z-10">STOP</span>
                {/* ASCII corner brackets */}
                <span className="absolute top-0 left-0 text-red-600/60 text-xs leading-none p-0.5">┌</span>
                <span className="absolute top-0 right-0 text-red-600/60 text-xs leading-none p-0.5">┐</span>
                <span className="absolute bottom-0 left-0 text-red-600/60 text-xs leading-none p-0.5">└</span>
                <span className="absolute bottom-0 right-0 text-red-600/60 text-xs leading-none p-0.5">┘</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleButtonClick}
                disabled={!canSubmit}
                className="h-full px-8 text-sm font-bold uppercase tracking-widest rounded border-2 border-yellow-600 bg-yellow-950/40 text-yellow-400 hover:bg-yellow-900/60 hover:text-yellow-300 disabled:border-neutral-700 disabled:bg-neutral-900/40 disabled:text-neutral-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  minHeight: '56px',
                  letterSpacing: '0.15em'
                }}
              >
                <span className="absolute inset-0 bg-yellow-600/10 group-hover:bg-yellow-600/20 disabled:group-hover:bg-transparent transition-all" />
                <span className="text-xl relative z-10">⚡</span>
                <span className="relative z-10">SEND</span>
                {/* ASCII corner brackets */}
                <span className="absolute top-0 left-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">┌</span>
                <span className="absolute top-0 right-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">┐</span>
                <span className="absolute bottom-0 left-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">└</span>
                <span className="absolute bottom-0 right-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">┘</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ┌─ Tab Navigation ─┐ */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
          background: 'linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)',
        }}
      >
        {/* ASCII border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

        <div className="flex gap-0 border border-neutral-700/50 p-1">
          {/* CHAT Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'chat'
                ? 'bg-black text-green-400 border-2 border-green-500'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/30 border-2 border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em'
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
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'params'
                ? 'bg-black text-white border-2 border-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/30 border-2 border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em'
            }}
          >
            {activeTab === 'params' && (
              <>
                <span className="absolute top-0 left-0 text-white text-[8px] leading-none p-0.5">┌</span>
                <span className="absolute top-0 right-0 text-white text-[8px] leading-none p-0.5">┐</span>
                <span className="absolute bottom-0 left-0 text-white text-[8px] leading-none p-0.5">└</span>
                <span className="absolute bottom-0 right-0 text-white text-[8px] leading-none p-0.5">┘</span>
              </>
            )}
            <span>📋</span>
            <span>PARAMS</span>
          </button>

          {/* CODE Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'code'
                ? 'bg-black text-white border-2 border-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/30 border-2 border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em'
            }}
          >
            {activeTab === 'code' && (
              <>
                <span className="absolute top-0 left-0 text-white text-[8px] leading-none p-0.5">┌</span>
                <span className="absolute top-0 right-0 text-white text-[8px] leading-none p-0.5">┐</span>
                <span className="absolute bottom-0 left-0 text-white text-[8px] leading-none p-0.5">└</span>
                <span className="absolute bottom-0 right-0 text-white text-[8px] leading-none p-0.5">┘</span>
              </>
            )}
            <span>💻</span>
            <span>CODE</span>
          </button>

          {/* OUTPUTS Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('outputs')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'outputs'
                ? 'bg-black text-white border-2 border-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/30 border-2 border-transparent'
            }`}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.2em'
            }}
          >
            {activeTab === 'outputs' && (
              <>
                <span className="absolute top-0 left-0 text-white text-[8px] leading-none p-0.5">┌</span>
                <span className="absolute top-0 right-0 text-white text-[8px] leading-none p-0.5">┐</span>
                <span className="absolute bottom-0 left-0 text-white text-[8px] leading-none p-0.5">└</span>
                <span className="absolute bottom-0 right-0 text-white text-[8px] leading-none p-0.5">┘</span>
              </>
            )}
            <span className="flex items-center gap-2">
              <span>📤</span>
              <span>OUTPUTS</span>
              {pendingCount > 0 && (
                <span className="bg-white text-black text-[9px] font-black rounded px-1.5 py-0.5 min-w-[18px] text-center border border-white">
                  {pendingCount}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
