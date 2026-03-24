"use client";

import { useState } from 'react'
import { Code, Globe, Zap } from 'lucide-react'
import ApiPanel from './panels/ApiPanel'
import AppPanel from './panels/AppPanel'
import CodePanel from './panels/CodePanel'

export interface ModuleData {
  name: string
  key: string
  schema?: Record<string, any>
  url_app?: string
  content?: Record<string, string> | string
  [key: string]: any
}

export interface UnifiedInterfaceProps {
  mod: ModuleData
  client?: any
  defaultTab?: 'api' | 'app' | 'code'
}

const tabs = [
  { id: 'api', label: 'API', icon: Zap },
  { id: 'app', label: 'App', icon: Globe },
  { id: 'code', label: 'Code', icon: Code },
] as const

export default function UnifiedInterface({
  mod,
  client,
  defaultTab = 'api'
}: UnifiedInterfaceProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)

  // Determine available tabs based on module data
  const availableTabs = tabs.filter(tab => {
    if (tab.id === 'api') return mod.schema && Object.keys(mod.schema).length > 0
    if (tab.id === 'app') return !!mod.url_app
    if (tab.id === 'code') return !!mod.content
    return false
  })

  // If current tab is not available, switch to first available
  if (!availableTabs.find(t => t.id === activeTab) && availableTabs.length > 0) {
    setActiveTab(availableTabs[0].id)
  }

  if (availableTabs.length === 0) {
    return (
      <div
        className="min-h-[400px] flex items-center justify-center font-mono"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '4px solid var(--border-strong)',
          color: 'var(--text-tertiary)'
        }}
      >
        <div className="text-center">
          <p className="text-sm uppercase tracking-wider">
            ▸ No interface data available
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Module has no API, app, or code to display
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="font-mono" style={{ fontFamily: 'var(--font-digital), monospace' }}>
      {/* Tab Navigation */}
      <div
        className="flex items-center gap-3 border-b-4 pb-3 mb-6"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-6 py-3 text-base font-bold uppercase tracking-wider transition-all border-4 flex items-center gap-2"
              style={
                isActive
                  ? {
                      color: 'var(--bg-primary)',
                      backgroundColor: 'var(--text-primary)',
                      borderColor: 'var(--text-primary)',
                      fontFamily: 'var(--font-digital)',
                    }
                  : {
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-color)',
                      fontFamily: 'var(--font-digital)',
                    }
              }
            >
              <Icon className="w-4 h-4" />
              ▸ {tab.label.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div
        className="min-h-[400px] p-6 border-4"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-strong)',
        }}
      >
        {activeTab === 'api' && <ApiPanel mod={mod} client={client} />}
        {activeTab === 'app' && <AppPanel mod={mod} />}
        {activeTab === 'code' && <CodePanel mod={mod} client={client} />}
      </div>

      {/* Keyboard Shortcuts Info */}
      <div
        className="mt-3 px-3 py-2 text-xs"
        style={{
          color: 'var(--text-tertiary)',
          border: '1px solid var(--border-color)'
        }}
      >
        <span>Tip: Use </span>
        {availableTabs.map((tab, idx) => (
          <span key={tab.id}>
            <kbd
              className="px-2 py-0.5 mx-1"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '2px',
                fontFamily: 'monospace'
              }}
            >
              Cmd+{idx + 1}
            </kbd>
            for {tab.label}
            {idx < availableTabs.length - 1 && ', '}
          </span>
        ))}
      </div>
    </div>
  )
}
