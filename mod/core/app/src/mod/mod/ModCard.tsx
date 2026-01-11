'use client'
import { text2color, shorten, time2str } from '@/mod/utils'
import { KeyIcon, CubeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/mod/types'
import Link from 'next/link'
import { CopyButton } from '@/mod/ui/CopyButton'
import { Clock } from 'lucide-react'
import { useState } from 'react'

interface ModCardProps {
  mod: ModuleType
  card_enabled?: boolean
}

export default function ModCard({ mod }: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  
  const modColor = text2color(mod.name || mod.key)
  const userColor = text2color(mod.key)
  const updatedTimeStr = mod.updated ? time2str(mod.updated) : time2str(Date.now())
  
  const displayName = mod.name.substring(0, 5)
  const displayCid = mod.cid ? `${mod.cid.slice(0, 8)}...${mod.cid.slice(-8)}` : 'N/A'

  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div 
        className="border-2 rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:border-opacity-80 shadow-lg"
        style={{ 
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          backgroundColor: `${modColor}15`,
          borderColor: modColor
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CubeIcon className="w-8 h-8" style={{ color: modColor }} />
            
            <div className="flex items-center gap-1 bg-black/40 border-2 rounded-lg px-3 py-1.5" style={{ borderColor: `${modColor}40` }}>
              <code className="text-base font-mono" style={{ color: modColor }}>
                {displayName}
              </code>
              <CopyButton text={mod.name} size="sm" />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-black/40 border-2 border-blue-500/30 rounded-lg px-3 py-1.5">
              <Clock size={16} style={{ color: '#3b82f6' }} />
              <span className="text-blue-400 text-xs font-mono">{updatedTimeStr}</span>
              <CopyButton text={updatedTimeStr} size="sm" />
            </div>

            <div className="flex items-center gap-1 bg-black/40 border-2 border-green-500/30 rounded-lg px-3 py-1.5">
              <code className="text-sm font-mono" style={{ color: '#10b981' }}>
                {displayCid}
              </code>
              <CopyButton text={mod.cid || ''} size="sm" />
            </div>

            <div 
              className="flex items-center gap-1 bg-black/40 border-2 border-pink-500/30 rounded-lg px-3 py-1.5 transition-all"
              style={{
                backgroundColor: isKeyHovered ? 'rgba(236, 72, 153, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                borderColor: isKeyHovered ? '#ec4899' : 'rgba(236, 72, 153, 0.3)'
              }}
              onMouseEnter={() => setIsKeyHovered(true)}
              onMouseLeave={() => setIsKeyHovered(false)}
            >
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-5 h-5" style={{ color: '#ec4899' }} />
              </Link>
              <CopyButton text={mod.key} size="sm" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
