'use client'

import { userContext } from '@/mod/context/UserContext'
import { ArrowRightOnRectangleIcon, WalletIcon } from '@heroicons/react/24/outline'
import 'react-responsive-modal/styles.css'
import {text2color, shorten} from "@/mod/utils"
import { useRouter } from 'next/navigation'
import WalletAuthButton from '@/mod/wallet/WalletAuthButton'
import { useState } from 'react'
import WalletInfoTabs from './WalletInfoTabs'
import { motion, AnimatePresence } from 'framer-motion'

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

          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute left-0 mt-2 p-6 border-2 rounded-xl shadow-2xl z-50 min-w-[450px] backdrop-blur-xl"
                style={{
                  top: 'calc(100% + 8px)',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  borderColor: userColor,
                  boxShadow: `0 0 30px ${userColor}40, 0 10px 40px rgba(0, 0, 0, 0.8)`
                }}
              >
                <div className="space-y-4">
                  {/* Wallet Info Tabs */}
                  <WalletInfoTabs />

                  {user.network && (
                    <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
                      <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Network Modules</div>
                      <div className="font-mono text-lg font-bold" style={{ color: userColor }}>{user.mods?.length || 0}</div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t-2" style={{ borderColor: `${userColor}40`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
                      className="px-4 py-2 border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 rounded-lg ml-auto font-bold"
                      style={{
                        borderColor: userColor,
                        backgroundColor: `${userColor}20`,
                        color: userColor,
                        fontFamily: 'IBM Plex Mono, Courier New, monospace'
                      }}
                      title="Sign Out"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5" />
                      <span className="text-sm">SIGN OUT</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
}