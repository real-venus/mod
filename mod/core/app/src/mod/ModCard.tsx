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
        className="relative overflow-visible group flex items-center gap-4"
        style={{ fontFamily: 'var(--font-digital), monospace' }}
      >
        {/* Icon */}
        <div
          className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-xl"
          style={{
            backgroundColor: colorWithOpacity(modColor, 0.1),
            border: `2px solid var(--text-primary)`,
          }}
        >
          <CubeIcon style={{ width: '18px', height: '18px', color: 'var(--text-primary)', strokeWidth: 2.5 }} />
        </div>

        {/* Name + fn count */}
        <div className="flex items-center gap-2">
          <code
            className="font-digital tracking-tight text-3xl flex-shrink-0"
            style={{ color: 'var(--text-primary)' }}
          >
            {mod.name}
          </code>
          <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
        </div>

        {fnCount > 0 && (
          <div
            className="flex items-center gap-1 rounded-full flex-shrink-0 px-2 py-0.5 text-[10px]"
            style={{
              background: 'var(--bg-input)',
              border: '1.5px solid var(--border-color)',
            }}
          >
            <Zap size={9} style={{ color: 'var(--text-secondary)' }} />
            <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{fnCount}</span>
          </div>
        )}

        {mod.public === false && (
          <Lock size={12} className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Metadata pills inline */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px]"
            style={{
              background: 'var(--bg-input)',
              border: '1.5px solid var(--border-color)',
            }}
          >
            <Clock size={9} style={{ color: 'var(--text-tertiary)' }} />
            <span className="font-bold" style={{ color: 'var(--text-secondary)' }} title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>
          </div>

          {/* Owner key with dropdown */}
          <div className="relative" ref={ownerDropdownRef}>
            <div
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] cursor-pointer"
              style={{
                background: 'var(--bg-input)',
                border: '1.5px solid var(--border-color)',
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
                  <Users size={9} style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-[9px] font-extrabold" style={{ color: 'var(--text-tertiary)' }}>
                    {currentVersionIndex + 1}/{allVersions.length}
                  </span>
                </div>
              )}
              <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-3 h-3 transition-all duration-200 hover:scale-110" style={{ color: 'var(--text-secondary)', strokeWidth: 2.5 }} />
              </Link>
              <code className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                {shorten(mod.key, 4, 4)}
              </code>
              <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
              {hasMultipleOwners && (
                <ChevronDown size={11} style={{ color: 'var(--text-secondary)' }} />
              )}
            </div>

            {/* Owner Dropdown Menu */}
            {hasMultipleOwners && ownerDropdownOpen && (
              <div
                className="absolute top-full mt-1 right-0 z-50 rounded-lg overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1.5px solid var(--border-color)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] cursor-pointer"
                style={{
                  background: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
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
                    <GitBranch size={9} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-[9px] font-extrabold" style={{ color: 'var(--text-tertiary)' }}>
                      v{historicalVersions.length - selectedHistoricalIndex}
                    </span>
                  </div>
                )}
                <Box size={9} style={{ color: 'var(--text-tertiary)' }} />
                <code className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {shorten(mod.cid || '', 4, 4)}
                </code>
                <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
                {hasHistoricalVersions && (
                  <ChevronDown size={11} style={{ color: 'var(--text-secondary)' }} />
                )}
              </div>

              {/* Version Dropdown Menu */}
              {hasHistoricalVersions && versionDropdownOpen && (
                <div
                  className="absolute top-full mt-1 right-0 z-50 rounded-lg overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1.5px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px]"
              style={{
                background: 'var(--bg-input)',
                border: '1.5px solid var(--border-color)',
              }}
              onClick={(e) => e.preventDefault()}
            >
              <Globe size={8} className="text-green-500" />
              <span className="font-bold text-green-500">live</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const cardContent = (
    <div
      className={`relative font-mono overflow-visible group rounded-2xl h-full ${card_enabled ? 'cursor-pointer border-2 border-black dark:border-white' : ''}`}
      style={{
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        ...(card_enabled ? {
          background: `linear-gradient(135deg, ${colorWithOpacity(modColor, 0.15)} 0%, ${colorWithOpacity(modColor, 0.05)} 100%)`,
          boxShadow: isHovered ? `0 8px 24px ${colorWithOpacity(modColor, 0.2)}` : `0 2px 8px ${colorWithOpacity(modColor, 0.1)}`,
          transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        } : {}),
      }}
      onMouseEnter={() => card_enabled && setIsHovered(true)}
      onMouseLeave={() => card_enabled && setIsHovered(false)}
    >


      <div className={`relative ${card_enabled ? 'p-6' : ''}`}>
        {/* Header: icon + name + fn count */}
        <div className={`flex items-start ${isExpanded ? 'gap-5 mb-5' : 'gap-4 mb-5'}`}>
          <div
            className={`flex items-center justify-center flex-shrink-0 ${isExpanded ? 'w-16 h-16 rounded-2xl' : 'w-13 h-13 rounded-xl'}`}
            style={{
              backgroundColor: colorWithOpacity(modColor, 0.1),
              border: `2px solid var(--text-primary)`,
            }}
          >
            <CubeIcon
              style={{
                width: isExpanded ? '28px' : '24px',
                height: isExpanded ? '28px' : '24px',
                color: 'var(--text-primary)',
                strokeWidth: 2.5,
              }}
            />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2.5">
              <code
                className={`font-black font-mono tracking-tight truncate block ${isExpanded ? 'text-[28px]' : 'text-[17px]'}`}
                style={{
                  color: 'var(--text-primary)',
                  textShadow: 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {mod.name}
              </code>
              <CopyButton text={mod.name} size="sm" showValueOnHover={true} />
              {fnCount > 0 && (
                <div
                  className={`flex items-center gap-1 rounded-full flex-shrink-0 ${isExpanded ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[10px]'}`}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-color)',
                  }}
                >
                  <Zap size={isExpanded ? 11 : 9} style={{ color: 'var(--text-secondary)' }} />
                  <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{fnCount}</span>
                </div>
              )}
              {mod.public === false && (
                <Lock size={isExpanded ? 14 : 12} className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              )}
            </div>
            {mod.desc && (
              <p className={`font-extrabold leading-relaxed mt-1.5 ${isExpanded ? 'text-[14px]' : 'text-[12px] line-clamp-1'}`} style={{ color: 'var(--text-secondary)' }}>
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
        <div className={`flex items-center overflow-x-auto ${isExpanded ? 'gap-2.5' : 'gap-1.5'}`}>
          {/* Timestamp */}
          <div
            className={`flex items-center gap-1.5 rounded-lg flex-shrink-0 whitespace-nowrap ${isExpanded ? 'px-3 py-1.5 text-[12px]' : 'px-2.5 py-1 text-[10px]'}`}
            style={{
              background: 'var(--bg-input)',
              border: '1.5px solid var(--border-color)',
            }}
          >
            <Clock size={isExpanded ? 11 : 9} style={{ color: 'var(--text-tertiary)' }} />
            <span className="font-bold" style={{ color: 'var(--text-secondary)' }} title={updatedTimeStr}>{agoStr || updatedTimeStr}</span>
          </div>

          {/* Owner key */}
          <div
            className={`flex items-center gap-1.5 rounded-lg cursor-default flex-shrink-0 whitespace-nowrap ${isExpanded ? 'px-3 py-1.5 text-[12px]' : 'px-2.5 py-1 text-[10px]'}`}
            style={{
              background: 'var(--bg-input)',
              border: '1.5px solid var(--border-color)',
            }}
            title={mod.key}
            onClick={(e) => e.preventDefault()}
          >
            <Link href={`/user/${mod.key}`} onClick={(e) => e.stopPropagation()}>
              <KeyIcon className={`transition-all duration-200 hover:scale-110 ${isExpanded ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} style={{ color: 'var(--text-secondary)', strokeWidth: 2.5 }} />
            </Link>
            <code className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
              {shorten(mod.key, 4, 4)}
            </code>
            <CopyButton text={mod.key} size="sm" showValueOnHover={true} />
          </div>

          {/* IPFS CID */}
          {mod.cid && (
            <div
              className={`flex items-center gap-1.5 rounded-lg cursor-default flex-shrink-0 whitespace-nowrap ${isExpanded ? 'px-3 py-1.5 text-[12px]' : 'px-2.5 py-1 text-[10px]'}`}
              style={{
                background: 'var(--bg-input)',
                border: '1.5px solid var(--border-color)',
              }}
              title={mod.cid}
              onClick={(e) => e.preventDefault()}
            >
              <Box size={isExpanded ? 11 : 9} style={{ color: 'var(--text-tertiary)' }} />
              <code className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                {shorten(mod.cid || '', 4, 4)}
              </code>
              <CopyButton text={mod.cid || ''} size="sm" showValueOnHover={true} />
            </div>
          )}

          {/* Network badge */}
          {mod.url && (
            <div
              className={`flex items-center gap-1 rounded-lg flex-shrink-0 whitespace-nowrap ${isExpanded ? 'px-2.5 py-1.5 text-[12px]' : 'px-2 py-1 text-[10px]'}`}
              style={{
                background: 'var(--bg-input)',
                border: '1.5px solid var(--border-color)',
              }}
              onClick={(e) => e.preventDefault()}
            >
              <Globe size={isExpanded ? 10 : 8} className="text-green-500" />
              <span className="font-bold text-green-500">live</span>
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
