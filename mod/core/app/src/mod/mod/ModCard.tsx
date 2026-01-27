'use client'
import { text2color, shorten, time2str } from '@/mod/utils'
import { KeyIcon, CubeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/mod/types'
import Link from 'next/link'
import { CopyButton } from '@/mod/ui/CopyButton'
import { Clock } from 'lucide-react'
import { useState } from 'react'
import { QRCode } from '@/mod/ui/QRCode'

interface ModCardProps {
  mod: ModuleType
  card_enabled?: boolean
}

export default function ModCard({ mod }: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const [isCidHovered, setIsCidHovered] = useState(false)
  const [isQrHovered, setIsQrHovered] = useState(false)
  
  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const moduleIdentifier = `${mod.key}/${mod.name}`
  
  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div 
        className="relative border-2 rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02] overflow-hidden group"
        style={{ 
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          backgroundColor: `${modColor}08`,
          borderColor: modColor,
          boxShadow: isHovered ? `0 0 40px ${modColor}50, 0 0 80px ${modColor}20` : `0 0 20px ${modColor}30`
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${modColor}40, transparent 70%)`
          }}
        />

        <div className="relative p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <CubeIcon className="w-10 h-10 transition-all duration-300 group-hover:rotate-12" style={{ color: modColor }} />
                  <div 
                    className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-60 transition-opacity"
                    style={{ backgroundColor: modColor }}
                  />
                </div>
                
                <div className="flex items-center gap-2 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-4 py-2 flex-1 shadow-lg">
                  <code className="text-lg font-bold font-mono tracking-wide" style={{ color: modColor }}>
                    {mod.name}
                  </code>
                  <CopyButton text={mod.name} size="sm" />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-lg px-2 py-1.5 shadow-md transition-all hover:scale-105">
                  <Clock size={16} style={{ color: '#3b82f6' }} />
                  <CopyButton text={updatedTimeStr} size="sm" />
                </div>

                <div 
                  className="flex items-center gap-1.5 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-2 py-1.5 transition-all relative group/cid shadow-md hover:scale-105"
                  style={{
                    backgroundColor: isCidHovered ? `${cidColor}25` : 'rgba(0, 0, 0, 0.5)'
                  }}
                  onMouseEnter={() => setIsCidHovered(true)}
                  onMouseLeave={() => setIsCidHovered(false)}
                  title={mod.cid}
                >
                  <code className="text-sm font-mono font-bold" style={{ color: cidColor }}>
                    ●●●●●●
                  </code>
                  <CopyButton text={mod.cid || ''} size="sm" />
                  
                  {isCidHovered && mod.cid && (
                    <div 
                      className="absolute bottom-full left-0 mb-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        borderColor: cidColor,
                        color: cidColor,
                        boxShadow: `0 0 20px ${cidColor}40`
                      }}
                    >
                      {mod.cid}
                    </div>
                  )}
                </div>

                <div 
                  className="flex items-center gap-1.5 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-2 py-1.5 transition-all relative group/key shadow-md hover:scale-105"
                  style={{
                    backgroundColor: isKeyHovered ? `${keyColor}25` : 'rgba(0, 0, 0, 0.5)'
                  }}
                  onMouseEnter={() => setIsKeyHovered(true)}
                  onMouseLeave={() => setIsKeyHovered(false)}
                  title={mod.key}
                >
                  <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                    <KeyIcon className="w-4 h-4 transition-transform hover:scale-110" style={{ color: keyColor }} />
                  </Link>
                  <CopyButton text={mod.key} size="sm" />
                  
                  {isKeyHovered && (
                    <div 
                      className="absolute bottom-full left-0 mb-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        borderColor: keyColor,
                        color: keyColor,
                        boxShadow: `0 0 20px ${keyColor}40`
                      }}
                    >
                      {mod.key}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div 
              className="flex flex-col items-center gap-2 relative"
              onMouseEnter={() => setIsQrHovered(true)}
              onMouseLeave={() => setIsQrHovered(false)}
            >
              <div className="p-2 bg-black/60 rounded-lg border-2" style={{ borderColor: modColor }}>
                <QRCode value={moduleIdentifier} size={80} color={modColor} />
              </div>
              {isQrHovered && (
                <div 
                  className="absolute top-full mt-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    borderColor: modColor,
                    color: modColor,
                    boxShadow: `0 0 20px ${modColor}40`
                  }}
                >
                  {moduleIdentifier}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
