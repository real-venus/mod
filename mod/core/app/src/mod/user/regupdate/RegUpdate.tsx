'use client'
import { useState } from 'react'
import RegMod from '@/mod/user/reg'
import UpdateMod from '@/mod/user/update'

export const RegUpdate = () => {
  const [activeMode, setActiveMode] = useState<'register' | 'update'>('register')

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveMode('register')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeMode === 'register'
              ? 'bg-green-500/30 text-green-300 border-green-500'
              : 'bg-black/60 text-green-500/60 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50'
          }`}
        >
          REGISTER
        </button>
        <button
          onClick={() => setActiveMode('update')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
            activeMode === 'update'
              ? 'bg-orange-500/30 text-orange-300 border-orange-500'
              : 'bg-black/60 text-orange-500/60 border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-500/50'
          }`}
        >
          UPDATE
        </button>
      </div>

      {activeMode === 'register' ? <RegMod /> : <UpdateMod />}
    </div>
  )
}

export default RegUpdate
