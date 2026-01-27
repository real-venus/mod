'use client'
import { useState } from 'react'
import { Plus, Trash2, Link as LinkIcon } from 'lucide-react'

interface TabField {
  label: string
  url: string
}

export const CreateTab = () => {
  const [tabs, setTabs] = useState<TabField[]>([
    { label: '', url: '' }
  ])

  const addTab = () => {
    setTabs([...tabs, { label: '', url: '' }])
  }

  const removeTab = (index: number) => {
    if (tabs.length > 1) {
      setTabs(tabs.filter((_, i) => i !== index))
    }
  }

  const updateTab = (index: number, field: 'label' | 'url', value: string) => {
    const newTabs = [...tabs]
    newTabs[index][field] = value
    setTabs(newTabs)
  }

  const saveTabs = () => {
    const validTabs = tabs.filter(t => t.label && t.url)
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_custom_tabs', JSON.stringify(validTabs))
      alert('Tabs saved successfully!')
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="space-y-5 p-6 rounded-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-2 border-cyan-500/30 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b-2 border-cyan-500/30">
          <h3 className="text-2xl font-black text-cyan-400 font-mono uppercase tracking-wide">
            Create Custom Tabs
          </h3>
          <button
            onClick={addTab}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all flex items-center gap-2 text-sm font-bold"
          >
            <Plus size={16} />
            ADD TAB
          </button>
        </div>

        <div className="space-y-4">
          {tabs.map((tab, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-center p-4 bg-black/40 rounded-lg border border-cyan-500/30">
              <div className="col-span-3">
                <input
                  type="text"
                  value={tab.label}
                  onChange={(e) => updateTab(index, 'label', e.target.value)}
                  placeholder="Tab Label"
                  className="w-full bg-black/60 border border-cyan-500/40 rounded px-3 py-2 text-cyan-300 font-mono text-sm placeholder-cyan-600/50 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="col-span-8">
                <div className="relative">
                  <input
                    type="text"
                    value={tab.url}
                    onChange={(e) => updateTab(index, 'url', e.target.value)}
                    placeholder="https://github.com/user/repo or any URL"
                    className="w-full bg-black/60 border border-cyan-500/40 rounded px-3 py-2 pl-10 text-cyan-300 font-mono text-sm placeholder-cyan-600/50 focus:outline-none focus:border-cyan-500"
                  />
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/70" size={16} />
                </div>
              </div>
              <div className="col-span-1">
                <button
                  onClick={() => removeTab(index)}
                  disabled={tabs.length <= 1}
                  className="w-full p-2 rounded bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={saveTabs}
          className="w-full py-4 border-2 border-cyan-500/60 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-500 hover:scale-[1.02] transition-all duration-300 rounded-xl font-mono uppercase font-black text-lg shadow-lg"
        >
          SAVE TABS
        </button>
      </div>
    </div>
  )
}

export default CreateTab
