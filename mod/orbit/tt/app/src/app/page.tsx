"use client";

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'react-toastify'
import { ethers } from 'ethers'
import {
  CubeIcon,
  ArrowPathIcon,
  BoltIcon,
  UserPlusIcon,
  SignalIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8849'

// ── Types ───────────────────────────────────────────────────────────────

interface ConsensusState {
  currentBlock: number
  lastEmissionBlock: number
  totalBlocktime: number
  emissionRate: string
  decayBps: number
  epochLength: number
}

interface ValidatorInfo {
  key: string
  keyHash: string
  keyType: number
  registeredBlock: number
  lastSeenBlock: number
  blocktimeScore: number
  earned: string
  active: boolean
  balance: string
}

interface LeaderEntry {
  keyHash: string
  score: number
  key?: string
}

// ── API helper ──────────────────────────────────────────────────────────

async function api(fn: string, params: Record<string, any> = {}) {
  const res = await fetch(`${API_URL}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.error || 'Request failed')
  }
  const data = await res.json()
  return data.result !== undefined ? data.result : data
}

const KEY_TYPE_LABELS = ['ECDSA', 'Ed25519', 'Sr25519']

// ── Main Page ───────────────────────────────────────────────────────────

function TTPageInner() {
  const [consensus, setConsensus] = useState<ConsensusState | null>(null)
  const [validators, setValidators] = useState<ValidatorInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState('')

  // Register form
  const [regKey, setRegKey] = useState('')
  const [regKeyType, setRegKeyType] = useState(0) // 0=ECDSA, 1=Ed25519, 2=Sr25519
  const [registering, setRegistering] = useState(false)

  // Search/sort
  const [search, setSearch] = useState('')
  type SortKey = 'score' | 'earned' | 'lastSeen'
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Wallet connect ──────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined') return
    const w = window as any
    if (!w.ethereum) { toast.error('Install MetaMask'); return }
    try {
      const provider = new ethers.BrowserProvider(w.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      if (accounts.length > 0) {
        setAccount(accounts[0])
        setConnected(true)
        toast.success(`Connected: ${accounts[0].slice(0, 8)}...`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Connection failed')
    }
  }, [])

  // ── Data fetching ───────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [consensusData, validatorsData] = await Promise.all([
        api('get_consensus').catch(() => null),
        api('get_validators').catch(() => []),
      ])
      if (consensusData) setConsensus(consensusData)
      if (validatorsData) setValidators(validatorsData)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 10s
  useEffect(() => {
    const iv = setInterval(fetchAll, 10000)
    return () => clearInterval(iv)
  }, [fetchAll])

  // ── Actions ─────────────────────────────────────────────────────────

  const handleRegister = useCallback(async () => {
    if (!regKey.trim()) { toast.error('Enter a key'); return }
    setRegistering(true)
    try {
      await api('register', { key: regKey.trim(), key_type: regKeyType })
      toast.success('Validator registered')
      setRegKey('')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed')
    }
    setRegistering(false)
  }, [regKey, regKeyType, fetchAll])

  const handleCheckin = useCallback(async (key: string) => {
    try {
      await api('checkin', { key })
      toast.success('Checked in')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Checkin failed')
    }
  }, [fetchAll])

  const handleProduceBlock = useCallback(async () => {
    try {
      const result = await api('produce_block')
      toast.success(`Block #${result?.block || '?'} produced`)
      fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Block production failed')
    }
  }, [fetchAll])

  const handleDistribute = useCallback(async () => {
    try {
      await api('distribute')
      toast.success('Emissions distributed')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Distribution failed')
    }
  }, [fetchAll])

  // ── Sorting ─────────────────────────────────────────────────────────

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUpDownIcon className="w-3 h-3 text-white/20" />
    return sortDir === 'asc'
      ? <ChevronUpIcon className="w-3 h-3 text-white/60" />
      : <ChevronDownIcon className="w-3 h-3 text-white/60" />
  }

  const processed = useMemo(() => {
    let filtered = validators
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(v =>
        v.key.toLowerCase().includes(q) || v.keyHash.toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'score') cmp = a.blocktimeScore - b.blocktimeScore
      else if (sortKey === 'earned') cmp = Number(BigInt(a.earned || '0') - BigInt(b.earned || '0'))
      else if (sortKey === 'lastSeen') cmp = a.lastSeenBlock - b.lastSeenBlock
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [validators, search, sortKey, sortDir])

  const epochProgress = consensus
    ? ((consensus.currentBlock - consensus.lastEmissionBlock) / consensus.epochLength) * 100
    : 0

  const formatAddr = (s: string) => s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e5e5e5] font-mono">
      <div className="relative z-10 p-4 md:p-6 max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between border border-white/10 rounded-lg p-4 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <CubeIcon className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider uppercase">TT</h1>
              <p className="text-xs text-white/40 uppercase tracking-wider">Blocktime Yuma Consensus</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="text-xs text-emerald-400/70 font-mono">{formatAddr(account)}</span>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
              >
                Connect
              </button>
            )}
            <button
              onClick={fetchAll}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Consensus State */}
        {consensus && (
          <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
            {/* Epoch progress */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Epoch progress</span>
                <span className="text-xs font-bold text-cyan-400">{Math.min(epochProgress, 100).toFixed(1)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Math.max(epochProgress, 0.5), 100)}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-white/25">
                  Block {consensus.currentBlock - consensus.lastEmissionBlock} / {consensus.epochLength}
                </span>
                <span className="text-[10px] text-white/25">Block #{consensus.currentBlock}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 border-t border-white/[0.06]">
              <div className="p-4 text-center border-r border-b md:border-b-0 border-white/[0.06]">
                <p className="text-lg font-bold text-white/90 tabular-nums">{consensus.currentBlock}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Block</p>
              </div>
              <div className="p-4 text-center border-b md:border-b-0 md:border-r border-white/[0.06]">
                <p className="text-lg font-bold text-cyan-400 tabular-nums">{validators.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Validators</p>
              </div>
              <div className="p-4 text-center border-r border-white/[0.06]">
                <p className="text-lg font-bold text-amber-400 tabular-nums">{consensus.totalBlocktime}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Total Score</p>
              </div>
              <div className="p-4 text-center border-r border-white/[0.06]">
                <p className="text-lg font-bold text-emerald-400 tabular-nums">
                  {Number(ethers.formatEther(consensus.emissionRate)).toLocaleString()}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Rate/Epoch</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-lg font-bold text-violet-400 tabular-nums">{(consensus.decayBps / 100).toFixed(1)}%</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Decay</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleProduceBlock}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition-colors"
          >
            <PlayIcon className="w-3.5 h-3.5" /> Produce Block
          </button>
          <button
            onClick={handleDistribute}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-colors"
          >
            <BoltIcon className="w-3.5 h-3.5" /> Distribute
          </button>
        </div>

        {/* Register Panel */}
        <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <UserPlusIcon className="w-4 h-4 text-white/40" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Register Validator</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Key (address, pubkey, or any text identifier)..."
              value={regKey}
              onChange={e => setRegKey(e.target.value)}
              className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
            />
            <select
              value={regKeyType}
              onChange={e => setRegKeyType(Number(e.target.value))}
              className="text-xs px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/70 focus:outline-none focus:border-white/30 transition-colors"
            >
              <option value={0}>ECDSA</option>
              <option value={1}>Ed25519</option>
              <option value={2}>Sr25519</option>
            </select>
            <button
              onClick={handleRegister}
              disabled={registering || !regKey.trim()}
              className="px-4 py-2.5 rounded-lg border border-violet-500/40 bg-violet-500/15 text-violet-300 text-[10px] font-bold uppercase tracking-wider hover:bg-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {registering ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : 'Register'}
            </button>
          </div>
        </div>

        {/* Validators Table */}
        <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 p-4 border-b border-white/5">
            <input
              type="text"
              placeholder="Search key..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
            />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              {processed.length} validator{processed.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_100px_100px_120px_60px] gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.01]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Key</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-center">Type</div>
            <button onClick={() => toggleSort('score')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors justify-end">
              Score <SortIcon col="score" />
            </button>
            <button onClick={() => toggleSort('earned')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors justify-end">
              Earned <SortIcon col="earned" />
            </button>
            <button onClick={() => toggleSort('lastSeen')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors justify-end">
              Last Seen <SortIcon col="lastSeen" />
            </button>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-center">Action</div>
          </div>

          {/* Table Body */}
          {loading && validators.length === 0 ? (
            <div className="text-center py-12">
              <ArrowPathIcon className="w-5 h-5 animate-spin text-white/20 mx-auto mb-2" />
              <span className="text-xs text-white/30">Loading...</span>
            </div>
          ) : processed.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-xs text-white/30 uppercase tracking-wider">No validators registered</span>
            </div>
          ) : (
            <div>
              {processed.map((v) => {
                const keyTypeColor = v.keyType === 0
                  ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  : v.keyType === 1
                  ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                  : 'text-violet-400 border-violet-500/30 bg-violet-500/10'

                return (
                  <div
                    key={v.keyHash}
                    className="grid grid-cols-[1fr_80px_100px_100px_120px_60px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors items-center"
                  >
                    <span
                      className="text-xs font-mono text-white/60 truncate cursor-pointer hover:text-white/90 transition-colors"
                      title={v.key}
                      onClick={() => { navigator.clipboard.writeText(v.key); toast.success('Key copied') }}
                    >
                      {v.key}
                    </span>
                    <div className="flex justify-center">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${keyTypeColor}`}>
                        {KEY_TYPE_LABELS[v.keyType] || '?'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-400/80 text-right tabular-nums">
                      {v.blocktimeScore}
                    </span>
                    <span className="text-xs font-bold text-emerald-400/80 text-right tabular-nums">
                      {v.earned !== '0' ? Number(ethers.formatEther(v.earned)).toFixed(2) : '0'}
                    </span>
                    <span className="text-xs text-white/40 text-right tabular-nums">
                      {v.lastSeenBlock > 0 ? `#${v.lastSeenBlock}` : '--'}
                    </span>
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleCheckin(v.key)}
                        className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                        title="Checkin"
                      >
                        <SignalIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-white/15 uppercase tracking-wider py-4">
          TT Module
        </div>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(TTPageInner), { ssr: false })
