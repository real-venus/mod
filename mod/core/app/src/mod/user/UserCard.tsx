'use client'
import { text2color, shorten } from '@/mod/utils'
import { KeyIcon, CubeIcon } from '@heroicons/react/24/outline'
import { UserType } from '@/mod/types'
import Link from 'next/link'
import { CopyButton } from '@/mod/ui/CopyButton'
import { Clock } from 'lucide-react'
import { useState } from 'react'

interface UserCardProps {
  user: UserType
  mode?: 'explore' | 'page'
}

export const UserCard = ({ user, mode = 'explore' }: UserCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const userColor = text2color(user.key)

  const CardContent = () => (
    <div 
      className="relative border-2 rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02] overflow-hidden group"
      style={{ 
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: `${userColor}20`,
        borderColor: userColor,
        boxShadow: isHovered ? `0 0 40px ${userColor}50, 0 0 80px ${userColor}20` : `0 0 20px ${userColor}30`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${userColor}40, transparent 70%)`
        }}
      />

      <div className="relative p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <KeyIcon className="w-10 h-10 transition-all duration-300 group-hover:rotate-12" style={{ color: userColor }} />
            <div 
              className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-60 transition-opacity"
              style={{ backgroundColor: userColor }}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-gradient-to-r from-black/70 to-black/50 rounded-lg px-4 py-2 flex-1 shadow-lg">
            <code className="text-lg font-bold font-mono tracking-wide" style={{ color: userColor }}>
              {user.key.substring(0, 6)}...{user.key.substring(user.key.length - 6)}
            </code>
            <CopyButton text={user.key} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div 
            className="flex items-center gap-1.5 bg-gradient-to-r from-black/70 to-black/50 rounded-lg px-2 py-1.5 transition-all relative group/key shadow-md hover:scale-105"
            style={{
              backgroundColor: isKeyHovered ? `${userColor}25` : 'rgba(0, 0, 0, 0.7)'
            }}
            onMouseEnter={() => setIsKeyHovered(true)}
            onMouseLeave={() => setIsKeyHovered(false)}
            title={(user.crypto_type || 'sr25519').toLowerCase()}
          >
            <code className="text-sm font-mono font-bold uppercase tracking-wider" style={{ color: userColor }}>
              {(user.crypto_type || 'sr25519').toLowerCase()}
            </code>
            
            {isKeyHovered && (
              <div 
                className="absolute bottom-full left-0 mb-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  borderColor: userColor,
                  color: userColor,
                  boxShadow: `0 0 20px ${userColor}40`
                }}
              >
                {user.crypto_type || 'sr25519'}
              </div>
            )}
          </div>

          {user.mods && user.mods.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md">
              <CubeIcon className="w-5 h-5" style={{ color: '#a855f7' }} />
              <code className="text-sm font-bold font-mono" style={{ color: '#a855f7' }}>
                {user.mods.length}
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (mode === 'explore') {
    return (
      <Link href={`/user/${user.key}`} className="block">
        <CardContent />
      </Link>
    )
  }

  return <CardContent />
}

export default UserCard
