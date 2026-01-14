'use client'
import { useState } from 'react'
import RegMod from '@/mod/user/reg'
import UpdateMod from '@/mod/user/update'

export const RegUpdate = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'update'>('register')
  const [activeSubTab, setActiveSubTab] = useState<'local' | 'onchain'>('local')

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeTab === 'register'
              ? 'bg-green-500/30 text-green-300 border-green-500'
              : 'bg-black/60 text-green-500/60 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50'
          }`}
        >
          REGISTER
        </button>
        <button
          onClick={() => setActiveTab('update')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeTab === 'update'
              ? 'bg-orange-500/30 text-orange-300 border-orange-500'
              : 'bg-black/60 text-orange-500/60 border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-500/50'
          }`}
        >
          UPDATE
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setActiveSubTab('local')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeSubTab === 'local'
              ? 'bg-blue-500/30 text-blue-300 border-blue-500'
              : 'bg-black/60 text-blue-500/60 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50'
          }`}
        >
          LOCAL (API)
        </button>
        <button
          onClick={() => setActiveSubTab('onchain')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeSubTab === 'onchain'
              ? 'bg-blue-500/30 text-blue-300 border-blue-500'
              : 'bg-black/60 text-blue-500/60 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50'
          }`}
        >
          ONCHAIN (NETWORK)
        </button>
      </div>

      {activeTab === 'register' ? (
        <RegMod initialSubTab={activeSubTab} onSubTabChange={setActiveSubTab} />
      ) : (
        <UpdateMod initialSubTab={activeSubTab} onSubTabChange={setActiveSubTab} />
      )}
    </div>
  )
}

export default RegUpdate
