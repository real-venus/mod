"use client";

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheckIcon,
  UserGroupIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline'
import { ethers } from 'ethers'
import modConfig from '@/config.json'
import { CopyButton } from '@/ui/CopyButton'
import { motion } from 'framer-motion'
import { userContext } from '@/context'
import {
  getSafeInfo,
  proposeSafeTransaction,
  getPendingTransactions,
  confirmTransaction,
  executeTransaction,
  removeStalePendingTxs,
  encodeAddOwnerWithThreshold,
  encodeRemoveOwner,
  encodeChangeThreshold,
  encodeContractCall,
  type SafeInfo,
  type PendingTransaction,
  type SafeTxParams,
} from '@/network/safe'
import { toast } from 'react-toastify'
import { shorten } from '@/utils'

// ABI imports
import TreasuryABI from '@/contracts/treasury/Treasury.sol/Treasury.json'
import MarketABI from '@/contracts/market/Market.sol/Market.json'
import DebitABI from '@/contracts/market/debit/Debit.sol/Debit.json'
import RegistryABI from '@/contracts/registry/Registry.sol/Registry.json'
import ManualPriceOracleABI from '@/contracts/oracles/ManualPriceOracle.sol/ManualPriceOracle.json'
import TokenGateABI from '@/contracts/tokengate/TokenGate.sol/TokenGate.json'
import BlocTimeABI from '@/contracts/bloctime/BlocTime.sol/BlocTime.json'
import TokenABI from '@/contracts/token/Token.sol/Token.json'

export const dynamic = 'force-dynamic'

type Tab = 'overview' | 'transactions' | 'propose' | 'owners'

// ── ABI map: contract name → ABI ──
const CONTRACT_ABIS: Record<string, any[]> = {
  Treasury: TreasuryABI.abi,
  Market: MarketABI.abi,
  Debit: DebitABI.abi,
  Registry: RegistryABI.abi,
  ManualPriceOracle: ManualPriceOracleABI.abi,
  TokenGate: TokenGateABI.abi,
  BlocTime: BlocTimeABI.abi,
  NativeToken: TokenABI.abi,
  USDC: TokenABI.abi,
  USDT: TokenABI.abi,
}

// Get write functions from ABI
function getWriteFunctions(abi: any[]): { name: string; inputs: any[]; outputs?: any[] }[] {
  return abi
    .filter(
      (item: any) =>
        item.type === 'function' &&
        item.stateMutability !== 'view' &&
        item.stateMutability !== 'pure'
    )
    .map((item: any) => ({
      name: item.name,
      inputs: item.inputs || [],
      outputs: item.outputs || [],
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
}

// Get read (view/pure) functions from ABI
function getReadFunctions(abi: any[]): { name: string; inputs: any[]; outputs: any[] }[] {
  return abi
    .filter(
      (item: any) =>
        item.type === 'function' &&
        (item.stateMutability === 'view' || item.stateMutability === 'pure')
    )
    .map((item: any) => ({
      name: item.name,
      inputs: item.inputs || [],
      outputs: item.outputs || [],
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
}

// Get contracts from config
function getContracts(): { name: string; address: string }[] {
  const chainConfig = (modConfig.chain as any)?.testnet
  if (!chainConfig?.contracts) return []
  // Treasury first, then alphabetical
  const entries = Object.entries(chainConfig.contracts) as [string, any][]
  const treasury = entries.find(([name]) => name === 'Treasury')
  const rest = entries
    .filter(([name]) => name !== 'Treasury' && name !== 'Safe')
    .sort(([a], [b]) => a.localeCompare(b))
  const ordered = treasury ? [treasury, ...rest] : rest
  return ordered.map(([name, val]) => ({ name, address: val.address }))
}

// ── Glow card wrapper ──
function GlowCard({ children, color, delay = 0, className = '' }: {
  children: React.ReactNode; color: string; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={`relative group ${className}`}
    >
      <div
        className="absolute -inset-[1px] rounded-xl opacity-40 group-hover:opacity-60 blur-sm transition-opacity duration-500"
        style={{ background: `linear-gradient(135deg, ${color}40, transparent 60%)` }}
      />
      <div className="relative bg-black/80 border border-white/[0.08] rounded-xl p-6 backdrop-blur-xl h-full">
        {children}
      </div>
    </motion.div>
  )
}

export default function SafePage() {
  const { user } = userContext()
  const walletAddress = user?.key || ''

  // ── Global state ──
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const defaultSafe = (modConfig.chain as any)?.testnet?.contracts?.Safe?.address || ''
  const [safeAddress, setSafeAddress] = useState(defaultSafe)
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null)
  const [ethBalance, setEthBalance] = useState('0')
  const [loading, setLoading] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  // ── Transaction state ──
  const [pendingTxs, setPendingTxs] = useState<PendingTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Propose state ──
  const [selectedContract, setSelectedContract] = useState('')
  const [selectedFunction, setSelectedFunction] = useState('')
  const [fnArgs, setFnArgs] = useState<string[]>([])
  const [ethValue, setEthValue] = useState('')
  const [proposing, setProposing] = useState(false)
  const [proposeMode, setProposeMode] = useState<'write' | 'read'>('write')

  // ── Read state ──
  const [selectedReadFunction, setSelectedReadFunction] = useState('')
  const [readArgs, setReadArgs] = useState<string[]>([])
  const [readResult, setReadResult] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  // ── Send ETH state ──
  const [sendEthTo, setSendEthTo] = useState('')
  const [sendEthAmount, setSendEthAmount] = useState('')
  const [sendingEth, setSendingEth] = useState(false)

  // ── Last tx params for verification ──
  const [lastTxParams, setLastTxParams] = useState<SafeTxParams | null>(null)

  // ── Owner management state ──
  const [newOwnerAddr, setNewOwnerAddr] = useState('')
  const [newThreshold, setNewThreshold] = useState('')
  const [removeOwnerAddr, setRemoveOwnerAddr] = useState('')
  const [removeThreshold, setRemoveThreshold] = useState('')
  const [changeThresholdVal, setChangeThresholdVal] = useState('')
  const [ownerLoading, setOwnerLoading] = useState<string | null>(null)

  const contracts = getContracts()
  const selectedContractInfo = contracts.find((c) => c.name === selectedContract)
  const abi = selectedContract ? CONTRACT_ABIS[selectedContract] : null
  const writeFunctions = abi ? getWriteFunctions(abi) : []
  const selectedFn = writeFunctions.find((f) => f.name === selectedFunction)
  const readFunctions = abi ? getReadFunctions(abi) : []
  const selectedReadFn = readFunctions.find((f) => f.name === selectedReadFunction)

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
      setIsOwner(
        info.owners.some((o: string) => o.toLowerCase() === walletAddress.toLowerCase())
      )
      const bal = await provider.getBalance(safeAddress)
      setEthBalance(ethers.formatEther(bal))
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to load Safe')
    } finally {
      setLoading(false)
    }
  }, [safeAddress, walletAddress])

  // Auto-load on mount if default address exists
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

  useEffect(() => {
    if (activeTab === 'transactions' && safeInfo) fetchPendingTxs()
  }, [activeTab, safeInfo, fetchPendingTxs])

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

  // ── Propose a contract transaction ──
  async function handlePropose() {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    if (!safeInfo) { toast.error('Load Safe first'); return }
    if (!selectedContractInfo || !selectedFn || !abi) { toast.error('Select contract and function'); return }
    setProposing(true)
    setLastTxParams(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const network = await provider.getNetwork()

      const data = encodeContractCall(abi, selectedFn.name, fnArgs)
      const weiValue = ethValue ? ethers.parseEther(ethValue) : BigInt(0)
      const { safeTxHash, params } = await proposeSafeTransaction(
        safeInfo.address,
        selectedContractInfo.address,
        data,
        signer,
        network.chainId,
        weiValue
      )
      setLastTxParams(params)
      toast.success(`Proposed: ${safeTxHash.slice(0, 10)}...`)
      setSelectedFunction('')
      setFnArgs([])
      setEthValue('')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Proposal failed')
    } finally {
      setProposing(false)
    }
  }

  // ── Send native ETH from Safe ──
  async function handleSendEth() {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    if (!safeInfo) { toast.error('Load Safe first'); return }
    if (!ethers.isAddress(sendEthTo)) { toast.error('Invalid recipient address'); return }
    if (!sendEthAmount || parseFloat(sendEthAmount) <= 0) { toast.error('Enter an amount'); return }
    setSendingEth(true)
    setLastTxParams(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const network = await provider.getNetwork()

      const weiValue = ethers.parseEther(sendEthAmount)
      const { safeTxHash, params } = await proposeSafeTransaction(
        safeInfo.address,
        sendEthTo,
        '0x',  // no data for plain ETH transfer
        signer,
        network.chainId,
        weiValue
      )
      setLastTxParams(params)
      toast.success(`ETH transfer proposed: ${safeTxHash.slice(0, 10)}...`)
      setSendEthTo('')
      setSendEthAmount('')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'ETH transfer proposal failed')
    } finally {
      setSendingEth(false)
    }
  }

  // ── Read a contract function ──
  async function handleRead() {
    if (!selectedContractInfo || !selectedReadFn || !abi) { toast.error('Select contract and function'); return }
    setReading(true)
    setReadResult(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(selectedContractInfo.address, abi, provider)
      const result = await contract[selectedReadFn.name](...readArgs)

      // Format the result
      if (Array.isArray(result)) {
        const formatted = result.map((v: any, i: number) => {
          const outputName = selectedReadFn.outputs[i]?.name || `[${i}]`
          return `${outputName}: ${v.toString()}`
        })
        setReadResult(formatted.join('\n'))
      } else {
        setReadResult(result.toString())
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Read failed')
      setReadResult(`Error: ${err?.message || 'Read failed'}`)
    } finally {
      setReading(false)
    }
  }

  // ── Owner management proposals ──
  async function proposeOwnerChange(label: string, data: string) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    if (!safeInfo) { toast.error('Load Safe first'); return }
    setOwnerLoading(label)
    setLastTxParams(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const network = await provider.getNetwork()
      const { safeTxHash, params } = await proposeSafeTransaction(
        safeInfo.address,
        safeInfo.address, // self-call
        data,
        signer,
        network.chainId
      )
      setLastTxParams(params)
      toast.success(`${label} proposed: ${safeTxHash.slice(0, 10)}...`)
      loadSafe()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || `${label} failed`)
    } finally {
      setOwnerLoading(null)
    }
  }

  function handleAddOwner() {
    if (!ethers.isAddress(newOwnerAddr)) { toast.error('Invalid address'); return }
    const thresh = parseInt(newThreshold) || safeInfo!.threshold
    const data = encodeAddOwnerWithThreshold(newOwnerAddr, thresh)
    proposeOwnerChange('Add Owner', data)
  }

  function handleRemoveOwner() {
    if (!ethers.isAddress(removeOwnerAddr)) { toast.error('Invalid address'); return }
    if (!safeInfo) return
    const ownerIndex = safeInfo.owners.findIndex(
      (o) => o.toLowerCase() === removeOwnerAddr.toLowerCase()
    )
    if (ownerIndex < 0) { toast.error('Address is not an owner'); return }
    // prevOwner: for linked list, use SENTINEL (0x1) for first owner, otherwise previous
    const prevOwner = ownerIndex === 0
      ? '0x0000000000000000000000000000000000000001'
      : safeInfo.owners[ownerIndex - 1]
    const thresh = parseInt(removeThreshold) || Math.max(safeInfo.threshold - 1, 1)
    const data = encodeRemoveOwner(prevOwner, removeOwnerAddr, thresh)
    proposeOwnerChange('Remove Owner', data)
  }

  function handleChangeThreshold() {
    const thresh = parseInt(changeThresholdVal)
    if (!thresh || thresh < 1) { toast.error('Invalid threshold'); return }
    if (safeInfo && thresh > safeInfo.owners.length) { toast.error('Threshold > owners'); return }
    const data = encodeChangeThreshold(thresh)
    proposeOwnerChange('Change Threshold', data)
  }

  // Reset function selection when contract changes
  useEffect(() => {
    setSelectedFunction('')
    setFnArgs([])
    setSelectedReadFunction('')
    setReadArgs([])
    setReadResult(null)
  }, [selectedContract])

  // Reset args when write function changes
  useEffect(() => {
    if (selectedFn) setFnArgs(new Array(selectedFn.inputs.length).fill(''))
    else setFnArgs([])
  }, [selectedFunction]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset args when read function changes
  useEffect(() => {
    if (selectedReadFn) setReadArgs(new Array(selectedReadFn.inputs.length).fill(''))
    else setReadArgs([])
    setReadResult(null)
  }, [selectedReadFunction]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab config ──
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'OVERVIEW', icon: ShieldCheckIcon },
    { key: 'transactions', label: 'TRANSACTIONS', icon: DocumentTextIcon },
    { key: 'propose', label: 'PROPOSE', icon: PaperAirplaneIcon },
    { key: 'owners', label: 'OWNERS', icon: UserGroupIcon },
  ]

  const ACCENT = '#f59e0b'

  // ── Input/select styling ──
  const inputClass = 'w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-white/30 focus:border-amber-500/50 focus:outline-none transition-colors'
  const selectClass = 'w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none transition-colors appearance-none cursor-pointer'
  const btnClass = 'px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheckIcon className="w-8 h-8 text-amber-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Safe Manager
            </h1>
          </div>
          <p className="text-white/50 text-sm">Manage multisig accounts and propose transactions</p>
        </motion.div>

        {/* Safe address input */}
        <GlowCard color={ACCENT} delay={0.1} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1 block">Safe Address</label>
              <input
                type="text"
                value={safeAddress}
                onChange={(e) => setSafeAddress(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadSafe}
                disabled={loading}
                className={`${btnClass} bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30`}
              >
                {loading ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : 'Load'}
              </button>
            </div>
          </div>

          {/* Quick info bar */}
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

        {/* ============================== OVERVIEW ============================== */}
        {activeTab === 'overview' && safeInfo && (
          <div className="space-y-4">
            <GlowCard color={ACCENT} delay={0.1}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">Owners</h2>
              <div className="space-y-2">
                {safeInfo.owners.map((owner, i) => {
                  const isMe = owner.toLowerCase() === walletAddress.toLowerCase()
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                        isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.03]'
                      }`}
                    >
                      {isMe && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                      <span className="font-mono text-sm text-white/80 flex-1 break-all">{owner}</span>
                      <CopyButton text={owner} size="sm" />
                      {isMe && (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">you</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </GlowCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlowCard color={ACCENT} delay={0.2}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Threshold</div>
                <div className="text-2xl font-bold text-white">{safeInfo.threshold} <span className="text-white/30 text-lg">/ {safeInfo.owners.length}</span></div>
                <div className="text-xs text-white/40 mt-1">confirmations required</div>
              </GlowCard>
              <GlowCard color={ACCENT} delay={0.25}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Nonce</div>
                <div className="text-2xl font-bold text-white font-mono">{safeInfo.nonce}</div>
                <div className="text-xs text-white/40 mt-1">transactions executed</div>
              </GlowCard>
              <GlowCard color={ACCENT} delay={0.3}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">ETH Balance</div>
                <div className="text-2xl font-bold text-white font-mono">{parseFloat(ethBalance).toFixed(4)}</div>
                <div className="text-xs text-white/40 mt-1">native balance</div>
              </GlowCard>
            </div>

            <GlowCard color={ACCENT} delay={0.35}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Safe Address</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white/80 break-all">{safeInfo.address}</span>
                <CopyButton text={safeInfo.address} size="sm" />
              </div>
            </GlowCard>
          </div>
        )}

        {activeTab === 'overview' && !safeInfo && !loading && (
          <GlowCard color={ACCENT}>
            <div className="text-center py-8 text-white/40">
              <ShieldCheckIcon className="w-12 h-12 mx-auto mb-3 text-amber-500/30" />
              <p>Enter a Safe address and click Load to get started</p>
            </div>
          </GlowCard>
        )}

        {/* ============================== TRANSACTIONS ============================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70">Pending Transactions</h2>
              <div className="flex gap-2">
                {safeInfo && pendingTxs.some((tx) => tx.nonce < safeInfo.nonce) && (
                  <button
                    onClick={() => {
                      const removed = removeStalePendingTxs(safeInfo.address, safeInfo.nonce)
                      toast.success(`Removed ${removed} stale transaction(s)`)
                      fetchPendingTxs()
                    }}
                    className={`${btnClass} bg-red-500/10 text-red-400/70 border border-red-500/20 hover:bg-red-500/20 text-xs`}
                  >
                    Clear Stale
                  </button>
                )}
                <button
                  onClick={fetchPendingTxs}
                  disabled={txLoading || !safeInfo}
                  className={`${btnClass} bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 text-xs`}
                >
                  {txLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Refresh'}
                </button>
              </div>
            </div>

            {!safeInfo && (
              <GlowCard color={ACCENT}>
                <p className="text-white/40 text-center py-4">Load a Safe first</p>
              </GlowCard>
            )}

            {safeInfo && pendingTxs.length === 0 && !txLoading && (
              <GlowCard color={ACCENT}>
                <p className="text-white/40 text-center py-4">No pending transactions</p>
              </GlowCard>
            )}

            {pendingTxs.map((tx, i) => {
              const confirmCount = tx.confirmations?.length || 0
              const needed = tx.confirmationsRequired
              const isStale = safeInfo ? tx.nonce < safeInfo.nonce : false
              const canExecute = confirmCount >= needed && !isStale
              const alreadyConfirmed = tx.confirmations?.some(
                (c) => c.owner.toLowerCase() === walletAddress.toLowerCase()
              )
              const isActionLoading = actionLoading === tx.safeTxHash

              return (
                <GlowCard key={tx.safeTxHash} color={canExecute ? '#10b981' : ACCENT} delay={i * 0.05}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70">Nonce {tx.nonce}</span>
                          {isStale ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                              expired (nonce used)
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              canExecute
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {confirmCount}/{needed} {canExecute ? 'ready' : 'pending'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50 mb-1">
                          <span className="text-white/30">To:</span>{' '}
                          <span className="font-mono">{shorten(tx.to)}</span>
                          {contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase()) && (
                            <span className="ml-2 text-amber-500/60">
                              ({contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase())!.name})
                            </span>
                          )}
                        </div>
                        {tx.data && tx.data !== '0x' && (
                          <div className="text-xs text-white/30 font-mono truncate max-w-md">
                            {tx.data.slice(0, 66)}...
                          </div>
                        )}
                        {tx.value !== '0' && (
                          <div className="text-xs text-white/50 mt-1">
                            Value: <span className="font-mono text-white/70">{ethers.formatEther(tx.value)} ETH</span>
                          </div>
                        )}
                        <div className="text-[10px] text-white/20 mt-1">
                          {new Date(tx.submissionDate).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {isOwner && !alreadyConfirmed && !canExecute && (
                          <button
                            onClick={() => handleConfirm(tx)}
                            disabled={isActionLoading}
                            className={`${btnClass} bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 text-xs`}
                          >
                            {isActionLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Confirm'}
                          </button>
                        )}
                        {alreadyConfirmed && !canExecute && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400/60">
                            <CheckCircleIcon className="w-4 h-4" /> Signed
                          </span>
                        )}
                        {canExecute && (
                          <button
                            onClick={() => handleExecute(tx)}
                            disabled={isActionLoading}
                            className={`${btnClass} bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs`}
                          >
                            {isActionLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Execute'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Confirmations list */}
                    {tx.confirmations && tx.confirmations.length > 0 && (
                      <div className="border-t border-white/[0.06] pt-2">
                        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Confirmations</div>
                        <div className="flex flex-wrap gap-2">
                          {tx.confirmations.map((c, ci) => (
                            <span key={ci} className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-[10px] font-mono text-white/50">
                              <CheckCircleIcon className="w-3 h-3 text-emerald-400/60" />
                              {shorten(c.owner, 4, 4)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </GlowCard>
              )
            })}
          </div>
        )}

        {/* ============================== PROPOSE ============================== */}
        {activeTab === 'propose' && (
          <div className="space-y-4">
            {!safeInfo ? (
              <GlowCard color={ACCENT}>
                <p className="text-white/40 text-center py-4">Load a Safe first</p>
              </GlowCard>
            ) : (
              <>
                <GlowCard color={ACCENT} delay={0.1}>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">Contract Interaction</h2>

                  {/* Contract selector */}
                  <div className="mb-4">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Contract</label>
                    <select
                      value={selectedContract}
                      onChange={(e) => setSelectedContract(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select a contract...</option>
                      {contracts.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({shorten(c.address, 6, 4)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Write / Read toggle */}
                  {selectedContract && (
                    <div className="flex gap-1 mb-4 p-1 bg-white/[0.03] rounded-lg">
                      <button
                        onClick={() => setProposeMode('write')}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                          proposeMode === 'write'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'text-white/30 hover:text-white/50'
                        }`}
                      >
                        Write
                      </button>
                      <button
                        onClick={() => setProposeMode('read')}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                          proposeMode === 'read'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-white/30 hover:text-white/50'
                        }`}
                      >
                        Read
                      </button>
                    </div>
                  )}

                  {/* ── WRITE MODE ── */}
                  {proposeMode === 'write' && (
                    <>
                      {/* Function selector */}
                      {selectedContract && writeFunctions.length > 0 && (
                        <div className="mb-4">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Function</label>
                          <select
                            value={selectedFunction}
                            onChange={(e) => setSelectedFunction(e.target.value)}
                            className={selectClass}
                          >
                            <option value="">Select a function...</option>
                            {writeFunctions.map((fn) => (
                              <option key={fn.name} value={fn.name}>
                                {fn.name}({fn.inputs.map((inp: any) => `${inp.type} ${inp.name}`).join(', ')})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedContract && writeFunctions.length === 0 && (
                        <p className="text-white/30 text-sm">No write functions found for this contract ABI</p>
                      )}

                      {/* Function arguments */}
                      {selectedFn && selectedFn.inputs.length > 0 && (
                        <div className="mb-4 space-y-3">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 block">Arguments</label>
                          {selectedFn.inputs.map((inp: any, i: number) => (
                            <div key={i}>
                              <label className="text-[10px] text-white/30 mb-0.5 block">
                                {inp.name || `arg${i}`} <span className="text-amber-500/40">({inp.type})</span>
                              </label>
                              {inp.type === 'bool' ? (
                                <select
                                  value={fnArgs[i] || ''}
                                  onChange={(e) => {
                                    const next = [...fnArgs]
                                    next[i] = e.target.value
                                    setFnArgs(next)
                                  }}
                                  className={selectClass}
                                >
                                  <option value="">Select...</option>
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={fnArgs[i] || ''}
                                  onChange={(e) => {
                                    const next = [...fnArgs]
                                    next[i] = e.target.value
                                    setFnArgs(next)
                                  }}
                                  placeholder={inp.type}
                                  className={inputClass}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ETH value */}
                      {selectedFn && (
                        <div className="mb-4">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">ETH Value (optional)</label>
                          <input
                            type="text"
                            value={ethValue}
                            onChange={(e) => setEthValue(e.target.value)}
                            placeholder="0"
                            className={inputClass}
                          />
                        </div>
                      )}

                      {/* Propose button */}
                      {selectedFn && (
                        <button
                          onClick={handlePropose}
                          disabled={proposing || !isOwner}
                          className={`${btnClass} w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 flex items-center justify-center gap-2`}
                        >
                          {proposing ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <PaperAirplaneIcon className="w-4 h-4" />
                              Propose Transaction
                            </>
                          )}
                        </button>
                      )}

                      {selectedFn && !isOwner && (
                        <p className="text-xs text-amber-500/40 mt-2 text-center">You must be a Safe signer to propose</p>
                      )}
                    </>
                  )}

                  {/* ── READ MODE ── */}
                  {proposeMode === 'read' && (
                    <>
                      {selectedContract && readFunctions.length > 0 && (
                        <div className="mb-4">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Function</label>
                          <select
                            value={selectedReadFunction}
                            onChange={(e) => setSelectedReadFunction(e.target.value)}
                            className={selectClass}
                          >
                            <option value="">Select a function...</option>
                            {readFunctions.map((fn) => (
                              <option key={fn.name} value={fn.name}>
                                {fn.name}({fn.inputs.map((inp: any) => `${inp.type} ${inp.name}`).join(', ')})
                                {fn.outputs.length > 0 && ` → ${fn.outputs.map((o: any) => o.type).join(', ')}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedContract && readFunctions.length === 0 && (
                        <p className="text-white/30 text-sm">No read functions found for this contract ABI</p>
                      )}

                      {/* Read function arguments */}
                      {selectedReadFn && selectedReadFn.inputs.length > 0 && (
                        <div className="mb-4 space-y-3">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 block">Arguments</label>
                          {selectedReadFn.inputs.map((inp: any, i: number) => (
                            <div key={i}>
                              <label className="text-[10px] text-white/30 mb-0.5 block">
                                {inp.name || `arg${i}`} <span className="text-emerald-500/40">({inp.type})</span>
                              </label>
                              {inp.type === 'bool' ? (
                                <select
                                  value={readArgs[i] || ''}
                                  onChange={(e) => {
                                    const next = [...readArgs]
                                    next[i] = e.target.value
                                    setReadArgs(next)
                                  }}
                                  className={selectClass}
                                >
                                  <option value="">Select...</option>
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={readArgs[i] || ''}
                                  onChange={(e) => {
                                    const next = [...readArgs]
                                    next[i] = e.target.value
                                    setReadArgs(next)
                                  }}
                                  placeholder={inp.type}
                                  className={inputClass}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Call button */}
                      {selectedReadFn && (
                        <button
                          onClick={handleRead}
                          disabled={reading}
                          className={`${btnClass} w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 flex items-center justify-center gap-2`}
                        >
                          {reading ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            'Call'
                          )}
                        </button>
                      )}

                      {/* Read result */}
                      {readResult !== null && (
                        <div className="mt-4 p-3 bg-white/[0.03] border border-emerald-500/20 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/60">Result</span>
                            <CopyButton text={readResult} size="sm" />
                          </div>
                          <pre className="text-sm font-mono text-emerald-300/80 whitespace-pre-wrap break-all">{readResult}</pre>
                        </div>
                      )}
                    </>
                  )}
                </GlowCard>

                {/* Contract info */}
                {selectedContractInfo && (
                  <GlowCard color={ACCENT} delay={0.2}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Target Contract</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white/60">{selectedContractInfo.name}</span>
                      <span className="font-mono text-white/40">{shorten(selectedContractInfo.address)}</span>
                      <CopyButton text={selectedContractInfo.address} size="sm" />
                    </div>
                  </GlowCard>
                )}

                {/* Send ETH */}
                <GlowCard color="#6366f1" delay={0.25}>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400/70 mb-4">Send ETH</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">Recipient Address</label>
                      <input
                        type="text"
                        value={sendEthTo}
                        onChange={(e) => setSendEthTo(e.target.value)}
                        placeholder="0x..."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">Amount (ETH)</label>
                      <input
                        type="text"
                        value={sendEthAmount}
                        onChange={(e) => setSendEthAmount(e.target.value)}
                        placeholder="0.01"
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleSendEth}
                      disabled={sendingEth || !isOwner}
                      className={`${btnClass} w-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 flex items-center justify-center gap-2`}
                    >
                      {sendingEth ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <PaperAirplaneIcon className="w-4 h-4" />
                          Propose ETH Transfer
                        </>
                      )}
                    </button>
                    {!isOwner && (
                      <p className="text-xs text-indigo-500/40 mt-1 text-center">You must be a Safe signer to propose</p>
                    )}
                  </div>
                </GlowCard>

                {/* Last TX Params verification */}
                {lastTxParams && (
                  <GlowCard color="#22d3ee" delay={0.1}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400/70">Last TX Params</h2>
                      <button
                        onClick={() => setLastTxParams(null)}
                        className="text-[10px] text-white/30 hover:text-white/60"
                      >
                        dismiss
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">chainId</span>
                        <span className="text-white/70">{lastTxParams.chainId}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">safe</span>
                        <span className="text-white/70 break-all">{lastTxParams.safe}</span>
                        <CopyButton text={lastTxParams.safe} size="sm" />
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">to</span>
                        <span className="text-white/70 break-all">{lastTxParams.to}</span>
                        <CopyButton text={lastTxParams.to} size="sm" />
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">value</span>
                        <span className="text-white/70">{lastTxParams.value} wei ({ethers.formatEther(lastTxParams.value)} ETH)</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">nonce</span>
                        <span className="text-white/70">{lastTxParams.nonce}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">threshold</span>
                        <span className="text-white/70">{lastTxParams.threshold}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">sender</span>
                        <span className="text-white/70 break-all">{lastTxParams.sender}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">safeTxHash</span>
                        <span className="text-white/70 break-all">{lastTxParams.safeTxHash}</span>
                        <CopyButton text={lastTxParams.safeTxHash} size="sm" />
                      </div>
                      <div className="flex gap-2">
                        <span className="text-cyan-400/50 shrink-0 w-20">data</span>
                        <span className="text-white/40 break-all truncate max-w-md">
                          {lastTxParams.data === '0x' ? '0x (empty)' : `${lastTxParams.data.slice(0, 66)}...`}
                        </span>
                      </div>
                    </div>
                  </GlowCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ============================== OWNERS ============================== */}
        {activeTab === 'owners' && (
          <div className="space-y-4">
            {!safeInfo ? (
              <GlowCard color={ACCENT}>
                <p className="text-white/40 text-center py-4">Load a Safe first</p>
              </GlowCard>
            ) : (
              <>
                {/* Current owners */}
                <GlowCard color={ACCENT} delay={0.1}>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">
                    Current Owners ({safeInfo.owners.length})
                  </h2>
                  <div className="space-y-2">
                    {safeInfo.owners.map((owner, i) => {
                      const isMe = owner.toLowerCase() === walletAddress.toLowerCase()
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                            isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.03]'
                          }`}
                        >
                          {isMe && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                          <span className="font-mono text-sm text-white/80 flex-1 break-all">{owner}</span>
                          <CopyButton text={owner} size="sm" />
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 text-xs text-white/30">
                    Threshold: {safeInfo.threshold}/{safeInfo.owners.length}
                  </div>
                </GlowCard>

                {/* Add Owner */}
                <GlowCard color="#10b981" delay={0.15}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500/70 mb-3 flex items-center gap-2">
                    <PlusIcon className="w-4 h-4" /> Add Owner
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">New Owner Address</label>
                      <input
                        type="text"
                        value={newOwnerAddr}
                        onChange={(e) => setNewOwnerAddr(e.target.value)}
                        placeholder="0x..."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">New Threshold (default: current)</label>
                      <input
                        type="number"
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(e.target.value)}
                        placeholder={String(safeInfo.threshold)}
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleAddOwner}
                      disabled={ownerLoading !== null || !isOwner}
                      className={`${btnClass} w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30`}
                    >
                      {ownerLoading === 'Add Owner' ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Propose Add Owner'}
                    </button>
                  </div>
                </GlowCard>

                {/* Remove Owner */}
                <GlowCard color="#ef4444" delay={0.2}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-500/70 mb-3 flex items-center gap-2">
                    <MinusIcon className="w-4 h-4" /> Remove Owner
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">Owner to Remove</label>
                      <select
                        value={removeOwnerAddr}
                        onChange={(e) => setRemoveOwnerAddr(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select owner...</option>
                        {safeInfo.owners.map((o, i) => (
                          <option key={i} value={o}>
                            {shorten(o)} {o.toLowerCase() === walletAddress.toLowerCase() ? '(you)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">New Threshold (default: {Math.max(safeInfo.threshold - 1, 1)})</label>
                      <input
                        type="number"
                        value={removeThreshold}
                        onChange={(e) => setRemoveThreshold(e.target.value)}
                        placeholder={String(Math.max(safeInfo.threshold - 1, 1))}
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleRemoveOwner}
                      disabled={ownerLoading !== null || !isOwner}
                      className={`${btnClass} w-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30`}
                    >
                      {ownerLoading === 'Remove Owner' ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Propose Remove Owner'}
                    </button>
                  </div>
                </GlowCard>

                {/* Change Threshold */}
                <GlowCard color="#3b82f6" delay={0.25}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-blue-500/70 mb-3 flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4" /> Change Threshold
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">New Threshold (current: {safeInfo.threshold})</label>
                      <input
                        type="number"
                        value={changeThresholdVal}
                        onChange={(e) => setChangeThresholdVal(e.target.value)}
                        placeholder={String(safeInfo.threshold)}
                        min={1}
                        max={safeInfo.owners.length}
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleChangeThreshold}
                      disabled={ownerLoading !== null || !isOwner}
                      className={`${btnClass} w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30`}
                    >
                      {ownerLoading === 'Change Threshold' ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Propose Change Threshold'}
                    </button>
                  </div>
                </GlowCard>

                {!isOwner && (
                  <div className="flex items-center gap-2 justify-center text-sm text-amber-500/50">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    You must be a Safe signer to propose owner changes
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
