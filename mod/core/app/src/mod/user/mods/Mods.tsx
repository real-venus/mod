'use client'
import { useState } from 'react'
import RegUpdate from '@/mod/user/regupdate/RegUpdate'
import { UserType } from '@/mod/types'

export const Mods = ({ userData }: { userData: UserType }) => {
  const [activeTab, setActiveTab] = useState<'modules' | 'regupdate'>('modules')

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('modules')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeTab === 'modules'
              ? 'bg-purple-500/30 text-purple-300 border-purple-500'
              : 'bg-black/60 text-purple-500/60 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50'
          }`}
        >
          MY MODULES
        </button>
        <button
          onClick={() => setActiveTab('regupdate')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeTab === 'regupdate'
              ? 'bg-green-500/30 text-green-300 border-green-500'
              : 'bg-black/60 text-green-500/60 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50'
          }`}
        >
          REGISTER / UPDATE
        </button>
      </div>

      {activeTab === 'regupdate' && <RegUpdate />}

    </div>
  )
}

export default Mods