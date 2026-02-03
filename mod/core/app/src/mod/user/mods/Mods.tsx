'use client'
import { useState } from 'react'
import { UserType } from '@/mod/types'
import ModCard from '@/mod/mod/ModCard'
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'

export function Mods({ userData }: { userData: UserType }) {
  const { mods } = userData
  const { client } = userContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [updating, setUpdating] = useState(false)

  const filteredMods = mods.filter(mod => 
    mod.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.key?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleUpdateMods = async () => {
    if (!client) return
    setUpdating(true)
    try {
      await client.call('update_mods', {})
      window.location.reload()
    } catch (err) {
      console.error('Failed to update mods:', err)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search my modules..."
            className="w-full px-4 py-3 pl-12 bg-black/60 border-2 border-purple-500/40 rounded-xl text-purple-300 placeholder-purple-600/50 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all font-mono"
          />
          <MagnifyingGlassIcon className="w-5 h-5 text-purple-400 absolute left-4 top-1/2 -translate-y-1/2" />
        </div>
        
        <button
          onClick={handleUpdateMods}
          disabled={updating}
          className="px-6 py-3 bg-purple-500/20 border-2 border-purple-500/40 rounded-xl text-purple-300 hover:bg-purple-500/30 hover:border-purple-500 transition-all font-mono font-bold uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Update all modules"
        >
          <ArrowPathIcon className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
          {updating ? 'Updating...' : 'Update'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredMods.length > 0 ? (
          filteredMods.map((mod) => (
            <ModCard mod={mod} key={mod.key} />
          ))
        ) : (
          <div className="text-center py-12 text-purple-400/60 font-mono">
            {searchTerm ? 'No modules found matching your search' : 'No modules registered yet'}
          </div>
        )}
      </div>
    </div>
  )
}

export default Mods