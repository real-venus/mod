'use client'
import { text2color, shorten, time2str } from '@/mod/utils'
import { KeyIcon, CubeIcon, QrCodeIcon } from '@heroicons/react/24/outline'
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
  const [isNameQrHovered, setIsNameQrHovered] = useState(false)
  const [isKeyQrHovered, setIsKeyQrHovered] = useState(false)
  const [isCidQrHovered, setIsCidQrHovered] = useState(false)
  const [isKeyCopyHovered, setIsKeyCopyHovered] = useState(false)
  const [isCidCopyHovered, setIsCidCopyHovered] = useState(false)
  
  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const moduleIdentifier = `${mod.key}/${mod.name}`
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  
  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div 
        className="relative border-2 rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02] overflow-visible group"
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
                  <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
                  <div 
                    className="relative ml-1"
                    onMouseEnter={() => setIsNameQrHovered(true)}
                    onMouseLeave={() => setIsNameQrHovered(false)}
                  >
                    <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: modColor }} />
                    {isNameQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-[9999] shadow-2xl" style={{ borderColor: modColor }}>
                        <QRCode value={websiteUrl} size={100} color={modColor} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-lg px-2 py-1.5 shadow-md transition-all hover:scale-105">
                  <Clock size={16} style={{ color: '#3b82f6' }} />
                  <CopyButton text={updatedTimeStr} size="sm" showValueOnHover={true} />
                </div>

                <div 
                  className="flex items-center gap-1.5 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-2 py-1.5 transition-all relative group/cid shadow-md hover:scale-105"
                  onMouseEnter={() => setIsCidHovered(true)}
                  onMouseLeave={() => setIsCidHovered(false)}
                  title={mod.cid}
                >
                  <code className="text-sm font-mono font-bold" style={{ color: cidColor }}>
                    ●●●●●●
                  </code>
                  <div
                    onMouseEnter={() => setIsCidCopyHovered(true)}
                    onMouseLeave={() => setIsCidCopyHovered(false)}
                  >
                    <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
                  </div>
                  <div 
                    className="relative ml-1"
                    onMouseEnter={() => setIsCidQrHovered(true)}
                    onMouseLeave={() => setIsCidQrHovered(false)}
                  >
                    <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: cidColor }} />
                    {isCidQrHovered && mod.cid && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-[9999] shadow-2xl" style={{ borderColor: cidColor }}>
                        <QRCode value={mod.cid} size={100} color={cidColor} />
                      </div>
                    )}
                  </div>
                </div>

                <div 
                  className="flex items-center gap-1.5 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-2 py-1.5 transition-all relative group/key shadow-md hover:scale-105"
                  onMouseEnter={() => setIsKeyHovered(true)}
                  onMouseLeave={() => setIsKeyHovered(false)}
                  title={mod.key}
                >
                  <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                    <KeyIcon className="w-4 h-4 transition-transform hover:scale-110" style={{ color: keyColor }} />
                  </Link>
                  <div
                    onMouseEnter={() => setIsKeyCopyHovered(true)}
                    onMouseLeave={() => setIsKeyCopyHovered(false)}
                  >
                    <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
                  </div>
                  <div 
                    className="relative ml-1"
                    onMouseEnter={() => setIsKeyQrHovered(true)}
                    onMouseLeave={() => setIsKeyQrHovered(false)}
                  >
                    <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: keyColor }} />
                    {isKeyQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-[9999] shadow-2xl" style={{ borderColor: keyColor }}>
                        <QRCode value={mod.key} size={100} color={keyColor} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}