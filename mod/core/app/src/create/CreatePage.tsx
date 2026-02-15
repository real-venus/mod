"use client";

import { CubeIcon } from '@heroicons/react/24/outline'
import CreateModule from './CreateModule'
import { userContext } from '@/context/UserContext'

export default function CreatePage() {
  const { user } = userContext()

  return (
    <div className="min-h-screen bg-black pt-16 pb-8 px-4 flex flex-col" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <CubeIcon
            className="w-8 h-8 text-green-400 shrink-0"
            style={{ filter: 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.5))' }}
          />
          <div>
            <h1 className="text-[20px] font-extrabold text-white tracking-tight uppercase leading-none" style={{ textShadow: '0 0 20px rgba(74, 222, 128, 0.15)' }}>
              CREATE MODULE
            </h1>
            <p className="text-white/25 text-[12px] font-bold tracking-wide mt-0.5">
              Register a module from a repo or CID
            </p>
          </div>
        </div>

        {/* Content */}
        <CreateModule />
      </div>
    </div>
  )
}
