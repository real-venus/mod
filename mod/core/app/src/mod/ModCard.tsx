"use client";
import { text2color, shorten, time2str, timeAgo, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/types'
import Link from 'next/link'
import { CopyButton } from '@/ui/CopyButton'
import { Clock, Zap, Box, ExternalLink } from 'lucide-react'
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
  const agoStr = mod.updated ? timeAgo(mod.updated * 1000) : ''
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  const fnCount = mod.schema ? Object.keys(mod.schema).length : 0

  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      <div
        className="relative font-mono cursor-pointer overflow-visible group rounded-xl"
        style={{
          fontFamily: 'IBM Plex Mono, Courier New, monospace',
          background: isHovered
            ? `linear-gradient(145deg, ${colorWithOpacity(modColor, 0.1)} 0%, ${colorWithOpacity(modColor, 0.03)} 50%, rgba(0,0,0,0.2) 100%)`
            : 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 50%, rgba(0,0,0,0.1) 100%)',
          border: `1px solid ${isHovered ? colorWithOpacity(modColor, 0.4) : 'rgba(255,255,255,0.06)'}`,
          boxShadow: isHovered
            ? `0 12px 40px ${colorWithOpacity(modColor, 0.12)}, 0 0 0 1px ${colorWithOpacity(modColor, 0.08)}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
          backdropFilter: 'blur(12px)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-3 right-3 h-[1px] rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${modColor}, transparent)`,
            opacity: isHovered ? 1 : 0.25,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Corner glow on hover */}
        <div
          className="absolute -top-[1px] -left-[1px] w-16 h-16 rounded-tl-xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at top left, ${colorWithOpacity(modColor, isHovered ? 0.15 : 0.05)}, transparent 70%)`,
            transition: 'background 0.3s ease',
          }}
        />

        <div className="relative p-4 pb-3">
          {/* Header row: icon + name + badge */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${colorWithOpacity(modColor, isHovered ? 0.2 : 0.12)}, ${colorWithOpacity(modColor, isHovered ? 0.08 : 0.04)})`,
                border: `1px solid ${colorWithOpacity(modColor, isHovered ? 0.35 : 0.15)}`,
                boxShadow: isHovered ? `0 0 16px ${colorWithOpacity(modColor, 0.15)}` : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              <CubeIcon
                style={{
                  width: '20px',
                  height: '20px',
                  color: modColor,
                  filter: isHovered ? `drop-shadow(0 0 8px ${colorWithOpacity(modColor, 0.6)})` : 'none',
                  transition: 'filter 0.3s ease',
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code
                  className="text-[16px] font-extrabold font-mono tracking-tight truncate"
                  style={{
                    color: isHovered ? modColor : colorWithOpacity(modColor, 0.9),
                    textShadow: isHovered ? `0 0 20px ${colorWithOpacity(modColor, 0.35)}` : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {mod.name}
                </code>
                {fnCount > 0 && (
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded"
                    style={{
                      background: colorWithOpacity(modColor, 0.08),
                      border: `1px solid ${colorWithOpacity(modColor, 0.18)}`,
                    }}
                  >
                    <Zap size={8} style={{ color: colorWithOpacity(modColor, 0.65) }} />
                    <span className="font-bold" style={{ color: colorWithOpacity(modColor, 0.65) }}>{fnCount}</span>
                  </div>
                )}
              </div>
              {mod.desc && (
                <p className="text-[11px] text-white/25 font-medium leading-snug line-clamp-1 mt-0.5">
                  {mod.desc}
                </p>
              )}
            </div>

            {/* QR + actions on hover */}
            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div
                className="relative"
                onMouseEnter={() => setIsNameQrHovered(true)}
                onMouseLeave={() => setIsNameQrHovered(false)}
              >
                <div className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors">
                  <QrCodeIcon className="h-3.5 w-3.5 cursor-pointer text-white/20 hover:text-white/50 transition-colors" />
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

          {/* Divider */}
          <div
            className="h-[1px] mb-2.5 mx-0"
            style={{
              background: `linear-gradient(90deg, ${colorWithOpacity(modColor, isHovered ? 0.12 : 0.05)}, rgba(255,255,255,0.03), transparent)`,
              transition: 'background 0.3s ease',
            }}
          />

          {/* Metadata row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Timestamp */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] rounded-md"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <Clock size={9} className="text-white/20" />
              <span className="font-semibold text-white/20" title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>
            </div>

            {/* Owner key */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] rounded-md group/key cursor-default"
              style={{
                background: colorWithOpacity(keyColor, 0.03),
                border: `1px solid ${colorWithOpacity(keyColor, 0.08)}`,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={() => setIsKeyHovered(true)}
              onMouseLeave={() => setIsKeyHovered(false)}
              title={mod.key}
              onClick={(e) => e.preventDefault()}
            >
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-3 h-3 transition-all duration-200 hover:scale-110" style={{ color: colorWithOpacity(keyColor, 0.4) }} />
              </Link>
              <code className="font-mono font-semibold" style={{ color: colorWithOpacity(keyColor, 0.4) }}>
                {shorten(mod.key, 4, 4)}
              </code>
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
            </div>

            {/* IPFS CID */}
            {mod.cid && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] rounded-md group/cid cursor-default"
                style={{
                  background: colorWithOpacity(cidColor, 0.03),
                  border: `1px solid ${colorWithOpacity(cidColor, 0.08)}`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={() => setIsCidHovered(true)}
                onMouseLeave={() => setIsCidHovered(false)}
                title={mod.cid}
                onClick={(e) => e.preventDefault()}
              >
                <Box size={9} style={{ color: colorWithOpacity(cidColor, 0.4) }} />
                <code className="font-mono font-semibold" style={{ color: colorWithOpacity(cidColor, 0.4) }}>
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
