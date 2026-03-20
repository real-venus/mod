"use client";

import { text2color, shorten, colorWithOpacity } from '@/utils'
import { KeyIcon, CubeIcon, ClockIcon, QrCodeIcon } from '@heroicons/react/24/outline'
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
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const [isQrHovered, setIsQrHovered] = useState(false)
  const [isKeyQrHovered, setIsKeyQrHovered] = useState(false)
  const userKey = user.key || ''
  const userColor = text2color(userKey)
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/user/${userKey}` : ''

  const CardContent = () => (
    <div
      className="relative border-2 rounded-2xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02] overflow-visible group"
      style={{
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: colorWithOpacity(userColor, 0.05),
        borderColor: userColor,
        boxShadow: isHovered
          ? `0 0 50px ${colorWithOpacity(userColor, 0.35)}, 0 0 100px ${colorWithOpacity(userColor, 0.15)}`
          : `0 0 25px ${colorWithOpacity(userColor, 0.2)}`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-500 rounded-2xl"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colorWithOpacity(userColor, 0.3)}, transparent 70%)`
        }}
      />

      <div className="relative p-6">
        <div className="flex items-start gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <KeyIcon className="w-12 h-12 transition-all duration-300 group-hover:rotate-12" style={{ color: userColor }} />
                <div
                  className="absolute inset-0 blur-xl opacity-50 group-hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: userColor }}
                />
              </div>

              <div className="flex items-center gap-3 bg-gradient-to-r from-black/60 to-black/40 rounded-xl px-5 py-3 flex-1 shadow-xl border border-white/10">
                <code className="text-xl font-bold font-mono tracking-wide" style={{ color: userColor }}>
                  {shorten(userKey, 8, 6)}
                </code>
                <CopyButton text={userKey} size="sm" showValueOnHover={true} />
                <div
                  className="relative ml-2"
                  onMouseEnter={() => setIsQrHovered(true)}
                  onMouseLeave={() => setIsQrHovered(false)}
                >
                  <QrCodeIcon className="h-5 w-5 cursor-pointer hover:scale-110 transition-transform" style={{ color: userColor }} />
                  {isQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-black/95 rounded-xl border-2 z-[9999] shadow-2xl" style={{ borderColor: userColor }}>
                      <QRCode value={websiteUrl} size={120} color={userColor} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex items-center gap-2 bg-gradient-to-r from-black/60 to-black/40 rounded-xl px-4 py-2.5 transition-all relative shadow-lg hover:scale-105 border border-white/10"
                onMouseEnter={() => setIsKeyHovered(true)}
                onMouseLeave={() => setIsKeyHovered(false)}
                title={(user.crypto_type || 'sr25519').toLowerCase()}
              >
                <code className="text-base font-mono font-bold" style={{ color: userColor }}>
                  {(user.crypto_type || 'sr25519').toLowerCase()}
                </code>
                <CopyButton text={user.crypto_type || 'sr25519'} size="sm" showValueOnHover={true} />
                <div
                  className="relative ml-1"
                  onMouseEnter={() => setIsKeyQrHovered(true)}
                  onMouseLeave={() => setIsKeyQrHovered(false)}
                >
                  <QrCodeIcon className="h-5 w-5 cursor-pointer hover:scale-110 transition-transform" style={{ color: userColor }} />
                  {isKeyQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-black/95 rounded-xl border-2 z-[9999] shadow-2xl" style={{ borderColor: userColor }}>
                      <QRCode value={user.crypto_type || 'sr25519'} size={120} color={userColor} />
                    </div>
                  )}
                </div>
              </div>

              {user.mods && user.mods.length > 0 && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-xl px-4 py-2.5 shadow-lg transition-all hover:scale-105 border border-purple-500/30">
                  <CubeIcon className="w-5 h-5" style={{ color: '#c084fc' }} />
                  <code className="text-base font-mono font-bold" style={{ color: '#c084fc' }}>
                    {user.mods.length} mods
                  </code>
                </div>
              )}

              {user.balance !== undefined && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl px-4 py-2.5 shadow-lg transition-all hover:scale-105 border border-emerald-500/30">
                  <ClockIcon className="w-5 h-5" style={{ color: '#34d399' }} />
                  <code className="text-base font-mono font-bold" style={{ color: '#34d399' }} suppressHydrationWarning>
                    {user.balance.toLocaleString('en-US')}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (mode === 'explore') {
    return (
      <Link href={`/user/${userKey}`} className="block">
        <CardContent />
      </Link>
    )
  }

  return <CardContent />
}

export default UserCard