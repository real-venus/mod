"use client";
import { text2color, shorten, time2str, timeAgo, colorWithOpacity } from '@/utils'
import { KeyIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { ModuleType } from '@/types'
import Link from 'next/link'
import { CopyButton } from '@/ui/CopyButton'
import { Clock, Zap, Box, Globe, Lock, ChevronDown, Users, GitBranch } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { QRCode } from '@/ui/QRCode'

interface ModCardProps {
  mod: ModuleType
  card_enabled?: boolean
  compact?: boolean
  allVersions?: ModuleType[]
  onVersionSelect?: (modKey: string) => void
  historicalVersions?: any[]
  selectedHistoricalIndex?: number
  onHistoricalVersionChange?: (index: number) => void
}

const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"

export default function ModCard({
  mod,
  card_enabled = true,
  compact = false,
  allVersions = [],
  onVersionSelect,
  historicalVersions = [],
  selectedHistoricalIndex = 0,
  onHistoricalVersionChange
}: ModCardProps) {
  const [isNameQrHovered, setIsNameQrHovered] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false)
  const ownerDropdownRef = useRef<HTMLDivElement>(null)
  const versionDropdownRef = useRef<HTMLDivElement>(null)

  const modColor = text2color(mod.name || mod.key)
  const keyColor = text2color(mod.key)
  const cidColor = text2color(mod.cid || '')
  const updatedTimeStr = mod.updated ? time2str(mod.updated * 1000) : time2str(Date.now())
  const agoStr = mod.updated ? timeAgo(mod.updated * 1000) : ''
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/mod/${mod.name}/${mod.key}` : ''
  const fnCount = mod.schema ? Object.keys(mod.schema).length : 0

  const isExpanded = !card_enabled && !compact

  const currentVersionIndex = allVersions.findIndex(v => v.key === mod.key)
  const hasMultipleOwners = allVersions.length > 1
  const hasHistoricalVersions = historicalVersions.length > 0

  const handleOwnerSelect = (ownerKey: string) => {
    if (onVersionSelect) onVersionSelect(ownerKey)
    setOwnerDropdownOpen(false)
  }

  const handleHistoricalSelect = (index: number) => {
    if (onHistoricalVersionChange) onHistoricalVersionChange(index)
    setVersionDropdownOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target as Node)) {
        setOwnerDropdownOpen(false)
      }
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setVersionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Compact single-line layout for expanded page header
  if (compact) {
    return (
      <div
        className="relative overflow-visible group flex items-center gap-4"
        style={{ fontFamily: TERM_FONT }}
      >
        <div className="flex items-center gap-3">
          <code
            className="tracking-wider text-2xl"
            style={{ color: 'var(--text-primary)', fontFamily: TERM_FONT, textShadow: `0 0 12px ${colorWithOpacity(modColor, 0.4)}` }}
          >
            {mod.name?.toLowerCase()}
          </code>
          <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
        </div>

        {fnCount > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: TERM_FONT }}>
            [{fnCount} fn]
          </span>
        )}

        {mod.public === false && (
          <Lock size={14} className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-3 flex-shrink-0" style={{ fontSize: '13px', fontFamily: TERM_FONT }}>
          <span style={{ color: 'var(--text-tertiary)' }} title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>

          <div className="relative" ref={ownerDropdownRef}>
            <span
              className="cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              title={mod.key}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (hasMultipleOwners) setOwnerDropdownOpen(!ownerDropdownOpen)
              }}
            >
              {hasMultipleOwners && (
                <span style={{ color: 'var(--text-tertiary)', marginRight: '4px' }}>
                  [{currentVersionIndex + 1}/{allVersions.length}]
                </span>
              )}
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()} className="inline">
                <KeyIcon className="w-3.5 h-3.5 inline hover:scale-110 transition-transform" style={{ strokeWidth: 2.5, color: 'var(--text-secondary)' }} />
              </Link>
              {' '}{shorten(mod.key, 4, 4)}
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
              {hasMultipleOwners && <ChevronDown size={10} className="inline ml-1" style={{ color: 'var(--text-tertiary)' }} />}
            </span>

            {hasMultipleOwners && ownerDropdownOpen && (
              <div
                className="absolute top-full mt-2 right-0 z-50 min-w-[200px] max-h-[300px] overflow-y-auto"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              >
                {allVersions.map((version, idx) => (
                  <div
                    key={version.key}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: idx === currentVersionIndex ? colorWithOpacity(modColor, 0.1) : 'transparent',
                      borderBottom: idx < allVersions.length - 1 ? '1px solid var(--border-color)' : 'none',
                      fontFamily: TERM_FONT, fontSize: '12px',
                    }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOwnerSelect(version.key) }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colorWithOpacity(modColor, 0.15) }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx === currentVersionIndex ? colorWithOpacity(modColor, 0.1) : 'transparent' }}
                  >
                    <code style={{ color: 'var(--text-secondary)', fontFamily: TERM_FONT }}>
                      {shorten(version.key, 6, 6)}
                    </code>
                    {idx === currentVersionIndex && <span style={{ color: modColor }}>*</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {mod.cid && (
            <div className="relative" ref={versionDropdownRef}>
              <span
                className="cursor-pointer"
                style={{ color: 'var(--text-tertiary)' }}
                title={mod.cid}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (hasHistoricalVersions) setVersionDropdownOpen(!versionDropdownOpen)
                }}
              >
                {hasHistoricalVersions && (
                  <span style={{ marginRight: '4px' }}>v{historicalVersions.length - selectedHistoricalIndex}</span>
                )}
                {shorten(mod.cid || '', 4, 4)}
                <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
                {hasHistoricalVersions && <ChevronDown size={10} className="inline ml-1" />}
              </span>

              {hasHistoricalVersions && versionDropdownOpen && (
                <div
                  className="absolute top-full mt-2 right-0 z-50 min-w-[200px] max-h-[300px] overflow-y-auto"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                >
                  {historicalVersions.map((version, idx) => {
                    const versionNum = historicalVersions.length - idx
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: idx === selectedHistoricalIndex ? colorWithOpacity(modColor, 0.1) : 'transparent',
                          borderBottom: idx < historicalVersions.length - 1 ? '1px solid var(--border-color)' : 'none',
                          fontFamily: TERM_FONT, fontSize: '12px',
                        }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHistoricalSelect(idx) }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colorWithOpacity(modColor, 0.15) }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = idx === selectedHistoricalIndex ? colorWithOpacity(modColor, 0.1) : 'transparent' }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>v{versionNum}</span>
                        <code className="flex-1 truncate" style={{ color: 'var(--text-tertiary)', fontFamily: TERM_FONT }}>
                          {shorten(version.data || version.cid || '', 6, 6)}
                        </code>
                        {idx === selectedHistoricalIndex && <span style={{ color: modColor }}>*</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {mod.url && (
            <span style={{ color: 'var(--accent-success, #22c55e)' }}>LIVE</span>
          )}
        </div>
      </div>
    )
  }

  const cardContent = (
    <div
      className={`relative overflow-visible group h-full ${card_enabled ? 'cursor-pointer' : ''}`}
      style={{
        fontFamily: TERM_FONT,
        ...(card_enabled ? {
          background: 'var(--bg-secondary)',
          border: `2px solid ${isHovered ? modColor : 'var(--border-color)'}`,
          borderRadius: '6px',
          boxShadow: isHovered
            ? `5px 5px 0px 0px ${modColor}, 0 0 30px ${colorWithOpacity(modColor, 0.35)}, inset 0 0 30px ${colorWithOpacity(modColor, 0.05)}`
            : `3px 3px 0px 0px rgba(255,255,255,0.08), 0 0 0 0 transparent`,
          transition: 'all 0.2s ease',
          imageRendering: 'pixelated' as any,
        } : {}),
      }}
      onMouseEnter={() => card_enabled && setIsHovered(true)}
      onMouseLeave={() => card_enabled && setIsHovered(false)}
    >
      {/* Top accent line - 8bit chunky */}
      {card_enabled && (
        <div style={{
          height: '4px',
          background: isHovered
            ? `linear-gradient(90deg, ${modColor}, ${colorWithOpacity(modColor, 0.6)})`
            : 'var(--border-color)',
          transition: 'background 0.2s ease',
          imageRendering: 'pixelated' as any,
          borderRadius: '6px 6px 0 0',
        }} />
      )}

      <div className={`relative ${card_enabled ? 'p-6' : ''}`}>
        {/* Terminal-style header - 8bit */}
        <div className={`${isExpanded ? 'mb-5' : 'mb-5'}`}>
          <div className="flex items-center gap-3">
            <span style={{ color: modColor, fontSize: '24px', fontWeight: 800, fontFamily: TERM_FONT, textShadow: `0 0 10px ${colorWithOpacity(modColor, 0.6)}, 0 0 20px ${colorWithOpacity(modColor, 0.3)}` }}>$</span>
            <code
              className={`tracking-wider truncate ${isExpanded ? 'text-3xl' : 'text-2xl'}`}
              style={{
                color: 'var(--text-primary)',
                fontFamily: TERM_FONT,
                fontWeight: 700,
                textShadow: isHovered
                  ? `0 0 16px ${colorWithOpacity(modColor, 0.7)}, 0 0 32px ${colorWithOpacity(modColor, 0.4)}`
                  : `0 0 8px ${colorWithOpacity(modColor, 0.4)}`,
                transition: 'text-shadow 0.15s ease',
                letterSpacing: '0.06em',
              }}
            >
              {mod.name}
            </code>
            <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
            {fnCount > 0 && (
              <span
                className="flex-shrink-0"
                style={{ color: 'var(--text-tertiary)', fontSize: '17px', fontFamily: TERM_FONT }}
              >
                [{fnCount}]
              </span>
            )}
            {mod.public === false && (
              <Lock size={16} className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            )}

            {/* QR on hover */}
            <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-auto">
              <div
                className="relative"
                onMouseEnter={() => setIsNameQrHovered(true)}
                onMouseLeave={() => setIsNameQrHovered(false)}
              >
                <div className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                  <QrCodeIcon className="h-4 w-4 cursor-pointer" />
                </div>
                {isNameQrHovered && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 z-[9999]"
                    style={{
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-sidebar)',
                    }}
                  >
                    <QRCode value={websiteUrl} size={120} color={modColor} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {mod.desc && (
            <p
              className={`mt-3 ${isExpanded ? 'text-lg' : 'text-base line-clamp-2'}`}
              style={{
                color: 'var(--text-tertiary)',
                fontFamily: TERM_FONT,
                lineHeight: '1.6',
              }}
            >
              # {mod.desc}
            </p>
          )}
        </div>

        {/* Terminal-style metadata - 8bit */}
        <div className="flex items-center flex-wrap gap-x-6 gap-y-2" style={{ fontSize: '16px', fontFamily: TERM_FONT, color: 'var(--text-tertiary)' }}>
          <span title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>

          <span
            className="cursor-default"
            title={mod.key}
            onClick={(e) => e.preventDefault()}
          >
            <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
              <KeyIcon
                className={`inline hover:scale-110 transition-transform ${isExpanded ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}
                style={{ color: 'var(--text-tertiary)', strokeWidth: 2.5 }}
              />
            </Link>
            {' '}<code style={{ fontFamily: TERM_FONT }}>{shorten(mod.key, 4, 4)}</code>
            <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
          </span>

          {mod.cid && (
            <span
              className="cursor-default"
              title={mod.cid}
              onClick={(e) => e.preventDefault()}
            >
              <code style={{ fontFamily: TERM_FONT }}>{shorten(mod.cid || '', 4, 4)}</code>
              <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
            </span>
          )}

          {mod.url && (
            <span style={{
              color: 'var(--accent-success, #22c55e)',
              fontWeight: 800,
              fontSize: '17px',
              textShadow: '0 0 10px var(--accent-success, #22c55e), 0 0 20px rgba(34, 197, 94, 0.3)',
              letterSpacing: '0.15em',
            }}>
              LIVE
            </span>
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
