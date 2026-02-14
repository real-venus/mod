"use client";

import { CubeIcon } from '@heroicons/react/24/outline'
import CreateModule from './components/CreateModule'
import { userContext } from '@/context/UserContext'
import { text2color } from '@/utils'

export default function BuidlPage() {
  const { user } = userContext()
  const userColor = user?.key ? text2color(user.key) : '#a855f7'

  return (
    <div className="min-h-screen bg-black pt-20 pb-4 px-4 flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4 pt-2">
          <div
            className="p-3 rounded-xl border-2"
            style={{
              borderColor: `${userColor}40`,
              background: `linear-gradient(135deg, ${userColor}15, transparent)`,
            }}
          >
            <CubeIcon className="w-7 h-7" style={{ color: userColor }} />
          </div>
          <div>
            <h1
              className="text-2xl font-black uppercase tracking-[0.15em]"
              style={{ color: userColor, fontFamily: 'IBM Plex Mono, monospace' }}
            >
              Build
            </h1>
            <p className="text-neutral-500 text-sm font-mono tracking-wide">
              Register a module from a repo or CID
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 border border-neutral-800/60 bg-neutral-950/50 rounded-xl overflow-hidden shadow-2xl">
          <CreateModule />
        </div>
      </div>
    </div>
  )
}
