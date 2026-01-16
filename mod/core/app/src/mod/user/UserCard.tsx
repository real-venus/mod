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
      className="border rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:border-opacity-80 shadow-lg"
      style={{ 
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: 'black',
        borderColor: userColor
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/user/${user.key}`} onClick={(e) => e.stopPropagation()}>
            <KeyIcon className="w-8 h-8" style={{ color: userColor }} />
          </Link>
          
          <div className="flex items-center gap-1 bg-black border rounded-lg px-3 py-1.5" style={{ borderColor: `${userColor}40` }}>
            <Link href={`/user/${user.key}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
              <code className="text-base font-mono" style={{ color: userColor }}>
                {user.key.substring(0, 8)}...{user.key.substring(user.key.length - 8)}
              </code>
            </Link>
            <CopyButton text={user.key} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-400 text-xs px-3 py-1.5 bg-black border-2 border-gray-500/30 rounded-lg font-mono">
            {(user.crypto_type || 'sr25519').toLowerCase()}
          </span>
          
          {user.mods && user.mods.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-black border-2 border-purple-500/30 rounded-lg">
              <CubeIcon className="w-5 h-5" style={{ color: '#a855f7' }} />
              <code className="text-base font-mono" style={{ color: '#a855f7' }}>
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
