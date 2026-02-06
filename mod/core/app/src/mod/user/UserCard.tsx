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
      className="relative border-2 rounded-2xl font-mono transition-all duration-500 cursor-pointer backdrop-blur-md overflow-hidden group"
      style={{
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: colorWithOpacity(userColor, 0.05),
        borderColor: userColor,
        boxShadow: isHovered
          ? `0 0 50px ${colorWithOpacity(userColor, 0.4)}, 0 0 100px ${colorWithOpacity(userColor, 0.15)}, inset 0 0 30px ${colorWithOpacity(userColor, 0.08)}`
          : `0 0 25px ${colorWithOpacity(userColor, 0.2)}, 0 4px 12px rgba(0, 0, 0, 0.4)`,
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-700"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colorWithOpacity(userColor, 0.35)}, transparent 70%)`
        }}
      />

      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(${userColor}22 1px, transparent 1px), linear-gradient(90deg, ${userColor}22 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />

      <div className="relative p-6">
        <div className="flex items-start gap-5">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group/icon">
                <div
                  className="absolute inset-0 blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-500"
                  style={{ backgroundColor: userColor }}
                />
                <div
                  className="relative p-2.5 rounded-xl border-2 bg-black/60 backdrop-blur-sm transition-all duration-300 group-hover/icon:scale-110 group-hover/icon:rotate-12"
                  style={{ borderColor: userColor }}
                >
                  <KeyIcon className="w-8 h-8 transition-all duration-300" style={{ color: userColor }} />
                </div>
              </div>

              <div
                className="flex items-center gap-2.5 bg-gradient-to-br from-black/70 via-black/60 to-black/50 rounded-xl px-4 py-3 flex-1 shadow-xl border border-white/5 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl"
                onMouseEnter={() => setIsCopyHovered(true)}
                onMouseLeave={() => setIsCopyHovered(false)}
                style={{
                  boxShadow: isCopyHovered
                    ? `0 0 30px ${colorWithOpacity(userColor, 0.25)}, 0 4px 16px rgba(0, 0, 0, 0.5)`
                    : '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}
              >
                <code
                  className="text-lg font-bold font-mono tracking-wide transition-all duration-300"
                  style={{
                    color: userColor,
                    textShadow: `0 0 10px ${colorWithOpacity(userColor, 0.5)}`
                  }}
                >
                  {isCopyHovered ? userKey : `${userKey.substring(0, 6)}...${userKey.substring(userKey.length - 6)}`}
                </code>
                <CopyButton text={userKey} size="sm" showValueOnHover={false} />
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div
                className="flex items-center gap-2 bg-gradient-to-br from-black/70 via-black/60 to-black/50 rounded-xl px-3 py-2 transition-all duration-300 relative group/key shadow-lg hover:scale-105 border border-white/5 backdrop-blur-sm"
                onMouseEnter={() => setIsKeyHovered(true)}
                onMouseLeave={() => setIsKeyHovered(false)}
                title={(user.crypto_type || 'sr25519').toLowerCase()}
                style={{
                  boxShadow: isKeyHovered
                    ? `0 0 25px ${colorWithOpacity(userColor, 0.2)}`
                    : '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}
              >
                <code
                  className="text-sm font-mono font-bold"
                  style={{
                    color: userColor,
                    textShadow: `0 0 8px ${colorWithOpacity(userColor, 0.4)}`
                  }}
                >
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
                  <QrCodeIcon className="h-4 w-4 cursor-pointer transition-transform hover:scale-110" style={{ color: userColor }} />
                  {isKeyQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2.5 bg-black/95 rounded-xl border-2 z-50 shadow-2xl backdrop-blur-md" style={{ borderColor: userColor }}>
                      <QRCode value={user.crypto_type || 'sr25519'} size={100} color={userColor} />
                    </div>
                  )}
                </div>

                {isKeyHovered && !isKeyQrHovered && !isKeyCopyHovered && (
                  <div
                    className="absolute bottom-full left-0 mb-2 px-4 py-2 rounded-xl border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.95)',
                      borderColor: userColor,
                      color: userColor,
                      boxShadow: `0 0 25px ${colorWithOpacity(userColor, 0.3)}`
                    }}
                  >
                    {user.crypto_type || 'sr25519'}
                  </div>
                )}
              </div>

              {user.mods && user.mods.length > 0 && (
                <div
                  className="flex items-center gap-2 bg-gradient-to-br from-purple-950/50 via-purple-900/40 to-pink-900/40 rounded-xl px-3 py-2 shadow-lg transition-all duration-300 hover:scale-105 border border-purple-500/20 backdrop-blur-sm group/mods"
                  style={{
                    boxShadow: '0 2px 8px rgba(168, 85, 247, 0.15)'
                  }}
                >
                  <CubeIcon className="w-4 h-4 transition-transform group-hover/mods:rotate-12" style={{ color: '#a855f7' }} />
                  <code className="text-sm font-mono font-bold" style={{ color: '#a855f7', textShadow: '0 0 10px rgba(168, 85, 247, 0.4)' }}>
                    {user.mods.length}
                  </code>
                </div>
              )}

              {user.balance !== undefined && (
                <div
                  className="flex items-center gap-2 bg-gradient-to-br from-emerald-950/50 via-emerald-900/40 to-teal-900/40 rounded-xl px-3 py-2 shadow-lg transition-all duration-300 hover:scale-105 border border-emerald-500/20 backdrop-blur-sm group/balance"
                  style={{
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
                  }}
                >
                  <ClockIcon className="w-4 h-4 transition-transform group-hover/balance:rotate-12" style={{ color: '#10b981' }} />
                  <code className="text-sm font-mono font-bold" style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}>
                    {user.balance.toLocaleString()}
                  </code>
                </div>
              )}
            </div>
          </div>

          <div
            className="flex flex-col items-center gap-2 relative group/qr"
            onMouseEnter={() => setIsQrHovered(true)}
            onMouseLeave={() => setIsQrHovered(false)}
          >
            <div
              className="relative p-3 bg-gradient-to-br from-black/80 via-black/70 to-black/60 rounded-xl border-2 shadow-xl backdrop-blur-sm transition-all duration-500 group-hover/qr:scale-105"
              style={{
                borderColor: userColor,
                boxShadow: isQrHovered
                  ? `0 0 40px ${colorWithOpacity(userColor, 0.4)}, 0 8px 24px rgba(0, 0, 0, 0.5)`
                  : `0 0 20px ${colorWithOpacity(userColor, 0.2)}, 0 4px 16px rgba(0, 0, 0, 0.4)`
              }}
            >
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover/qr:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at center, ${colorWithOpacity(userColor, 0.1)}, transparent 70%)`
                }}
              />
              <div className="relative">
                <QRCode value={websiteUrl} size={120} color={userColor} />
              </div>
            </div>
            {isQrHovered && (
              <div
                className="absolute top-full mt-2 px-4 py-2 rounded-xl border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  borderColor: userColor,
                  color: userColor,
                  boxShadow: `0 0 25px ${colorWithOpacity(userColor, 0.3)}`
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
