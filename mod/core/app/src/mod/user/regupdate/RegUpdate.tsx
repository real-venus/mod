'use client'
import { useState } from 'react'
import Reg from '@/mod/user/reg/Reg'
import Update from '@/mod/user/update/Update'

export const RegUpdate = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'update'>('register')

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

      {activeTab === 'register' ? (
        <Reg />
      ) : (
        <Update />
      )}
    </div>
  )
}

export default RegUpdate