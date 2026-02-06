"use client";

import { text2color, shorten, colorWithOpacity } from '@/mod/utils'
import { KeyIcon, CubeIcon, SparklesIcon, ClockIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { UserType } from '@/mod/types'
import Link from 'next/link'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { useState } from 'react'

interface UserCardProps {
  user: UserType
  mode?: 'explore' | 'page'
}

export const UserCard = ({ user, mode = 'explore' }: UserCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const [isQrHovered, setIsQrHovered] = useState(false)
  const [isCopyHovered, setIsCopyHovered] = useState(false)
  const [isKeyQrHovered, setIsKeyQrHovered] = useState(false)
  const [isKeyCopyHovered, setIsKeyCopyHovered] = useState(false)
  const userKey = user.key || ''
  const userColor = text2color(userKey)
  const moduleIdentifier = `${userKey}/${userKey.substring(0, 8)}`
  const websiteUrl = typeof window !== 'undefined' ? `${window.location.origin}/user/${userKey}` : ''

  const CardContent = () => (
    <div
      className="relative border-2 rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm overflow-hidden group"
      style={{
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: colorWithOpacity(userColor, 0.03),
        borderColor: userColor,
        boxShadow: isHovered
          ? `0 0 40px ${colorWithOpacity(userColor, 0.3)}, 0 0 80px ${colorWithOpacity(userColor, 0.12)}`
          : `0 0 20px ${colorWithOpacity(userColor, 0.18)}`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colorWithOpacity(userColor, 0.25)}, transparent 70%)`
        }}
      />

      <div className="relative p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <KeyIcon className="w-10 h-10 transition-all duration-300 group-hover:rotate-12" style={{ color: userColor }} />
                <div 
                  className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-60 transition-opacity"
                  style={{ backgroundColor: userColor }}
                />
              </div>
              
              <div 
                className="flex items-center gap-2 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-4 py-2 flex-1 shadow-lg"
                onMouseEnter={() => setIsCopyHovered(true)}
                onMouseLeave={() => setIsCopyHovered(false)}
              >
                <code className="text-lg font-bold font-mono tracking-wide" style={{ color: userColor }}>
                  {isCopyHovered ? userKey : `${userKey.substring(0, 6)}...${userKey.substring(userKey.length - 6)}`}
                </code>
                <CopyButton text={userKey} size="sm" showValueOnHover={false} />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div 
                className="flex items-center gap-1.5 bg-gradient-to-r from-black/50 to-black/30 rounded-lg px-2 py-1.5 transition-all relative group/key shadow-md hover:scale-105"
                onMouseEnter={() => setIsKeyHovered(true)}
                onMouseLeave={() => setIsKeyHovered(false)}
                title={(user.crypto_type || 'sr25519').toLowerCase()}
              >
                <code className="text-sm font-mono font-bold" style={{ color: userColor }}>
                  {(user.crypto_type || 'sr25519').toLowerCase()}
                </code>
                <div
                  onMouseEnter={() => setIsKeyCopyHovered(true)}
                  onMouseLeave={() => setIsKeyCopyHovered(false)}
                >
                  <CopyButton text={user.crypto_type || 'sr25519'} size="sm" showValueOnHover={true} />
                </div>
                <div 
                  className="relative ml-1"
                  onMouseEnter={() => setIsKeyQrHovered(true)}
                  onMouseLeave={() => setIsKeyQrHovered(false)}
                >
                  <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: userColor }} />
                  {isKeyQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                      <QRCode value={user.crypto_type || 'sr25519'} size={100} color={userColor} />
                    </div>
                  )}
                </div>
                
                {isKeyHovered && !isKeyQrHovered && !isKeyCopyHovered && (
                  <div
                    className="absolute bottom-full left-0 mb-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.95)',
                      borderColor: userColor,
                      color: userColor,
                      boxShadow: `0 0 20px ${colorWithOpacity(userColor, 0.25)}`
                    }}
                  >
                    {user.crypto_type || 'sr25519'}
                  </div>
                )}
              </div>

              {user.mods && user.mods.length > 0 && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg px-2 py-1.5 shadow-md transition-all hover:scale-105">
                  <CubeIcon className="w-4 h-4" style={{ color: '#a855f7' }} />
                  <code className="text-sm font-mono font-bold" style={{ color: '#a855f7' }}>
                    {user.mods.length}
                  </code>
                </div>
              )}

              {user.balance !== undefined && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-lg px-2 py-1.5 shadow-md transition-all hover:scale-105">
                  <ClockIcon className="w-4 h-4" style={{ color: '#10b981' }} />
                  <code className="text-sm font-mono font-bold" style={{ color: '#10b981' }}>
                    {user.balance.toLocaleString()}
                  </code>
                </div>
              )}
            </div>
          </div>

          <div 
            className="flex flex-col items-center gap-2 relative"
            onMouseEnter={() => setIsQrHovered(true)}
            onMouseLeave={() => setIsQrHovered(false)}
          >
            <div className="p-2 bg-black/60 rounded-lg border-2" style={{ borderColor: userColor }}>
              <QRCode value={websiteUrl} size={120} color={userColor} />
            </div>
            {isQrHovered && (
              <div
                className="absolute top-full mt-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  borderColor: userColor,
                  color: userColor,
                  boxShadow: `0 0 20px ${colorWithOpacity(userColor, 0.25)}`
                }}
              >
                {websiteUrl}
              </div>
            )}
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
