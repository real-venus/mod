"use client";
import { text2color, shorten, time2str, timeAgo, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/types'
import Link from 'next/link'
import { CopyButton } from '@/ui/CopyButton'
import { Clock, Zap, Box, Globe, Lock } from 'lucide-react'
import { useState } from 'react'
import { QRCode } from '@/ui/QRCode'

interface ModCardProps {
  mod: ModuleType
  card_enabled?: boolean
}

export default function ModCard({ mod }: ModCardProps) {
  const [isNameQrHovered, setIsNameQrHovered] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const agoStr = mod.updated ? timeAgo(mod.updated * 1000) : ''
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  const fnCount = mod.schema ? Object.keys(mod.schema).length : 0

  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div
        className="relative font-mono cursor-pointer overflow-visible group rounded-2xl h-full"
        style={{
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          background: isHovered
            ? `linear-gradient(160deg, ${colorWithOpacity(modColor, 0.08)} 0%, rgba(12,12,18,0.95) 40%, rgba(8,8,14,0.98) 100%)`
            : 'linear-gradient(160deg, rgba(18,18,26,0.9) 0%, rgba(12,12,18,0.95) 40%, rgba(8,8,14,0.98) 100%)',
          border: `1px solid ${isHovered ? colorWithOpacity(modColor, 0.35) : 'rgba(255,255,255,0.05)'}`,
          boxShadow: isHovered
            ? `0 20px 50px ${colorWithOpacity(modColor, 0.1)}, 0 0 0 1px ${colorWithOpacity(modColor, 0.06)}, inset 0 1px 0 rgba(255,255,255,0.04)`
            : 'inset 0 1px 0 rgba(255,255,255,0.02), 0 2px 12px rgba(0,0,0,0.2)',
          transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top accent gradient line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl overflow-hidden"
          style={{
            background: `linear-gradient(90deg, transparent 5%, ${colorWithOpacity(modColor, isHovered ? 0.8 : 0.3)} 50%, transparent 95%)`,
            transition: 'background 0.4s ease',
          }}
        />

        {/* Ambient glow */}
        <div
          className="absolute -top-px -left-px w-32 h-32 rounded-tl-2xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at top left, ${colorWithOpacity(modColor, isHovered ? 0.12 : 0.04)}, transparent 70%)`,
            transition: 'all 0.4s ease',
          }}
        />

        <div className="relative p-5">
          {/* Header: icon + name + fn count */}
          <div className="flex items-start gap-3.5 mb-4">
            <div
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${colorWithOpacity(modColor, 0.18)}, ${colorWithOpacity(modColor, 0.06)})`,
                border: `1px solid ${colorWithOpacity(modColor, isHovered ? 0.3 : 0.12)}`,
                boxShadow: isHovered ? `0 0 20px ${colorWithOpacity(modColor, 0.12)}, inset 0 0 12px ${colorWithOpacity(modColor, 0.05)}` : 'none',
                transition: 'all 0.4s ease',
              }}
            >
              <CubeIcon
                style={{
                  width: '20px',
                  height: '20px',
                  color: modColor,
                  filter: isHovered ? `drop-shadow(0 0 6px ${colorWithOpacity(modColor, 0.5)})` : 'none',
                  transition: 'filter 0.4s ease',
                }}
              />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2.5">
                <code
                  className="text-[15px] font-bold font-mono tracking-tight truncate block"
                  style={{
                    color: isHovered ? modColor : colorWithOpacity(modColor, 0.85),
                    textShadow: isHovered ? `0 0 25px ${colorWithOpacity(modColor, 0.3)}` : 'none',
                    transition: 'all 0.4s ease',
                  }}
                >
                  {mod.name}
                </code>
                {fnCount > 0 && (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full flex-shrink-0"
                    style={{
                      background: colorWithOpacity(modColor, 0.08),
                      border: `1px solid ${colorWithOpacity(modColor, 0.15)}`,
                    }}
                  >
                    <Zap size={8} style={{ color: colorWithOpacity(modColor, 0.6) }} />
                    <span className="font-bold" style={{ color: colorWithOpacity(modColor, 0.6) }}>{fnCount}</span>
                  </div>
                )}
                {mod.public === false && (
                  <Lock size={10} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                )}
              </div>
              {mod.desc && (
                <p className="text-[11px] text-white/20 font-medium leading-relaxed line-clamp-1 mt-1">
                  {mod.desc}
                </p>
              )}
            </div>

            {/* QR on hover */}
            <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div
                className="relative"
                onMouseEnter={() => setIsNameQrHovered(true)}
                onMouseLeave={() => setIsNameQrHovered(false)}
              >
                <div className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
                  <QrCodeIcon className="h-3.5 w-3.5 cursor-pointer text-white/15 hover:text-white/40 transition-colors" />
                </div>
                {isNameQrHovered && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 border z-[9999] rounded-xl"
                    style={{
                      borderColor: colorWithOpacity(modColor, 0.2),
                      background: 'rgba(6,6,10,0.98)',
                      boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${colorWithOpacity(modColor, 0.1)}`,
                    }}
                  >
                    <QRCode value={websiteUrl} size={120} color={modColor} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Timestamp */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <Clock size={9} className="text-white/25" />
              <span className="font-semibold text-white/25" title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>
            </div>

            {/* Owner key */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg cursor-default"
              style={{
                background: colorWithOpacity(keyColor, 0.04),
                border: `1px solid ${colorWithOpacity(keyColor, 0.08)}`,
                transition: 'all 0.2s ease',
              }}
              title={mod.key}
              onClick={(e) => e.preventDefault()}
            >
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-3 h-3 transition-all duration-200 hover:scale-110" style={{ color: colorWithOpacity(keyColor, 0.45) }} />
              </Link>
              <code className="font-mono font-semibold" style={{ color: colorWithOpacity(keyColor, 0.45) }}>
                {shorten(mod.key, 4, 4)}
              </code>
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
            </div>

            {/* IPFS CID */}
            {mod.cid && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg cursor-default"
                style={{
                  background: colorWithOpacity(cidColor, 0.04),
                  border: `1px solid ${colorWithOpacity(cidColor, 0.08)}`,
                  transition: 'all 0.2s ease',
                }}
                title={mod.cid}
                onClick={(e) => e.preventDefault()}
              >
                <Box size={9} style={{ color: colorWithOpacity(cidColor, 0.45) }} />
                <code className="font-mono font-semibold" style={{ color: colorWithOpacity(cidColor, 0.45) }}>
                  {shorten(mod.cid || '', 4, 4)}
                </code>
                <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
              </div>
            )}

            {/* Network badge */}
            {mod.url && (
              <div
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] rounded-lg"
                style={{
                  background: 'rgba(74, 222, 128, 0.04)',
                  border: '1px solid rgba(74, 222, 128, 0.08)',
                }}
                onClick={(e) => e.preventDefault()}
              >
                <Globe size={8} className="text-green-400/40" />
                <span className="font-semibold text-green-400/40">live</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
