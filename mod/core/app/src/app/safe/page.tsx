"use client"

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheckIcon,
  UserGroupIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline'
import { ethers } from 'ethers'
import modConfig from '@/config.json'
import { motion } from 'framer-motion'
import { userContext } from '@/context'
import {
  getSafeInfo,
  getPendingTransactions,
  getExecutedTransactions,
  confirmTransaction,
  executeTransaction,
  type SafeInfo,
  type PendingTransaction,
  type ExecutedTransaction,
} from '@/network/safe'
import { toast } from 'react-toastify'

import { GlowCard } from './GlowCard'
import { OverviewTab } from './OverviewTab'
import { TransactionsTab } from './TransactionsTab'
import { ProposeTab } from './ProposeTab'
import { OwnersTab } from './OwnersTab'
import { ACCENT, inputClass, btnClass } from './shared'

export const dynamic = 'force-dynamic'

type Tab = 'overview' | 'transactions' | 'propose' | 'owners'

export default function SafePage() {
  const { user } = userContext()
  const walletAddress = user?.key || ''

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const defaultSafe = (modConfig.chain as any)?.testnet?.contracts?.Safe?.address || ''
  const [safeAddress, setSafeAddress] = useState(defaultSafe)
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null)
  const [ethBalance, setEthBalance] = useState('0')
  const [loading, setLoading] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const [pendingTxs, setPendingTxs] = useState<PendingTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [executedTxs, setExecutedTxs] = useState<ExecutedTransaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Load Safe info ──
  const loadSafe = useCallback(async () => {
    if (!safeAddress || !ethers.isAddress(safeAddress)) {
      toast.error('Enter a valid Safe address')
      return
    }
    setLoading(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const info = await getSafeInfo(safeAddress, provider)
      setSafeInfo(info)
      setIsOwner(info.owners.some((o: string) => o.toLowerCase() === walletAddress.toLowerCase()))
      const bal = await provider.getBalance(safeAddress)
      setEthBalance(ethers.formatEther(bal))
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to load Safe')
    } finally {
      setLoading(false)
    }
  }, [safeAddress, walletAddress])

  useEffect(() => {
    if (safeAddress && walletAddress) loadSafe()
  }, [walletAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch pending transactions ──
  const fetchPendingTxs = useCallback(async () => {
    if (!safeInfo) return
    setTxLoading(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      const txs = await getPendingTransactions(safeInfo.address, network.chainId)
      setPendingTxs(txs)
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to fetch transactions')
    } finally {
      setTxLoading(false)
    }
  }, [safeInfo])

  // ── Fetch executed transaction history ──
  const fetchHistory = useCallback(async () => {
    if (!safeInfo) return
    setHistoryLoading(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const txs = await getExecutedTransactions(safeInfo.address, provider)
      setExecutedTxs(txs)
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to fetch history')
    } finally {
      setHistoryLoading(false)
    }
  }, [safeInfo])

  useEffect(() => {
    if (activeTab === 'transactions' && safeInfo) {
      fetchPendingTxs()
      fetchHistory()
    }
  }, [activeTab, safeInfo, fetchPendingTxs, fetchHistory])

  // ── Confirm a pending transaction ──
  async function handleConfirm(tx: PendingTransaction) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    setActionLoading(tx.safeTxHash)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const network = await provider.getNetwork()
      await confirmTransaction(safeInfo!.address, tx.safeTxHash, signer, network.chainId)
      toast.success('Transaction confirmed')
      fetchPendingTxs()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Confirmation failed')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Execute a pending transaction ──
  async function handleExecute(tx: PendingTransaction) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    setActionLoading(tx.safeTxHash)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const hash = await executeTransaction(safeInfo!.address, tx, signer)
      toast.success(`Executed: ${hash.slice(0, 10)}...`)
      fetchPendingTxs()
      loadSafe()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Execution failed')
    } finally {
      setActionLoading(null)
    }
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'OVERVIEW', icon: ShieldCheckIcon },
    { key: 'transactions', label: 'TRANSACTIONS', icon: DocumentTextIcon },
    { key: 'propose', label: 'PROPOSE', icon: PaperAirplaneIcon },
    { key: 'owners', label: 'OWNERS', icon: UserGroupIcon },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-white/50 text-sm">Manage multisig accounts and propose transactions</p>
        </motion.div>

        {/* Safe address input */}
        <GlowCard color={ACCENT} delay={0.1} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1 block">Safe Address</label>
              <input type="text" value={safeAddress} onChange={(e) => setSafeAddress(e.target.value)} placeholder="0x..." className={inputClass} />
            </div>
            <div className="flex items-end">
              <button onClick={loadSafe} disabled={loading} className={`${btnClass} bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30`}>
                {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 'Load'}
              </button>
            </div>
          </div>
          {safeInfo && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4 text-amber-500/60" />
                <span className="text-white/50">Owners:</span>
                <span className="text-white font-mono">{safeInfo.owners.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-amber-500/60" />
                <span className="text-white/50">Threshold:</span>
                <span className="text-white font-mono">{safeInfo.threshold}/{safeInfo.owners.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <HashtagIcon className="w-4 h-4 text-amber-500/60" />
                <span className="text-white/50">Nonce:</span>
                <span className="text-white font-mono">{safeInfo.nonce}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/50">ETH:</span>
                <span className="text-white font-mono">{parseFloat(ethBalance).toFixed(4)}</span>
              </div>
              {isOwner && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  You are a signer
                </span>
              )}
            </div>
          )}
        </GlowCard>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-white/[0.06] overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 whitespace-nowrap ${
                  active ? 'text-amber-400' : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="safe-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}80` }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <OverviewTab safeInfo={safeInfo} walletAddress={walletAddress} ethBalance={ethBalance} loading={loading} />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTab
            safeInfo={safeInfo}
            walletAddress={walletAddress}
            isOwner={isOwner}
            pendingTxs={pendingTxs}
            txLoading={txLoading}
            actionLoading={actionLoading}
            executedTxs={executedTxs}
            historyLoading={historyLoading}
            onConfirm={handleConfirm}
            onExecute={handleExecute}
            onRefresh={fetchPendingTxs}
          />
        )}

        {activeTab === 'propose' && (
          <ProposeTab safeInfo={safeInfo} walletAddress={walletAddress} isOwner={isOwner} />
        )}

        {activeTab === 'owners' && (
          <OwnersTab safeInfo={safeInfo} walletAddress={walletAddress} isOwner={isOwner} onReloadSafe={loadSafe} />
        )}
      </div>
    </div>
  )
}
