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

export default function ModCard({ mod, card_enabled = true }: ModCardProps) {
  const [isNameQrHovered, setIsNameQrHovered] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const agoStr = mod.updated ? timeAgo(mod.updated * 1000) : ''
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  const fnCount = mod.schema ? Object.keys(mod.schema).length : 0

  const isExpanded = !card_enabled

  const cardContent = (
    <div
      className={`relative font-mono overflow-visible group rounded-2xl h-full ${card_enabled ? 'cursor-pointer' : ''}`}
      style={{
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        ...(card_enabled ? {
          background: isHovered
            ? `linear-gradient(135deg, ${colorWithOpacity(modColor, 0.1)} 0%, var(--bg-secondary) 100%)`
            : `var(--bg-secondary)`,
          border: `2px solid ${isHovered ? modColor : colorWithOpacity(modColor, 0.5)}`,
          boxShadow: 'none',
          transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        } : {}),
      }}
      onMouseEnter={() => card_enabled && setIsHovered(true)}
      onMouseLeave={() => card_enabled && setIsHovered(false)}
    >
      {/* Top accent bar - only on card mode */}
      {card_enabled && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl overflow-hidden"
          style={{
            background: modColor,
          }}
        />
      )}


      <div className={`relative ${card_enabled ? 'p-5' : ''}`}>
        {/* Header: icon + name + fn count */}
        <div className={`flex items-start ${isExpanded ? 'gap-5 mb-5' : 'gap-3.5 mb-4'}`}>
          <div
            className={`flex items-center justify-center flex-shrink-0 ${isExpanded ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl'}`}
            style={{
              background: `linear-gradient(135deg, ${colorWithOpacity(modColor, 0.35)}, ${colorWithOpacity(modColor, 0.15)})`,
              border: `2px solid ${colorWithOpacity(modColor, 0.5)}`,
            }}
          >
            <CubeIcon
              style={{
                width: isExpanded ? '28px' : '22px',
                height: isExpanded ? '28px' : '22px',
                color: modColor,
              }}
            />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2.5">
              <code
                className={`font-extrabold font-mono tracking-tight truncate block ${isExpanded ? 'text-[28px]' : 'text-[16px]'}`}
                style={{
                  color: modColor,
                  textShadow: 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {mod.name}
              </code>
              {fnCount > 0 && (
                <div
                  className={`flex items-center gap-1 rounded-full flex-shrink-0 ${isExpanded ? 'px-3 py-1.5 text-[13px]' : 'px-2.5 py-1 text-[11px]'}`}
                  style={{
                    background: colorWithOpacity(modColor, 0.2),
                    border: `1.5px solid ${colorWithOpacity(modColor, 0.4)}`,
                  }}
                >
                  <Zap size={isExpanded ? 12 : 9} style={{ color: modColor }} />
                  <span className="font-extrabold" style={{ color: modColor }}>{fnCount}</span>
                </div>
              )}
              {mod.public === false && (
                <Lock size={isExpanded ? 14 : 11} className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              )}
            </div>
            {mod.desc && (
              <p className={`font-bold leading-relaxed mt-1.5 ${isExpanded ? 'text-[14px]' : 'text-[11px] line-clamp-1'}`} style={{ color: 'var(--text-secondary)' }}>
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
              <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <QrCodeIcon className="h-3.5 w-3.5 cursor-pointer transition-colors" />
              </div>
              {isNameQrHovered && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 border z-[9999] rounded-xl"
                  style={{
                    borderColor: colorWithOpacity(modColor, 0.4),
                    background: 'var(--bg-sidebar)',
                    boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
                  }}
                >
                  <QRCode value={websiteUrl} size={120} color={modColor} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata pills */}
        <div className={`flex items-center flex-wrap ${isExpanded ? 'gap-2.5' : 'gap-2'}`}>
          {/* Timestamp */}
          <div
            className={`flex items-center gap-1.5 rounded-lg ${isExpanded ? 'px-3.5 py-2 text-[13px]' : 'px-3 py-1.5 text-[11px]'}`}
            style={{
              background: 'var(--bg-input)',
              border: '1.5px solid var(--border-strong)',
            }}
          >
            <Clock size={isExpanded ? 12 : 10} style={{ color: 'var(--text-secondary)' }} />
            <span className="font-bold" style={{ color: 'var(--text-secondary)' }} title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>
          </div>

          {/* Owner key */}
          <div
            className={`flex items-center gap-1.5 rounded-lg cursor-default ${isExpanded ? 'px-3.5 py-2 text-[13px]' : 'px-3 py-1.5 text-[11px]'}`}
            style={{
              background: colorWithOpacity(keyColor, 0.12),
              border: `1.5px solid ${colorWithOpacity(keyColor, 0.4)}`,
            }}
            title={mod.key}
            onClick={(e) => e.preventDefault()}
          >
            <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
              <KeyIcon className={`transition-all duration-200 hover:scale-110 ${isExpanded ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} style={{ color: keyColor }} />
            </Link>
            <code className="font-mono font-bold" style={{ color: keyColor }}>
              {shorten(mod.key, 4, 4)}
            </code>
            <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
          </div>

          {/* IPFS CID */}
          {mod.cid && (
            <div
              className={`flex items-center gap-1.5 rounded-lg cursor-default ${isExpanded ? 'px-3.5 py-2 text-[13px]' : 'px-3 py-1.5 text-[11px]'}`}
              style={{
                background: colorWithOpacity(cidColor, 0.12),
                border: `1.5px solid ${colorWithOpacity(cidColor, 0.4)}`,
              }}
              title={mod.cid}
              onClick={(e) => e.preventDefault()}
            >
              <Box size={isExpanded ? 12 : 10} style={{ color: cidColor }} />
              <code className="font-mono font-bold" style={{ color: cidColor }}>
                {shorten(mod.cid || '', 4, 4)}
              </code>
              <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
            </div>
          )}

          {/* Network badge */}
          {mod.url && (
            <div
              className={`flex items-center gap-1 rounded-lg ${isExpanded ? 'px-3 py-2 text-[13px]' : 'px-2.5 py-1.5 text-[11px]'}`}
              style={{
                background: 'rgba(74, 222, 128, 0.15)',
                border: '1.5px solid rgba(74, 222, 128, 0.5)',
              }}
              onClick={(e) => e.preventDefault()}
            >
              <Globe size={isExpanded ? 11 : 9} className="text-green-400" />
              <span className="font-extrabold text-green-400">live</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (!card_enabled) return cardContent

  return (
    <Link href={`/mod/${mod.name}/${mod.key}`}>
      {cardContent}
    </Link>
  )
}
