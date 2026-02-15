"use client";
import { text2color, shorten, time2str, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/types'
import Link from 'next/link'
import { CopyButton } from '@/ui/CopyButton'
import { Clock, Zap } from 'lucide-react'
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
        className="relative font-mono cursor-pointer overflow-visible group"
        style={{
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          background: isHovered
            ? `linear-gradient(135deg, ${colorWithOpacity(modColor, 0.08)} 0%, ${colorWithOpacity(modColor, 0.02)} 100%)`
            : 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: `1px solid ${isHovered ? colorWithOpacity(modColor, 0.5) : 'rgba(255,255,255,0.07)'}`,
          boxShadow: isHovered
            ? `0 8px 32px ${colorWithOpacity(modColor, 0.15)}, 0 0 0 1px ${colorWithOpacity(modColor, 0.1)}, inset 0 1px 0 ${colorWithOpacity(modColor, 0.1)}`
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
          transition: 'all 0.25s ease',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${modColor}, transparent)`,
            opacity: isHovered ? 0.8 : 0.3,
            transition: 'opacity 0.25s ease',
          }}
        />

        <div className="relative p-4">
          {/* Header row: icon + name + actions */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{
                background: colorWithOpacity(modColor, isHovered ? 0.18 : 0.1),
                border: `1px solid ${colorWithOpacity(modColor, isHovered ? 0.4 : 0.2)}`,
                borderRadius: '8px',
                transition: 'all 0.25s ease',
              }}
            >
              <CubeIcon
                className="w-4.5 h-4.5"
                style={{
                  width: '18px',
                  height: '18px',
                  color: modColor,
                  filter: isHovered ? `drop-shadow(0 0 6px ${modColor})` : 'none',
                  transition: 'filter 0.25s ease',
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code
                  className="text-[15px] font-extrabold font-mono tracking-tight truncate"
                  style={{
                    color: isHovered ? modColor : colorWithOpacity(modColor, 0.85),
                    textShadow: isHovered ? `0 0 12px ${colorWithOpacity(modColor, 0.4)}` : 'none',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {mod.name}
                </code>
                {fnCount > 0 && (
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[11px]"
                    style={{
                      background: colorWithOpacity(modColor, 0.1),
                      border: `1px solid ${colorWithOpacity(modColor, 0.2)}`,
                      borderRadius: '4px',
                    }}
                  >
                    <Zap size={8} style={{ color: colorWithOpacity(modColor, 0.7) }} />
                    <span className="font-extrabold" style={{ color: colorWithOpacity(modColor, 0.7) }}>{fnCount}</span>
                  </div>
                )}
              </div>
              {mod.desc && (
                <p className="text-[12px] text-white/30 font-medium leading-snug line-clamp-1 mt-0.5">
                  {mod.desc}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
              <div
                className="relative"
                onMouseEnter={() => setIsNameQrHovered(true)}
                onMouseLeave={() => setIsNameQrHovered(false)}
              >
                <QrCodeIcon className="h-3.5 w-3.5 cursor-pointer hover:scale-110 transition-all duration-200 text-white/20 hover:text-white/50" />
                {isNameQrHovered && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 border z-[9999]"
                    style={{
                      borderColor: colorWithOpacity(modColor, 0.3),
                      background: 'rgba(8,8,12,0.97)',
                      borderRadius: '8px',
                    }}
                  >
                    <QRCode value={websiteUrl} size={120} color={modColor} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div
              className="flex items-center gap-1 px-2 py-0.5 text-[11px]"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '3px',
              }}
            >
              <Clock size={9} className="text-white/25" />
              <span className="font-bold text-white/25">{updatedTimeStr}</span>
            </div>

            <div
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] relative"
              style={{
                background: colorWithOpacity(keyColor, 0.04),
                border: `1px solid ${colorWithOpacity(keyColor, 0.12)}`,
                borderRadius: '3px',
              }}
              onMouseEnter={() => setIsKeyHovered(true)}
              onMouseLeave={() => setIsKeyHovered(false)}
              title={mod.key}
            >
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-3 h-3 transition-all duration-200 hover:scale-110" style={{ color: colorWithOpacity(keyColor, 0.5) }} />
              </Link>
              <code className="font-mono font-bold" style={{ color: colorWithOpacity(keyColor, 0.45) }}>
                {shorten(mod.key, 4, 4)}
              </code>
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
            </div>

            {mod.cid && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] relative"
                style={{
                  background: colorWithOpacity(cidColor, 0.04),
                  border: `1px solid ${colorWithOpacity(cidColor, 0.12)}`,
                  borderRadius: '3px',
                }}
                onMouseEnter={() => setIsCidHovered(true)}
                onMouseLeave={() => setIsCidHovered(false)}
                title={mod.cid}
              >
                <code className="font-mono font-bold" style={{ color: colorWithOpacity(cidColor, 0.45) }}>
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
