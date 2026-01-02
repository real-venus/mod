'use client'

import { useUserContext } from '@/bloc/context/UserContext'
import { ArrowRightOnRectangleIcon, KeyIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/bloc/ui/CopyButton'
import 'react-responsive-modal/styles.css'
import {text2color, shorten} from "@/bloc/utils"
import { useRouter } from 'next/navigation'
import WalletAuthButton from '@/bloc/wallet/WalletAuthButton'



export function UserHeader() {
  const {  user, authLoading, signOut} = useUserContext()
  const router = useRouter()

  const handleSignOut = () => {
    signOut()
  }

    const handleUserClick = () => {
      if (user?.key) {
        router.push(`/user/${user.key}`)
      }
    }

    if (authLoading) {
      return (
        <div className="flex items-center gap-3 px-6 py-3 rounded-full border-2 backdrop-blur-xl shadow-2xl animate-pulse" style={{height: '60px', minWidth: '60px', borderColor: 'rgba(255, 255, 255, 0.8)', backgroundColor: 'rgba(0, 0, 0, 0.9)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)'}}>
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
    const walletMode = localStorage.getItem('wallet_mode') || 'local'
    const walletAddress = localStorage.getItem('wallet_address') || user.key

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
      const glowColor = `rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.3)`

      const getTooltipContent = () => {
        return `Address: ${shorten(user.key)}\nWallet: ${walletMode.toUpperCase()}\nConnected: ${shorten(walletAddress)}\nType: ${user.crypto_type}`
      }

      return (

      <div
        onClick={handleUserClick}
        className={`group relative flex items-center gap-3 transition-all duration-300 backdrop-blur-xl rounded-full border-2 overflow-hidden hover:shadow-2xl cursor-pointer hover:scale-105 active:scale-95`}
          style={{
            borderColor: borderColor,
            boxShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
            height: '60px',
            minWidth: '60px',
            width:  'auto' ,
            paddingRight: '16px',
            paddingLeft: '0px',
            paddingTop: '0px',
            paddingBottom: '0px',
            backgroundColor: 'rgba(0, 0, 0, 0.95)'
        }}
        title={getTooltipContent()}
      >
        <div className="absolute -inset-1 bg-gradient-to-r opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500 rounded-full animate-pulse" style={{ background: `linear-gradient(45deg, ${userColor}, transparent, ${userColor})` }} />
    
          <div 
            className="relative z-10 rounded-full transition-all hover:scale-110 active:scale-95 flex-shrink-0"
            style={{
              height: '60px',
              width: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.2)`,
              boxShadow: `inset 0 0 20px rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.3), 0 0 15px rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.4)`
            }}
          >
              <KeyIcon className="w-10 h-10" style={{ color: userColor, filter: 'drop-shadow(0 0 8px currentColor)' }} />
          </div>
          <div className="relative z-10 flex flex-col gap-1">
            <CopyButton text={user.key} size="md" style={{ color: 'white' }} />
          </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
                className="relative z-10 px-4 py-2 rounded-full border-2 transition-all hover:scale-110 active:scale-95 flex items-center gap-2"
                style={{
                  borderColor: borderColor,
                  backgroundColor: `rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.15)`,
                  color: 'white',
                  boxShadow: `0 0 10px rgba(${userRgb.r}, ${userRgb.g}, ${userRgb.b}, 0.3)`
                }}
                title="Sign Out"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
        </div>


      )
  }
