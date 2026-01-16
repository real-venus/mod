'use client'

import { userContext } from '@/mod/context/UserContext'
import { ArrowRightOnRectangleIcon, WalletIcon } from '@heroicons/react/24/outline'
import 'react-responsive-modal/styles.css'
import {text2color, shorten} from "@/mod/utils"
import { useRouter } from 'next/navigation'
import WalletAuthButton from '@/mod/wallet/WalletAuthButton'
import { useState, useEffect } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'


async function getKeyBalance(address: string): Promise<number> {

    const provider = new ethers.BrowserProvider(window.ethereum)
    const marketAddress = modConfig.chain['testnet'].contracts.Market.address
    const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)
    
    let balance = await marketContract.balanceOf(address)
    let decimals = await marketContract.decimals()
    decimals = Number(decimals) + 10
    balance = parseFloat(ethers.formatUnits(balance, decimals))
    return balance

}


export function WalletHeader() {
    const {  user, authLoading, signOut, client} = userContext()
    const router = useRouter()
    const [showTooltip, setShowTooltip] = useState(false)
    const [walletMode, setWalletMode] = useState('local')
    const [walletAddress, setWalletAddress] = useState('')
    const [keyUsdtValue, setKeyUsdtValue] = useState<number>(0)
    const [clientKeyUsdtValue, setClientKeyUsdtValue] = useState<number>(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (typeof window !== 'undefined' && user) {
        setWalletMode(localStorage.getItem('wallet_mode') || 'local')
        setWalletAddress(localStorage.getItem('wallet_address') || user.key)
      }
      const fetchBalances = async () => {
        if (user && window.ethereum) {
          try {
            const balance = await getKeyBalance(user.key)
            console.log('Key balance:', balance)
          setKeyUsdtValue(balance)
          } catch (error) {
            console.error('Error fetching key balance:', error)
          }
          try {
            const clientbalance = await getKeyBalance(client.key.address)
            console.log('Client Key balance:', clientbalance)
          setClientKeyUsdtValue(clientbalance)
          } catch (error) {
            console.error('Error fetching key balance:', error)
            
          }
        }
      }
      fetchBalances()
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
                  className="absolute top-full right-0 mt-0 p-5 border-2 rounded-xl shadow-2xl z-50 min-w-[320px] backdrop-blur-xl"
                  style={{
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 1)',
                    borderColor: userColor
                  }}
                >
                  <div className="space-y-3">

                    <div className="space-y-2" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>


                      <div className="p-2 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 0, 0, 1)', borderColor: `${userColor}60` }}>
                        <div className="text-xs text-gray-400 mb-1">key</div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-lg font-bold" style={{ color: 'white' }}>{shorten(walletAddress, 8, 8)}</div>
                          <CopyButton text={walletAddress} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="text-xs text-green-400 font-bold">
                            {loading ? 'Loading...' : `$${keyUsdtValue.toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                      

                      <div className="p-2 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 0, 0, 1)', borderColor: `${userColor}60` }}>
                        <div className="text-xs text-gray-400 mb-1">client key</div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-lg font-bold" style={{ color: 'white' }}>{shorten(client.key.address, 8, 8)}</div>
                          <CopyButton text={client.key.address} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="text-xs text-green-400 font-bold">
                            {loading ? 'Loading...' : `$${clientKeyUsdtValue.toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                      

                      {user.network && (
                        <div className="p-2 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 0, 0, 1)', borderColor: `${userColor}60` }}>
                          <div className="text-lg text-gray-400 mb-1 font-bold">Network Modules</div>
                          <div className="font-mono text-sm" style={{ color: userColor }}>{user.mods?.length || 0}</div>
                        </div>
                      )}
                    </div>
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
