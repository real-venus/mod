'use client'

import { useState } from 'react'
import { WrenchScrewdriverIcon, PlusIcon, PencilIcon, CodeBracketIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'
import CreateModule from './components/CreateModule'
import ForkModuleEnhanced from './components/ForkModuleEnhanced'
import EditModuleSelector from './components/EditModuleSelector'

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  purple: '#a855f7',
  green: '#10b981',
  blue: '#3b82f6',
}

export default function BuidlPage() {
  const { user } = userContext()
  const [activeMode, setActiveMode] = useState<'create' | 'edit' | 'fork'>('create')

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: ui.bg }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 rounded-xl border-2" style={{ backgroundColor: ui.panel, borderColor: ui.border }}>
          <WrenchScrewdriverIcon className="w-12 h-12" style={{ color: ui.purple }} />
          <div>
            <h1 className="text-4xl font-black" style={{ color: ui.text }}>BUIDL</h1>
            <p className="text-lg" style={{ color: ui.textDim }}>Create, Edit, and Fork Modules from GitHub</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveMode('create')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 font-bold transition-all ${
              activeMode === 'create' ? 'scale-105' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeMode === 'create' ? `${ui.green}20` : ui.panel,
              borderColor: activeMode === 'create' ? ui.green : ui.border,
              color: activeMode === 'create' ? ui.green : ui.textDim,
            }}
          >
            <PlusIcon className="w-6 h-6" />
            <span>CREATE FROM GITHUB</span>
          </button>

          <button
            onClick={() => setActiveMode('edit')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 font-bold transition-all ${
              activeMode === 'edit' ? 'scale-105' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeMode === 'edit' ? `${ui.blue}20` : ui.panel,
              borderColor: activeMode === 'edit' ? ui.blue : ui.border,
              color: activeMode === 'edit' ? ui.blue : ui.textDim,
            }}
          >
            <PencilIcon className="w-6 h-6" />
            <span>EDIT EXISTING</span>
          </button>

          <button
            onClick={() => setActiveMode('fork')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 font-bold transition-all ${
              activeMode === 'fork' ? 'scale-105' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeMode === 'fork' ? `${ui.purple}20` : ui.panel,
              borderColor: activeMode === 'fork' ? ui.purple : ui.border,
              color: activeMode === 'fork' ? ui.purple : ui.textDim,
            }}
          >
            <CodeBracketIcon className="w-6 h-6" />
            <span>FORK FROM NETWORK</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 rounded-xl border-2" style={{ backgroundColor: ui.panel, borderColor: ui.border }}>
          {activeMode === 'create' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold" style={{ color: ui.green }}>Create Module from GitHub</h2>
              <p style={{ color: ui.textDim }}>Import a GitHub repository as a new module</p>
              <CreateModule />
            </div>
          )}

          {activeMode === 'edit' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold" style={{ color: ui.blue }}>Edit Existing Module</h2>
              <p style={{ color: ui.textDim }}>Select and edit your modules using AI-powered editing</p>
              <EditModuleSelector />
            </div>
          )}

          {activeMode === 'fork' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold" style={{ color: ui.purple }}>Fork Module from Network</h2>
              <p style={{ color: ui.textDim }}>Create a copy of an existing module with custom owner</p>
              <ForkModuleEnhanced />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}