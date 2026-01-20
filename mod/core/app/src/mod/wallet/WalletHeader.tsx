'use client'

import { userContext } from '@/mod/context/UserContext'
import { ArrowRightOnRectangleIcon, WalletIcon } from '@heroicons/react/24/outline'
import 'react-responsive-modal/styles.css'
import {text2color, shorten} from "@/mod/utils"
import { useRouter } from 'next/navigation'
import WalletAuthButton from '@/mod/wallet/WalletAuthButton'
import { useState } from 'react'
import WalletInfoTabs from './WalletInfoTabs'

export function WalletHeader() {
    const {  user, authLoading, signOut} = userContext()
    const router = useRouter()
    const [showTooltip, setShowTooltip] = useState(false)

    const handleSignOut = () => {
      signOut()
      setShowTooltip(false)
    }

    const handleUserClick = () => {
      if (user?.key) {
        router.push(`/user/${user.key}`)
      }
    }

    if (authLoading) {
      return (
        <div className="flex items-center gap-3 px-6 py-3 border-2 backdrop-blur-xl shadow-2xl animate-pulse" style={{height: '60px', minWidth: '60px', borderRadius: '8px', borderColor: 'rgba(255, 255, 255, 0.8)', backgroundColor: 'rgba(0, 0, 0, 0.9)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)'}}>
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-xl text-white/70 font-bold hidden sm:inline" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>Loading...</span>
        </div>
      )
    }

    if (!user) {
      return (
        <div className="flex items-center gap-4">
          <WalletAuthButton />
        </div>
      )
    }

    const userColor = text2color(user.key)

    return (
      <div className="flex items-center gap-3">
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`group relative flex items-center gap-3 transition-all duration-300 backdrop-blur-xl border-2 overflow-visible cursor-pointer hover:scale-105 active:scale-95 rounded-xl font-mono`}
          style={{
            height: '60px',
            minWidth: '60px',
            width: showTooltip ? 'auto' : '60px',
            paddingRight: showTooltip ? '16px' : '0px',
            paddingLeft: '0px',
            paddingTop: '0px',
            paddingBottom: '0px',
            borderRadius: '8px',
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
            backgroundColor: `${userColor}15`,
            borderColor: userColor
          }}
          title="Wallet Details"
        >
          <div className="absolute -inset-1 bg-gradient-to-r opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500 animate-pulse" style={{ background: `linear-gradient(45deg, ${userColor}, transparent, ${userColor})`, borderRadius: '8px' }} />
      
          <div 
            onClick={handleUserClick}
            className="relative z-10 transition-all hover:scale-110 active:scale-95 flex-shrink-0"
            style={{
              height: '60px',
              width: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              boxShadow: 'none',
              borderRadius: '8px'
            }}
          >
            <WalletIcon className="w-10 h-10" style={{ color: userColor, filter: 'drop-shadow(0 0 8px currentColor)' }} />
          </div>

          {showTooltip && (
            <div 
              className="absolute top-full right-0 mt-0 p-5 border-2 rounded-xl shadow-2xl z-50 min-w-[400px] backdrop-blur-xl"
              style={{
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 1)',
                borderColor: userColor
              }}
            >
              <div className="space-y-3">
                {/* Wallet Info Tabs */}
                <WalletInfoTabs />

                {user.network && (
                  <div className="p-2 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 0, 0, 1)', borderColor: `${userColor}60` }}>
                    <div className="text-lg text-gray-400 mb-1 font-bold">Network Modules</div>
                    <div className="font-mono text-sm" style={{ color: userColor }}>{user.mods?.length || 0}</div>
                  </div>
                )}
                
                <div className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: userColor, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
                    className="px-3 py-1.5 border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 rounded-lg ml-auto"
                    style={{
                      borderColor: userColor,
                      backgroundColor: `${userColor}20`,
                      color: userColor,
                      fontFamily: 'IBM Plex Mono, Courier New, monospace'
                    }}
                    title="Sign Out"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    <span className="font-bold text-xs">SIGN OUT</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
}