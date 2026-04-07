"use client";

import { text2color, shorten, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, ClockIcon, QrCodeIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { UserType } from '@/types'
import Link from 'next/link'
import { CopyButton } from '@/ui/CopyButton'
import { QRCode } from '@/ui/QRCode'
import { useState } from 'react'

interface UserCardProps {
  user: UserType
  mode?: 'explore' | 'page'
}

export const UserCard = ({ user, mode = 'explore' }: UserCardProps) => {
  const [isQrHovered, setIsQrHovered] = useState(false)
  const userKey = user.key || ''
  const userColor = text2color(userKey)
  const shortAddress = userKey ? `${userKey.slice(0, 6)}...${userKey.slice(-4)}` : ''
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/user/${userKey}` : ''

  return (
    <div
      className="relative flex items-center gap-0"
      style={{ fontFamily: 'var(--font-digital), monospace' }}
    >
      <div
        className="flex items-center"
        style={{
          height: '46px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          border: `1px solid ${colorWithOpacity(userColor, 0.4)}`,
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: `0 0 20px ${colorWithOpacity(userColor, 0.1)}, inset 0 1px 0 ${colorWithOpacity(userColor, 0.05)}`,
          transition: 'all 0.2s ease',
        }}
      >
        {/* Key icon */}
        <div className="flex items-center justify-center h-[46px] px-3 flex-shrink-0">
          <KeyIcon className="w-5 h-5" style={{ color: userColor, filter: `drop-shadow(0 0 6px ${colorWithOpacity(userColor, 0.5)})` }} />
        </div>

        {/* Separator */}
        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: colorWithOpacity(userColor, 0.2) }} />

        {/* Address */}
        <div className="flex items-center gap-2 px-3 h-[46px]">
          <code className="text-base font-bold tracking-wide tabular-nums" style={{ color: userColor }}>
            {shortAddress}
          </code>
          <CopyButton text={userKey} size="sm" showValueOnHover={true} />
          <div
            className="relative"
            onMouseEnter={() => setIsQrHovered(true)}
            onMouseLeave={() => setIsQrHovered(false)}
          >
            <QrCodeIcon className="h-4 w-4 cursor-pointer hover:scale-110 transition-transform" style={{ color: colorWithOpacity(userColor, 0.6) }} />
            {isQrHovered && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 rounded-xl border-2 z-[9999] shadow-2xl"
                style={{ backgroundColor: 'rgba(0,0,0,0.95)', borderColor: userColor }}
              >
                <QRCode value={websiteUrl} size={120} color={userColor} />
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: colorWithOpacity(userColor, 0.2) }} />

        {/* Crypto type badge */}
        <div className="flex items-center gap-1.5 px-3 h-[46px]">
          <code className="text-xs font-bold uppercase tracking-wider" style={{ color: '#06b6d4' }}>
            {(user.crypto_type || 'sr25519').toLowerCase()}
          </code>
        </div>

        {/* Separator */}
        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: colorWithOpacity(userColor, 0.2) }} />

        {/* Mods count */}
        {user.mods && user.mods.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-3 h-[46px]">
              <CubeIcon className="w-4 h-4" style={{ color: '#c084fc' }} />
              <code className="text-xs font-bold tabular-nums" style={{ color: '#c084fc' }}>
                {user.mods.length} mods
              </code>
            </div>
            <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: colorWithOpacity(userColor, 0.2) }} />
          </>
        )}

        {/* Balance */}
        {user.balance !== undefined && (
          <>
            <div className="flex items-center gap-1.5 px-3 h-[46px]">
              <ClockIcon className="w-4 h-4" style={{ color: '#34d399' }} />
              <code className="text-xs font-bold tabular-nums" style={{ color: '#34d399' }} suppressHydrationWarning>
                {user.balance.toLocaleString('en-US')}
              </code>
            </div>
            <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: colorWithOpacity(userColor, 0.2) }} />
          </>
        )}

        {/* Go to page button */}
        {mode === 'explore' && (
          <Link
            href={`/user/${userKey}`}
            className="flex items-center gap-1.5 px-3 h-[46px] transition-all hover:opacity-80"
            style={{ color: userColor, borderRadius: '0 12px 12px 0' }}
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">PAGE</span>
          </Link>
        )}
      </div>
    </div>
  )
}

export default UserCard
