'use client'

import { useState, useRef, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { WalletIcon, ArrowRightOnRectangleIcon, ClipboardDocumentIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { WalletAuthButton } from './WalletAuthButton'

export function WalletHeader() {
  const { user, signOut } = userContext()
  const [showDropdown, setShowDropdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const address = user?.key || ''
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const walletMode = user?.wallet_mode || ''

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSignOut = () => {
    signOut()
    setShowDropdown(false)
  }

  const handleGoToProfile = () => {
    if (address) {
      router.push(`/user/${address}`)
    }
    setShowDropdown(false)
  }

  // Not signed in - show the auth button
  if (!user) {
    return <WalletAuthButton />
  }

  // Signed in - show wallet icon with dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center justify-center rounded-xl p-3 border-2 border-green-500/40 hover:border-green-500/60 hover:bg-green-500/10 transition-all backdrop-blur-sm"
        style={{ height: '60px', width: '60px', boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' }}
        title={address}
      >
        <div className="relative">
          <WalletIcon className="w-8 h-8" style={{ color: '#10b981' }} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
        </div>
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-2 border-2 border-white/30 rounded-xl shadow-2xl z-50 min-w-[280px] backdrop-blur-xl overflow-hidden"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.15), 0 10px 40px rgba(0, 0, 0, 0.8)'
            }}
          >
            {/* Wallet Info */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                  {walletMode || 'Connected'}
                </span>
              </div>
              <button
                onClick={copyAddress}
                className="w-full text-left font-mono text-sm text-white/80 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-all flex items-center justify-between gap-2"
                title="Click to copy address"
              >
                <span className="truncate">{shortAddress}</span>
                <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0" />
              </button>
              {copied && (
                <span className="text-xs text-green-400 mt-1 block">✓ Copied!</span>
              )}
            </div>

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={handleGoToProfile}
                className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm font-medium"
              >
                <UserCircleIcon className="w-5 h-5" />
                <span>My Profile</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-sm font-medium"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
