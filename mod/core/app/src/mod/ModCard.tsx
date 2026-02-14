"use client";
import { text2color, shorten, time2str, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/types'
import Link from 'next/link'
import { CopyButton } from '@/ui/CopyButton'
import { Clock } from 'lucide-react'
import { useState } from 'react'
import { QRCode } from '@/ui/QRCode'

interface ModCardProps {
  mod: ModuleType
  card_enabled?: boolean
}

export default function ModCard({ mod }: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const [isCidHovered, setIsCidHovered] = useState(false)
  const [isNameQrHovered, setIsNameQrHovered] = useState(false)

  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  
  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div
        className="relative border-2 rounded-2xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:shadow-2xl overflow-visible group"
        style={{
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          backgroundColor: colorWithOpacity(modColor, 0.08),
          borderColor: modColor,
          boxShadow: isHovered
            ? `0 0 40px ${colorWithOpacity(modColor, 0.4)}, 0 0 80px ${colorWithOpacity(modColor, 0.2)}, inset 0 0 20px ${colorWithOpacity(modColor, 0.05)}`
            : `0 0 20px ${colorWithOpacity(modColor, 0.25)}`
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${colorWithOpacity(modColor, 0.4)}, transparent 70%)`
          }}
        />

        <div className="relative p-6">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-4">
              {/* Module name row */}
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <CubeIcon className="w-10 h-10 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110" style={{ color: modColor }} />
                  <div
                    className="absolute inset-0 blur-xl opacity-60 group-hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: modColor }}
                  />
                </div>

                <code className="text-2xl font-black font-mono tracking-wide truncate" style={{ color: modColor }}>
                  {mod.name}
                </code>
                <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
                <div
                  className="relative flex-shrink-0"
                  onMouseEnter={() => setIsNameQrHovered(true)}
                  onMouseLeave={() => setIsNameQrHovered(false)}
                >
                  <QrCodeIcon className="h-4 w-4 cursor-pointer hover:scale-110 transition-transform text-gray-600 hover:text-gray-400" />
                  {isNameQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-black/95 rounded-xl border-2 z-[9999] shadow-2xl" style={{ borderColor: modColor }}>
                      <QRCode value={websiteUrl} size={120} color={modColor} />
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {mod.desc && (
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-2" style={{ paddingLeft: '52px' }}>
                  {mod.desc}
                </p>
              )}

              {/* Metadata row */}
              <div className="flex items-center gap-2.5 flex-wrap" style={{ paddingLeft: '52px' }}>
                <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs border border-white/5 bg-white/5">
                  <Clock size={14} className="text-gray-500" />
                  <span className="font-medium text-gray-400">{updatedTimeStr}</span>
                </div>

                <div
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border border-white/5 bg-white/5 relative"
                  onMouseEnter={() => setIsKeyHovered(true)}
                  onMouseLeave={() => setIsKeyHovered(false)}
                  title={mod.key}
                >
                  <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                    <KeyIcon className="w-3.5 h-3.5 transition-transform hover:scale-110" style={{ color: keyColor }} />
                  </Link>
                  <code className="font-mono font-medium" style={{ color: keyColor }}>
                    {shorten(mod.key, 4, 4)}
                  </code>
                  <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
                </div>

                {mod.cid && (
                  <div
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border border-white/5 bg-white/5 relative"
                    onMouseEnter={() => setIsCidHovered(true)}
                    onMouseLeave={() => setIsCidHovered(false)}
                    title={mod.cid}
                  >
                    <code className="font-mono font-medium" style={{ color: cidColor }}>
                      {shorten(mod.cid || '', 4, 4)}
                    </code>
                    <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}