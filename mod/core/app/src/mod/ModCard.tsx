"use client";
import { text2color, shorten, time2str, timeAgo, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, QrCodeIcon } from '@heroicons/react/24/outline'
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

  // Find current index in all versions
  const currentVersionIndex = allVersions.findIndex(v => v.key === mod.key)
  const hasMultipleOwners = allVersions.length > 1
  const hasHistoricalVersions = historicalVersions.length > 0

  const handleOwnerSelect = (ownerKey: string) => {
    if (onVersionSelect) {
      onVersionSelect(ownerKey)
    }
    setOwnerDropdownOpen(false)
  }

  const handleHistoricalSelect = (index: number) => {
    if (onHistoricalVersionChange) {
      onHistoricalVersionChange(index)
    }
    setVersionDropdownOpen(false)
  }

  // Close dropdowns when clicking outside
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Compact single-line layout for expanded page header
  if (compact) {
    return (
      <div
        className="relative overflow-visible group flex items-center gap-6"
        style={{ fontFamily: 'var(--font-digital), monospace' }}
      >
        {/* Name + fn count */}
        <div className="flex items-center gap-3">
          <code
            className="tracking-tight text-4xl flex-shrink-0 uppercase"
            style={{
              color: '#06b6d4',
              textShadow: `0 0 20px rgba(6, 182, 212, 0.9)`,
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-digital), monospace',
              imageRendering: 'pixelated',
            }}
          >
            {mod.name}
          </code>
          <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
        </div>

        {fnCount > 0 && (
          <div
            className="flex items-center gap-1.5 flex-shrink-0 px-4 py-2 text-[14px] font-bold"
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '3px solid rgba(34, 197, 94, 0.4)',
              textShadow: '0 0 10px rgba(34, 197, 94, 0.7)',
              boxShadow: '0 0 15px rgba(34, 197, 94, 0.3)',
              fontFamily: 'var(--font-digital), monospace',
              imageRendering: 'pixelated',
            }}
          >
            <Zap size={14} className="text-green-400" />
            <span className="text-green-400">{fnCount}</span>
          </div>
        )}

        {mod.public === false && (
          <Lock size={16} className="flex-shrink-0 text-red-400" style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }} />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Metadata pills inline */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold"
            style={{
              background: 'rgba(6, 182, 212, 0.1)',
              border: '3px solid rgba(6, 182, 212, 0.3)',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)',
              fontFamily: 'var(--font-digital), monospace',
              imageRendering: 'pixelated',
            }}
          >
            <Clock size={14} className="text-cyan-400" />
            <span className="text-cyan-400" title={updatedTimeStr} style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>{agoStr || updatedTimeStr}</span>
          </div>

          {/* Owner key with dropdown */}
          <div className="relative" ref={ownerDropdownRef}>
            <div
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold cursor-pointer"
              style={{
                background: 'rgba(168, 85, 247, 0.1)',
                border: '3px solid rgba(168, 85, 247, 0.3)',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)',
                fontFamily: 'var(--font-digital), monospace',
                imageRendering: 'pixelated',
              }}
              title={mod.key}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (hasMultipleOwners) setOwnerDropdownOpen(!ownerDropdownOpen)
              }}
            >
              {hasMultipleOwners && (
                <div className="flex items-center gap-0.5 mr-1">
                  <Users size={13} className="text-purple-400" />
                  <span className="text-[11px] font-extrabold text-purple-400">
                    {currentVersionIndex + 1}/{allVersions.length}
                  </span>
                </div>
              )}
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-5 h-5 transition-all duration-200 hover:scale-110 text-purple-400" style={{ strokeWidth: 2.5, filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' }} />
              </Link>
              <code className="font-mono font-bold text-purple-400" style={{ textShadow: '0 0 10px rgba(168, 85, 247, 0.6)' }}>
                {shorten(mod.key, 4, 4)}
              </code>
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
              {hasMultipleOwners && (
                <ChevronDown size={13} className="text-purple-400" />
              )}
            </div>

            {/* Owner Dropdown Menu */}
            {hasMultipleOwners && ownerDropdownOpen && (
              <div
                className="absolute top-full mt-2 right-0 z-50 overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '2px solid rgba(168, 85, 247, 0.4)',
                  boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3), 0 0 30px rgba(168, 85, 247, 0.2)',
                }}
              >
                {allVersions.map((version, idx) => (
                  <div
                    key={version.key}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all"
                    style={{
                      backgroundColor: idx === currentVersionIndex ? colorWithOpacity(modColor, 0.1) : 'transparent',
                      borderBottom: idx < allVersions.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleOwnerSelect(version.key)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colorWithOpacity(modColor, 0.15)
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = idx === currentVersionIndex ? colorWithOpacity(modColor, 0.1) : 'transparent'
                    }}
                  >
                    <KeyIcon className="w-3 h-3" style={{ color: 'var(--text-secondary)', strokeWidth: 2.5 }} />
                    <code className="font-mono text-[10px] font-bold flex-1" style={{ color: 'var(--text-secondary)' }}>
                      {shorten(version.key, 6, 6)}
                    </code>
                    {idx === currentVersionIndex && (
                      <span className="text-[9px] font-bold" style={{ color: modColor }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CID with historical version dropdown */}
          {mod.cid && (
            <div className="relative" ref={versionDropdownRef}>
              <div
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold cursor-pointer"
                style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '3px solid rgba(6, 182, 212, 0.3)',
                  boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)',
                  fontFamily: 'var(--font-digital), monospace',
                  imageRendering: 'pixelated',
                }}
                title={mod.cid}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (hasHistoricalVersions) setVersionDropdownOpen(!versionDropdownOpen)
                }}
              >
                {hasHistoricalVersions && (
                  <div className="flex items-center gap-0.5 mr-1">
                    <GitBranch size={13} className="text-cyan-400" />
                    <span className="text-[11px] font-extrabold text-cyan-400">
                      v{historicalVersions.length - selectedHistoricalIndex}
                    </span>
                  </div>
                )}
                <Box size={14} className="text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.6))' }} />
                <code className="font-mono font-bold text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
                  {shorten(mod.cid || '', 4, 4)}
                </code>
                <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
                {hasHistoricalVersions && (
                  <ChevronDown size={13} className="text-cyan-400" />
                )}
              </div>

              {/* Version Dropdown Menu */}
              {hasHistoricalVersions && versionDropdownOpen && (
                <div
                  className="absolute top-full mt-2 right-0 z-50 overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '2px solid rgba(6, 182, 212, 0.4)',
                    boxShadow: '0 4px 20px rgba(6, 182, 212, 0.3), 0 0 30px rgba(6, 182, 212, 0.2)',
                  }}
                >
                  {historicalVersions.map((version, idx) => {
                    const versionNum = historicalVersions.length - idx
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all"
                        style={{
                          backgroundColor: idx === selectedHistoricalIndex ? colorWithOpacity(modColor, 0.1) : 'transparent',
                          borderBottom: idx < historicalVersions.length - 1 ? '1px solid var(--border-color)' : 'none',
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleHistoricalSelect(idx)
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colorWithOpacity(modColor, 0.15)
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = idx === selectedHistoricalIndex ? colorWithOpacity(modColor, 0.1) : 'transparent'
                        }}
                      >
                        <GitBranch size={9} style={{ color: 'var(--text-tertiary)' }} />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                          v{versionNum}
                        </span>
                        <code className="font-mono text-[9px] flex-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {shorten(version.data || version.cid || '', 6, 6)}
                        </code>
                        {idx === selectedHistoricalIndex && (
                          <span className="text-[9px] font-bold" style={{ color: modColor }}>✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {mod.url && (
            <div
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold"
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '3px solid rgba(34, 197, 94, 0.4)',
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
                fontFamily: 'var(--font-digital), monospace',
                imageRendering: 'pixelated',
              }}
              onClick={(e) => e.preventDefault()}
            >
              <Globe size={14} className="text-green-400" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.7))' }} />
              <span className="text-green-400 uppercase" style={{ textShadow: '0 0 10px rgba(34, 197, 94, 0.7)' }}>live</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const cardContent = (
    <div
      className={`relative font-mono overflow-visible group h-full ${card_enabled ? 'cursor-pointer border-[5px]' : ''}`}
      style={{
        fontFamily: 'var(--font-digital), monospace',
        borderColor: card_enabled ? modColor : undefined,
        imageRendering: 'pixelated',
        borderRadius: '0',
        ...(card_enabled ? {
          background: `linear-gradient(135deg, ${colorWithOpacity(modColor, 0.2)} 0%, ${colorWithOpacity(modColor, 0.08)} 100%)`,
          boxShadow: isHovered ? `0 0 0 4px ${colorWithOpacity(modColor, 0.4)}, 0 10px 0 ${colorWithOpacity(modColor, 0.3)}` : `0 0 0 2px ${colorWithOpacity(modColor, 0.2)}, 0 6px 0 ${colorWithOpacity(modColor, 0.2)}`,
          transition: 'all 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
          transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
        } : {}),
      }}
      onMouseEnter={() => card_enabled && setIsHovered(true)}
      onMouseLeave={() => card_enabled && setIsHovered(false)}
    >


      <div className={`relative ${card_enabled ? 'p-6' : ''}`}>
        {/* Header: icon + name + fn count */}
        <div className={`flex items-start ${isExpanded ? 'gap-5 mb-6' : 'gap-4 mb-6'}`}>
          <div
            className={`flex items-center justify-center flex-shrink-0 ${isExpanded ? 'w-20 h-20' : 'w-16 h-16'}`}
            style={{
              backgroundColor: colorWithOpacity(modColor, 0.2),
              border: `3px solid ${modColor}`,
              boxShadow: `0 0 0 2px ${colorWithOpacity(modColor, 0.3)}, inset 0 0 0 2px ${colorWithOpacity(modColor, 0.1)}`,
              imageRendering: 'pixelated',
            }}
          >
            <CubeIcon
              style={{
                width: isExpanded ? '36px' : '32px',
                height: isExpanded ? '36px' : '32px',
                color: modColor,
                strokeWidth: 3,
                filter: `drop-shadow(2px 2px 0px ${colorWithOpacity(modColor, 0.5)})`,
              }}
            />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2.5">
              <code
                className={`font-black tracking-tight truncate block uppercase ${isExpanded ? 'text-[28px]' : 'text-[22px]'}`}
                style={{
                  color: modColor,
                  textShadow: `3px 3px 0px ${colorWithOpacity(modColor, 0.4)}`,
                  transition: 'all 0.3s ease',
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--font-digital), monospace',
                  imageRendering: 'pixelated',
                }}
              >
                {mod.name}
              </code>
              <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
              {fnCount > 0 && (
                <div
                  className={`flex items-center gap-1.5 flex-shrink-0 ${isExpanded ? 'px-3 py-1.5 text-[14px]' : 'px-2.5 py-1 text-[12px]'}`}
                  style={{
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '2px solid rgba(234, 179, 8, 0.4)',
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                >
                  <Zap size={isExpanded ? 14 : 12} style={{ color: '#eab308' }} />
                  <span className="font-bold text-yellow-500">{fnCount}</span>
                </div>
              )}
              {mod.public === false && (
                <Lock size={isExpanded ? 16 : 14} className="flex-shrink-0" style={{ color: '#ef4444', filter: 'drop-shadow(2px 2px 0px rgba(239, 68, 68, 0.4))' }} />
              )}
            </div>
            {mod.desc && (
              <p className={`font-bold leading-relaxed mt-2 uppercase ${isExpanded ? 'text-[16px]' : 'text-[14px] line-clamp-1'}`} style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital), monospace', letterSpacing: '0.05em' }}>
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
        <div className={`flex items-center overflow-x-auto ${isExpanded ? 'gap-3' : 'gap-2'}`}>
          {/* Timestamp */}
          <div
            className={`flex items-center gap-2 flex-shrink-0 whitespace-nowrap uppercase ${isExpanded ? 'px-4 py-2 text-[12px]' : 'px-3 py-1.5 text-[11px]'}`}
            style={{
              background: colorWithOpacity(modColor, 0.1),
              border: `2px solid ${colorWithOpacity(modColor, 0.3)}`,
              fontFamily: 'var(--font-digital), monospace',
              imageRendering: 'pixelated',
            }}
          >
            <Clock size={isExpanded ? 13 : 11} style={{ color: modColor }} />
            <span className="font-bold" style={{ color: 'var(--text-secondary)' }} title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>
          </div>

          {/* Owner key */}
          <div
            className={`flex items-center gap-2 cursor-default flex-shrink-0 whitespace-nowrap uppercase ${isExpanded ? 'px-4 py-2 text-[12px]' : 'px-3 py-1.5 text-[11px]'}`}
            style={{
              background: colorWithOpacity(keyColor, 0.1),
              border: `2px solid ${colorWithOpacity(keyColor, 0.3)}`,
              fontFamily: 'var(--font-digital), monospace',
              imageRendering: 'pixelated',
            }}
            title={mod.key}
            onClick={(e) => e.preventDefault()}
          >
            <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
              <KeyIcon className={`transition-all duration-200 hover:scale-110 ${isExpanded ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} style={{ color: 'var(--text-secondary)', strokeWidth: 2.5 }} />
            </Link>
            <code className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
              {shorten(mod.key, 4, 4)}
            </code>
            <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
          </div>

          {/* IPFS CID */}
          {mod.cid && (
            <div
              className={`flex items-center gap-2 cursor-default flex-shrink-0 whitespace-nowrap uppercase ${isExpanded ? 'px-4 py-2 text-[12px]' : 'px-3 py-1.5 text-[11px]'}`}
              style={{
                background: colorWithOpacity(cidColor, 0.1),
                border: `2px solid ${colorWithOpacity(cidColor, 0.3)}`,
                fontFamily: 'var(--font-digital), monospace',
                imageRendering: 'pixelated',
              }}
              title={mod.cid}
              onClick={(e) => e.preventDefault()}
            >
              <Box size={isExpanded ? 13 : 11} style={{ color: cidColor }} />
              <code className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                {shorten(mod.cid || '', 4, 4)}
              </code>
              <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
            </div>
          )}

          {/* Network badge */}
          {mod.url && (
            <div
              className={`flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap uppercase ${isExpanded ? 'px-3 py-2 text-[12px]' : 'px-2.5 py-1.5 text-[11px]'}`}
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '2px solid rgba(34, 197, 94, 0.4)',
                fontFamily: 'var(--font-digital), monospace',
                imageRendering: 'pixelated',
              }}
              onClick={(e) => e.preventDefault()}
            >
              <Globe size={isExpanded ? 13 : 11} className="text-green-500" />
              <span className="font-bold text-green-500">LIVE</span>
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
