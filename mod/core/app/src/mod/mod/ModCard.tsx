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
  const [isCidHovered, setIsCidHovered] = useState(false)
  
  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  
  const displayKey = mod.key ? `${mod.key.slice(0, 6)}...${mod.key.slice(-6)}` : 'N/A'
  const displayCid = mod.cid ? `${mod.cid.slice(0, 6)}...${mod.cid.slice(-6)}` : 'N/A'

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
              <code className="text-base font-mono truncate" style={{ color: modColor }}>
                {mod.name}
              </code>
              <CopyButton text={mod.name} size="sm" />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-black/40 border-2 border-blue-500/30 rounded-lg px-3 py-1.5">
              <Clock size={16} style={{ color: '#3b82f6' }} />
              <span className="text-blue-400 text-xs font-mono truncate">{updatedTimeStr}</span>
              <CopyButton text={updatedTimeStr} size="sm" />
            </div>

            <div 
              className="flex items-center gap-1 bg-black/40 border-2 rounded-lg px-3 py-1.5 transition-all relative group"
              style={{
                backgroundColor: isCidHovered ? `${cidColor}20` : 'rgba(0, 0, 0, 0.4)',
                borderColor: isCidHovered ? cidColor : `${cidColor}30`
              }}
              onMouseEnter={() => setIsCidHovered(true)}
              onMouseLeave={() => setIsCidHovered(false)}
              title={mod.cid}
            >
              <code className="text-sm font-mono truncate max-w-[100px]" style={{ color: cidColor }}>
                {displayCid}
              </code>
              <CopyButton text={mod.cid || ''} size="sm" />
              
              {isCidHovered && mod.cid && (
                <div 
                  className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-lg"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    borderColor: cidColor,
                    color: cidColor
                  }}
                >
                  {mod.cid}
                </div>
              )}
            </div>

            <div 
              className="flex items-center gap-1 bg-black/40 border-2 rounded-lg px-3 py-1.5 transition-all relative group"
              style={{
                backgroundColor: isKeyHovered ? `${keyColor}20` : 'rgba(0, 0, 0, 0.4)',
                borderColor: isKeyHovered ? keyColor : `${keyColor}30`
              }}
              onMouseEnter={() => setIsKeyHovered(true)}
              onMouseLeave={() => setIsKeyHovered(false)}
              title={mod.key}
            >
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-5 h-5" style={{ color: keyColor }} />
              </Link>
              <code className="text-sm font-mono truncate max-w-[100px]" style={{ color: keyColor }}>
                {displayKey}
              </code>
              <CopyButton text={mod.key} size="sm" />
              
              {isKeyHovered && (
                <div 
                  className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-lg"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    borderColor: keyColor,
                    color: keyColor
                  }}
                >
                  {mod.key}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}