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
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const [isCidHovered, setIsCidHovered] = useState(false)
  const [isNameQrHovered, setIsNameQrHovered] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  const fnCount = mod.schema ? Object.keys(mod.schema).length : 0

  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div
        className="relative font-mono transition-all duration-300 cursor-pointer overflow-visible group border-2"
        style={{
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          background: isHovered ? colorWithOpacity(modColor, 0.04) : '#0a0a0e',
          borderColor: isHovered ? colorWithOpacity(modColor, 0.5) : 'rgba(255,255,255,0.1)',
          boxShadow: isHovered ? `0 0 30px ${colorWithOpacity(modColor, 0.1)}, inset 0 0 60px ${colorWithOpacity(modColor, 0.03)}` : 'none',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] transition-all duration-300"
          style={{
            background: `linear-gradient(90deg, ${modColor}, ${colorWithOpacity(modColor, 0.3)})`,
            opacity: isHovered ? 1 : 0.7,
          }}
        />

        {/* Scanline overlay on hover */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
            }}
          />
        )}

        <div className="relative p-5">
          {/* Header row: icon + name + actions */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 flex items-center justify-center border-2 flex-shrink-0 transition-all duration-300"
              style={{
                background: colorWithOpacity(modColor, isHovered ? 0.2 : 0.1),
                borderColor: colorWithOpacity(modColor, isHovered ? 0.7 : 0.4),
                boxShadow: isHovered ? `0 0 12px ${colorWithOpacity(modColor, 0.3)}` : 'none',
              }}
            >
              <CubeIcon className="w-5 h-5 transition-all duration-300" style={{ color: modColor, filter: isHovered ? `drop-shadow(0 0 4px ${modColor})` : 'none' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-cyan-400/60 tracking-wider">[MOD]</span>
                <code className="text-[15px] font-extrabold font-mono tracking-tight truncate" style={{ color: modColor }}>
                  {mod.name}
                </code>
              </div>
              {mod.desc && (
                <p className="text-[11px] text-white/40 font-medium leading-snug line-clamp-1 mt-0.5">
                  {mod.desc}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
              <div
                className="relative"
                onMouseEnter={() => setIsNameQrHovered(true)}
                onMouseLeave={() => setIsNameQrHovered(false)}
              >
                <QrCodeIcon className="h-4 w-4 cursor-pointer hover:scale-110 transition-all duration-200 text-white/20 hover:text-white/50" />
                {isNameQrHovered && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 border z-[9999]"
                    style={{
                      borderColor: colorWithOpacity(modColor, 0.3),
                      background: 'rgba(8,8,12,0.97)',
                    }}
                  >
                    <QRCode value={websiteUrl} size={120} color={modColor} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px mb-3 transition-all duration-300" style={{ background: isHovered ? colorWithOpacity(modColor, 0.2) : 'rgba(255,255,255,0.06)' }} />

          {/* Metadata row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {fnCount > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] border transition-all duration-200"
                style={{
                  background: colorWithOpacity(modColor, 0.08),
                  borderColor: colorWithOpacity(modColor, 0.25),
                }}
              >
                <span className="font-extrabold" style={{ color: colorWithOpacity(modColor, 0.8) }}>{fnCount}</span>
                <span className="font-bold" style={{ color: colorWithOpacity(modColor, 0.5) }}>fn{fnCount !== 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] border border-amber-500/20 bg-amber-500/[0.04]">
              <Clock size={10} className="text-amber-400/60" />
              <span className="font-bold text-amber-400/50">{updatedTimeStr}</span>
            </div>

            <div
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] relative border"
              style={{
                background: colorWithOpacity(keyColor, 0.06),
                borderColor: colorWithOpacity(keyColor, 0.25),
              }}
              onMouseEnter={() => setIsKeyHovered(true)}
              onMouseLeave={() => setIsKeyHovered(false)}
              title={mod.key}
            >
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-3 h-3 transition-all duration-200 hover:scale-110" style={{ color: colorWithOpacity(keyColor, 0.8) }} />
              </Link>
              <code className="font-mono font-bold" style={{ color: colorWithOpacity(keyColor, 0.7) }}>
                {shorten(mod.key, 4, 4)}
              </code>
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
            </div>

            {mod.cid && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] relative border"
                style={{
                  background: colorWithOpacity(cidColor, 0.06),
                  borderColor: colorWithOpacity(cidColor, 0.25),
                }}
                onMouseEnter={() => setIsCidHovered(true)}
                onMouseLeave={() => setIsCidHovered(false)}
                title={mod.cid}
              >
                <code className="font-mono font-bold" style={{ color: colorWithOpacity(cidColor, 0.7) }}>
                  {shorten(mod.cid || '', 4, 4)}
                </code>
                <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
