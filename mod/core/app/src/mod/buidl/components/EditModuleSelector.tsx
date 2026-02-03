'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import ModEdit from '@/mod/mod/edit/ModEdit'
import { Loader2, PencilIcon } from 'lucide-react'

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  blue: '#3b82f6',
}

export default function EditModuleSelector() {
  const { client, user } = userContext()
  const [modules, setModules] = useState<any[]>([])
  const [selectedModule, setSelectedModule] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserModules = async () => {
      if (!client || !user?.key) return
      
      setLoading(true)
      try {
        const result = await client.call('call', {
          fn: 'api/user',
          params: { key: user.key },
          url: 'api'
        })
        
        if (result?.mods) {
          setModules(result.mods)
        }
      } catch (err) {
        console.error('Failed to fetch user modules:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserModules()
  }, [client, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ui.blue }} />
      </div>
    )
  }

  if (selectedModule) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedModule(null)}
          className="px-4 py-2 rounded-lg border-2 font-bold transition-all"
          style={{
            backgroundColor: `${ui.blue}20`,
            borderColor: ui.blue,
            color: ui.blue
          }}
        >
          ← Back to Module Selection
        </button>
        <ModEdit mod={selectedModule} />
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="text-center p-8" style={{ color: ui.textDim }}>
        <p>No modules found. Create a module first!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p style={{ color: ui.textDim }}>Select a module to edit:</p>
      <div className="grid grid-cols-1 gap-4">
        {modules.map((mod) => (
          <button
            key={mod.key}
            onClick={() => setSelectedModule(mod)}
            className="p-4 rounded-lg border-2 text-left transition-all hover:scale-105"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold" style={{ color: ui.blue }}>{mod.name}</h3>
                <p className="text-sm" style={{ color: ui.textDim }}>Key: {mod.key?.slice(0, 16)}...</p>
              </div>
              <PencilIcon className="w-6 h-6" style={{ color: ui.blue }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
