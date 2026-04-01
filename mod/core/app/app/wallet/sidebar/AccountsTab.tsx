"use client";

import { ArrowPathIcon, ArrowRightOnRectangleIcon, XMarkIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { CopyButton } from '@/ui/CopyButton'

interface WalletHistoryEntry {
  address: string
  mode: string
  type: string
  lastUsed: number
}

interface AccountsTabProps {
  show: boolean
  address: string
  walletMode: string
  walletHistory: WalletHistoryEntry[]
  isSwitchingWallet: boolean
  onSwitchWallet: (wallet: { address: string; mode: string; type: string }) => void
  onRemoveFromHistory: (addr: string) => void
  onSignOut: () => void
}

export function AccountsTab({
  show, address, walletMode, walletHistory,
  isSwitchingWallet, onSwitchWallet, onRemoveFromHistory, onSignOut
}: AccountsTabProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800/50 overflow-hidden"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-600 uppercase tracking-wider font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>ACCOUNTS</span>
            </div>

            {/* Current wallet */}
            <div
              className="flex items-center gap-3 px-3 py-3 border-2 border-cyan-500/40 bg-cyan-500/10 dark:bg-cyan-500/5"
              style={{ borderRadius: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" style={{ boxShadow: '0 0 8px #22c55e80' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-cyan-600 dark:text-cyan-300 uppercase tracking-wider">ACTIVE</span>
                  <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-600 uppercase">{walletMode}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400 truncate">{address}</span>
                  <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <CopyButton text={address} size="sm" />
                  </span>
                </div>
              </div>
            </div>

            {/* Previous wallets */}
            {walletHistory
              .filter(w => w.address.toLowerCase() !== address.toLowerCase())
              .sort((a, b) => b.lastUsed - a.lastUsed)
              .map((wallet) => (
                <div
                  key={wallet.address}
                  className="flex items-center gap-3 px-3 py-3 border border-neutral-300 dark:border-neutral-800/60 bg-neutral-100 dark:bg-neutral-900/80 hover:border-neutral-400 dark:hover:border-neutral-700/60 transition-all group"
                  style={{ borderRadius: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-400 dark:bg-neutral-700 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-500 uppercase">{wallet.mode}</span>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-700">
                        {new Date(wallet.lastUsed).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-mono text-neutral-700 dark:text-neutral-500 truncate">{wallet.address}</span>
                      <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                        <CopyButton text={wallet.address} size="sm" />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onSwitchWallet(wallet)}
                      disabled={isSwitchingWallet}
                      className="px-4 py-2 text-xs font-bold uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all disabled:opacity-40"
                      style={{ borderRadius: '6px' }}
                    >
                      {isSwitchingWallet ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        'USE'
                      )}
                    </button>
                    <button
                      onClick={() => onRemoveFromHistory(wallet.address)}
                      className="p-1.5 text-neutral-500 dark:text-neutral-700 hover:text-red-400 transition-colors"
                      title="Remove from history"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

            {walletHistory.filter(w => w.address.toLowerCase() !== address.toLowerCase()).length === 0 && (
              <div className="text-center py-4 text-neutral-500 dark:text-neutral-700 text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                No previous wallets
              </div>
            )}

            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 mt-2 border-2 border-dashed border-neutral-300 dark:border-neutral-800/60 hover:border-cyan-500/30 bg-transparent hover:bg-cyan-500/5 text-neutral-500 dark:text-neutral-600 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
              style={{ borderRadius: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              <PlusCircleIcon className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Add New Wallet</span>
            </button>

            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 mt-1 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-500/80 dark:text-red-500/60 hover:text-red-400 transition-all"
              style={{ borderRadius: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Sign Out</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
