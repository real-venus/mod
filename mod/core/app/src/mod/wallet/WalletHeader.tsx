'use client'

import { userContext } from '@/mod/context/UserContext'
import { ArrowRightOnRectangleIcon, WalletIcon } from '@heroicons/react/24/outline'
import 'react-responsive-modal/styles.css'
import {text2color, shorten} from "@/mod/utils"
import { useRouter } from 'next/navigation'
import WalletAuthButton from '@/mod/wallet/WalletAuthButton'
import { useState, useEffect } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'



export function WalletHeader() {
  const {  user, authLoading, signOut} = userContext()
  const router = useRouter()
  const [showTooltip, setShowTooltip] = useState(false)
  const [walletMode, setWalletMode] = useState('local')
  const [walletAddress, setWalletAddress] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      setWalletMode(localStorage.getItem('wallet_mode') || 'local')
      setWalletAddress(localStorage.getItem('wallet_address') || user.key)
    }
  }, [user])

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
        <div className="flex items-center gap-3 px-6 py-3 border-2 backdrop-blur-xl shadow-2xl animate-pulse" style={{height: '60px', minWidth: '60px', borderRadius: '16px', borderColor: 'rgba(255, 255, 255, 0.8)', backgroundColor: 'rgba(0, 0, 0, 0.9)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)'}}>
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-xl text-white/70 font-bold hidden sm:inline">Loading...</span>
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

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 220, g: 38, b: 38 }
    }
    
      const userRgb = hexToRgb(userColor)
      const borderColor = 'rgba(255, 255, 255, 0.9)'

      return (
        <div className="flex items-center gap-3">
          <div
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`group relative flex items-center gap-3 transition-all duration-300 backdrop-blur-xl border-2 overflow-visible cursor-pointer hover:scale-105 active:scale-95 bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/40 rounded-lg shadow hover:shadow-md`}
              style={{
                height: '60px',
                minWidth: '60px',
                width:  '60px',
                paddingRight: '0px',
                paddingLeft: '0px',
                paddingTop: '0px',
                paddingBottom: '0px',
                borderRadius: '8px'
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
                className="absolute top-full right-0 mt-2 p-4 border rounded-lg shadow-2xl z-50 min-w-[320px] bg-gradient-to-br from-slate-900/70 to-slate-800/50 border-slate-700/40"
                style={{
                  borderRadius: '8px'
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: `rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.3)` }}>
                    <span className="text-sm font-bold" style={{ color: userColor }}>WALLET INFO</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
                      className="px-3 py-1.5 border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                      style={{
                        borderColor: borderColor,
                        backgroundColor: `rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.15)`,
                        color: 'white',
                        borderRadius: '8px'
                      }}
                      title="Sign Out"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      <span className="font-bold text-xs">SIGN OUT</span>
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Wallet Type</div>
                      <div className="font-mono text-sm uppercase font-bold" style={{ color: userColor, fontSize: '1rem' }}>{walletMode}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Key Type</div>
                      <div className="font-mono text-sm uppercase font-bold" style={{ color: userColor, fontSize: '1rem' }}>{user.crypto_type}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Address</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm" style={{ color: 'white' }}>{shorten(user.key, 8, 8)}</div>
                        <CopyButton text={user.key} size="sm" />
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Connected Address</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm" style={{ color: 'white' }}>{shorten(walletAddress, 8, 8)}</div>
                        <CopyButton text={walletAddress} size="sm" />
                      </div>
                    </div>
                    
                    {user.network && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Network Modules</div>
                        <div className="font-mono text-sm" style={{ color: userColor }}>{user.mods?.length || 0}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      )
  }
