'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

type TabType = 'mods' | 'sign' | 'transfer' | 'claim' | 'admin' | 'contracts' | 'billing' | 'portfolio' | 'regupdate'

interface Tab {
  id: TabType
  label: string
  color: string
}

interface TabManagerProps {
  userTabs: Tab[]
  onTabsChange: (tabs: Tab[]) => void
  availableTabs: Tab[]
}

export function TabManager({ userTabs, onTabsChange, availableTabs }: TabManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const removeTab = (tabId: TabType) => {
    onTabsChange(userTabs.filter(t => t.id !== tabId))
  }

  const addTab = (tab: Tab) => {
    if (!userTabs.find(t => t.id === tab.id)) {
      onTabsChange([...userTabs, tab])
    }
  }

  const unusedTabs = availableTabs.filter(at => !userTabs.find(ut => ut.id === at.id))
  const filteredTabs = unusedTabs.filter(tab => 
    tab.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 text-white border-2 border-purple-500/40 rounded-xl hover:border-purple-500/60 hover:from-purple-600/30 hover:to-cyan-600/30 transition-all font-bold uppercase text-sm shadow-lg hover:shadow-purple-500/20 backdrop-blur-sm"
        style={{
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)'
        }}
      >
        ⚙️ Manage Tabs
      </button>

      {isOpen && (
        <div className="mt-4 p-6 bg-black/95 border-2 border-purple-500/50 rounded-xl backdrop-blur-xl shadow-2xl" style={{
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)'
        }}>
          <h3 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Active Tabs</h3>
          <div className="flex flex-wrap gap-3 mb-6">
            {userTabs.map(tab => (
              <div
                key={tab.id}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border-2 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
                style={{
                  borderColor: `${tab.color}60`,
                  boxShadow: `0 0 15px ${tab.color}30`
                }}
              >
                <span className="font-bold uppercase text-sm" style={{ color: tab.color }}>{tab.label}</span>
                <button
                  onClick={() => removeTab(tab.id)}
                  className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-500/20 rounded-lg"
                  title="Remove tab"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {unusedTabs.length > 0 && (
            <>
              <h3 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">Available Tabs</h3>
              
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tabs..."
                  className="w-full px-4 py-3 pl-12 bg-black/50 border-2 border-cyan-500/40 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/60 transition-all"
                  style={{
                    boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)'
                  }}
                />
                <MagnifyingGlassIcon className="w-5 h-5 text-cyan-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex flex-wrap gap-3">
                {filteredTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => addTab(tab)}
                    className="flex items-center gap-2 px-5 py-3 bg-black/50 border-2 rounded-xl hover:scale-105 transition-all"
                    style={{
                      borderColor: `${tab.color}40`,
                      boxShadow: `0 0 10px ${tab.color}20`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${tab.color}80`
                      e.currentTarget.style.boxShadow = `0 0 20px ${tab.color}40`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${tab.color}40`
                      e.currentTarget.style.boxShadow = `0 0 10px ${tab.color}20`
                    }}
                  >
                    <span className="font-bold uppercase text-sm" style={{ color: `${tab.color}90` }}>{tab.label}</span>
                    <PlusIcon className="w-5 h-5" style={{ color: tab.color }} />
                  </button>
                ))}
              </div>
              
              {filteredTabs.length === 0 && searchTerm && (
                <div className="text-center text-gray-400 py-4">No tabs found matching "{searchTerm}"</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}