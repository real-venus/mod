'use client'
import { text2color, shorten } from '@/mod/utils'
import { KeyIcon, CubeIcon } from '@heroicons/react/24/outline'
import { UserType } from '@/mod/types'
import Link from 'next/link'
import { CopyButton } from '@/mod/ui/CopyButton'
import { useState } from 'react'

interface UserCardProps {
  user: UserType
  mode?: 'explore' | 'page'
}

export const UserCard = ({ user, mode = 'explore' }: UserCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const userColor = text2color(user.key)

  const CardContent = () => (
    <div 
      className="relative border-2 rounded-xl font-mono transition-all duration-300 cursor-pointer backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02] overflow-hidden group"
      style={{ 
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: 'black',
        borderColor: userColor,
        boxShadow: isHovered ? `0 0 40px ${userColor}50, 0 0 80px ${userColor}20` : `0 0 20px ${userColor}30`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${userColor}40, transparent 70%)`
        }}
      />

      <div className="relative p-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/user/${user.key}`} onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <KeyIcon 
                className="w-12 h-12 transition-all duration-300 hover:scale-110 hover:rotate-12" 
                style={{ color: userColor }} 
              />
              <div 
                className="absolute inset-0 blur-xl opacity-50 group-hover:opacity-75 transition-opacity"
                style={{ backgroundColor: userColor }}
              />
            </div>
          </Link>
          
          <div className="flex items-center gap-2 bg-gradient-to-r from-black/90 to-black/70 border-2 rounded-lg px-4 py-2.5 flex-1 shadow-lg" 
               style={{ borderColor: `${userColor}60` }}>
            <Link href={`/user/${user.key}`} onClick={(e) => e.stopPropagation()} className="hover:underline flex-1">
              <code className="text-lg font-bold font-mono tracking-wide" style={{ color: userColor }}>
                {user.key.substring(0, 10)}...{user.key.substring(user.key.length - 10)}
              </code>
            </Link>
            <CopyButton text={user.key} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div 
            className="px-4 py-2.5 bg-gradient-to-r from-black/90 to-black/70 border-2 rounded-lg font-mono font-bold uppercase tracking-wider shadow-md transition-all hover:scale-105"
            style={{ 
              borderColor: `${userColor}50`,
              color: userColor
            }}
          >
            <span className="text-sm">{(user.crypto_type || 'sr25519').toLowerCase()}</span>
          </div>
          
          {user.mods && user.mods.length > 0 && (
            <div 
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-2 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md" 
              style={{ borderColor: '#a855f770' }}
            >
              <CubeIcon className="w-6 h-6" style={{ color: '#a855f7' }} />
              <code className="text-lg font-bold font-mono" style={{ color: '#a855f7' }}>
                {user.mods.length}
              </code>
              <span className="text-xs text-purple-300 font-bold uppercase ml-1">mods</span>
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
