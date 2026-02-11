"use client";

import { useState, useEffect } from 'react'
import { PlusCircleIcon, DocumentDuplicateIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import CreateModule from './components/CreateModule'
import ForkModuleEnhanced from './components/ForkModuleEnhanced'
import EditModuleSelector from './components/EditModuleSelector'
import { userContext } from '@/context/UserContext'
import { text2color } from '@/utils'

type Tab = 'create' | 'fork' | 'edit'

export default function BuidlPage() {
  const { user } = userContext()
  const [activeTab, setActiveTab] = useState<Tab>('create')
  const userColor = user?.key ? text2color(user.key) : '#a855f7'

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'create', label: 'CREATE', icon: PlusCircleIcon },
    { id: 'fork', label: 'FORK', icon: DocumentDuplicateIcon },
    { id: 'edit', label: 'EDIT', icon: PencilSquareIcon },
  ]

  return (
    <div className="min-h-screen bg-black pt-20 pb-4 px-4 flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-4">
        {/* Tab Navigation - Moved to top */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center justify-center gap-3 py-4 px-6 border-2 transition-all font-bold text-sm tracking-wider uppercase rounded-lg"
                style={{
                  backgroundColor: isActive ? `${userColor}20` : 'rgba(0,0,0,0.4)',
                  borderColor: isActive ? userColor : 'rgba(115, 115, 115, 0.3)',
                  color: isActive ? userColor : '#737373',
                  fontFamily: 'IBM Plex Mono, Courier New, monospace',
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content - Clean container */}
        <div className="flex-1 border-2 border-neutral-800/50 bg-gradient-to-br from-neutral-950 via-black to-neutral-950 rounded-lg overflow-hidden shadow-2xl">
          {activeTab === 'create' && <CreateModule />}
          {activeTab === 'fork' && <ForkModuleEnhanced />}
          {activeTab === 'edit' && <EditModuleSelector />}
        </div>
      </div>
    </div>
  )
}
