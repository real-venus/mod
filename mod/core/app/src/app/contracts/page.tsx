"use client"

import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { toast } from 'react-toastify'
import modConfig from '@/config.json'
import { text2color, colorWithOpacity } from '@/utils'
import { motion, AnimatePresence } from 'framer-motion'

import TreasuryABI from '@/contracts/treasury/Treasury.sol/Treasury.json'
import MarketABI from '@/contracts/market/Market.sol/Market.json'
import DebitABI from '@/contracts/market/debit/Debit.sol/Debit.json'
import RegistryABI from '@/contracts/registry/Registry.sol/Registry.json'
import ManualPriceOracleABI from '@/contracts/oracles/ManualPriceOracle.sol/ManualPriceOracle.json'
import TokenGateABI from '@/contracts/tokengate/TokenGate.sol/TokenGate.json'
import BlocTimeABI from '@/contracts/bloctime/BlocTime.sol/BlocTime.json'
import TokenABI from '@/contracts/token/Token.sol/Token.json'

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

interface FnInfo {
  name: string
  inputs: any[]
  outputs: any[]
  stateMutability: string
  kind: 'read' | 'write'
}

interface ExecutionResult {
  fn: string
  params: any
  result: any
  status: 'success' | 'error'
  time: number
  cost?: number
  delta?: number
  hash?: string
}

interface CustomContract {
  name: string
  address: string
  abi: any[]
  abiCid?: string
}

function getContracts(customContracts: CustomContract[]): { name: string; address: string }[] {
  const chainConfig = (modConfig.chain as any)?.testnet
  const baseContracts = chainConfig?.contracts ? (() => {
    const entries = Object.entries(chainConfig.contracts) as [string, any][]
    const treasury = entries.find(([name]) => name === 'Treasury')
    const rest = entries
      .filter(([name]) => name !== 'Treasury' && name !== 'Safe')
      .sort(([a], [b]) => a.localeCompare(b))
    const ordered = treasury ? [treasury, ...rest] : rest
    return ordered.map(([name, val]) => ({ name, address: val.address }))
  })() : []

  const custom = customContracts.map(c => ({ name: c.name, address: c.address }))
  return [...baseContracts, ...custom]
}

function getAllFunctions(abi: any[]): FnInfo[] {
  return abi
    .filter((item) => item.type === 'function')
    .map((item) => ({
      name: item.name,
      inputs: item.inputs || [],
      outputs: item.outputs || [],
      stateMutability: item.stateMutability,
      kind: (item.stateMutability === 'view' || item.stateMutability === 'pure' ? 'read' : 'write') as 'read' | 'write',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function shorten(addr: string, start = 6, end = 4) {
  if (!addr || addr.length < start + end + 2) return addr
  return `${addr.slice(0, start)}...${addr.slice(-end)}`
}

function FnArgsInput({ inputs, args, setArgs }: {
  inputs?: any[]
  args: string[]
  setArgs: (a: string[]) => void
}) {
  if (!inputs || inputs.length === 0) return null
  return (
    <div className="space-y-3">
      {inputs.map((inp: any, i: number) => (
        <div key={i}>
          <label className="text-[12px] font-mono mb-1 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {inp.name || `arg${i}`} <span style={{ color: 'var(--text-tertiary)' }}>:: {inp.type}</span>
          </label>
          {inp.type === 'bool' ? (
            <select
              value={args[i] || ''}
              onChange={(e) => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
              className="w-full rounded-xl px-4 py-3 text-[14px] font-mono focus:outline-none transition-all appearance-none cursor-pointer"
              style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="">Select...</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type="text"
              value={args[i] || ''}
              onChange={(e) => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
              placeholder={inp.type}
              className="w-full rounded-xl px-4 py-3 text-[14px] font-mono focus:outline-none transition-all"
              style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function ContractsPage() {
  const [selectedContract, setSelectedContract] = useState('Market')
  const [search, setSearch] = useState('')
  const [showRead, setShowRead] = useState(true)
  const [showWrite, setShowWrite] = useState(true)
  const [fnSearch, setFnSearch] = useState('')
  const [viewMode, setViewMode] = useState<'txs' | 'chat'>('txs')

  const [selectedFnName, setSelectedFnName] = useState('')
  const [fnArgs, setFnArgs] = useState<string[]>([])
  const [ethValue, setEthValue] = useState('')
  const [sending, setSending] = useState(false)
  const [readResult, setReadResult] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([])
  const [expandedTxIdx, setExpandedTxIdx] = useState<number | null>(null)
  const [customContracts, setCustomContracts] = useState<CustomContract[]>([])
  const [showAddContract, setShowAddContract] = useState(false)
  const [newContractName, setNewContractName] = useState('')
  const [newContractAddress, setNewContractAddress] = useState('')
  const [newContractAbiCid, setNewContractAbiCid] = useState('')
  const [newContractAbiJson, setNewContractAbiJson] = useState('')
  const [addingContract, setAddingContract] = useState(false)

  const fnSearchRef = useRef<HTMLInputElement>(null)

  const contracts = getContracts(customContracts)
  const filteredContracts = search
    ? contracts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : contracts
  const contractInfo = contracts.find((c) => c.name === selectedContract)
  const customContract = customContracts.find(c => c.name === selectedContract)
  const abi = customContract ? customContract.abi : (selectedContract ? CONTRACT_ABIS[selectedContract] : null)
  const allFunctions = abi ? getAllFunctions(abi) : []

  const visibleFunctions = allFunctions.filter(f => {
    if (f.kind === 'read' && !showRead) return false
    if (f.kind === 'write' && !showWrite) return false
    return true
  })

  const filteredFunctions = fnSearch
    ? visibleFunctions.filter(f => f.name.toLowerCase().includes(fnSearch.toLowerCase()))
    : visibleFunctions

  const selectedFnEntry = allFunctions.find((f) => `${f.kind}:${f.name}` === selectedFnName)

  useEffect(() => {
    setSelectedFnName('')
    setFnArgs([])
    setReadResult(null)
    setFnSearch('')
  }, [selectedContract])

  useEffect(() => {
    if (selectedFnEntry) setFnArgs(new Array(selectedFnEntry.inputs.length).fill(''))
    else setFnArgs([])
    setReadResult(null)
  }, [selectedFnName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load custom contracts from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('customContracts')
    if (stored) {
      try {
        setCustomContracts(JSON.parse(stored))
      } catch (err) {
        console.error('Failed to load custom contracts:', err)
      }
    }
  }, [])

  async function handleAddContract() {
    if (!newContractName || !newContractAddress) {
      toast.error('Contract name and address are required')
      return
    }

    if (!newContractAbiCid && !newContractAbiJson) {
      toast.error('Either ABI CID or ABI JSON is required')
      return
    }

    setAddingContract(true)
    try {
      let abi: any[]

      if (newContractAbiJson) {
        // Parse JSON ABI
        try {
          abi = JSON.parse(newContractAbiJson)
          if (!Array.isArray(abi)) {
            throw new Error('ABI must be an array')
          }
        } catch (err: any) {
          toast.error('Invalid ABI JSON: ' + err.message)
          setAddingContract(false)
          return
        }
      } else {
        // Fetch ABI from IPFS using CID
        // TODO: Implement IPFS fetching when client is available
        // For now, just show error
        toast.error('IPFS ABI fetching not yet implemented. Please use ABI JSON instead.')
        setAddingContract(false)
        return
      }

      const newContract: CustomContract = {
        name: newContractName,
        address: newContractAddress,
        abi,
        abiCid: newContractAbiCid || undefined
      }

      const updated = [...customContracts, newContract]
      setCustomContracts(updated)
      localStorage.setItem('customContracts', JSON.stringify(updated))

      toast.success(`Contract "${newContractName}" added successfully`)

      // Reset form
      setNewContractName('')
      setNewContractAddress('')
      setNewContractAbiCid('')
      setNewContractAbiJson('')
      setShowAddContract(false)
    } catch (err: any) {
      console.error('Failed to add contract:', err)
      toast.error(err.message || 'Failed to add contract')
    } finally {
      setAddingContract(false)
    }
  }

  function handleRemoveContract(contractName: string) {
    const updated = customContracts.filter(c => c.name !== contractName)
    setCustomContracts(updated)
    localStorage.setItem('customContracts', JSON.stringify(updated))
    toast.success(`Contract "${contractName}" removed`)
    if (selectedContract === contractName) {
      setSelectedContract('Market')
    }
  }

  async function handleRead() {
    if (!contractInfo || !selectedFnEntry || !abi) return
    setReading(true)
    setReadResult(null)
    const startTime = Date.now()
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(contractInfo.address, abi, provider)
      const result = await contract[selectedFnEntry.name](...fnArgs)
      const delta = (Date.now() - startTime) / 1000

      let formattedResult: any
      if (Array.isArray(result)) {
        const formatted = result.map((v: any, i: number) => {
          const outputName = selectedFnEntry.outputs[i]?.name || `[${i}]`
          return `${outputName}: ${v.toString()}`
        })
        formattedResult = formatted.join('\n')
        setReadResult(formattedResult)
      } else {
        formattedResult = result.toString()
        setReadResult(formattedResult)
      }

      // Add to execution history
      const execution: ExecutionResult = {
        fn: selectedFnEntry.name,
        params: fnArgs.reduce((acc, val, idx) => {
          const paramName = selectedFnEntry.inputs[idx]?.name || `arg${idx}`
          acc[paramName] = val
          return acc
        }, {} as any),
        result: formattedResult,
        status: 'success',
        time: Math.floor(Date.now() / 1000),
        delta,
        cost: 0
      }
      setExecutionHistory(prev => [execution, ...prev])
    } catch (err: any) {
      console.error(err)
      const errorMsg = err?.message || 'Read failed'
      setReadResult(`Error: ${errorMsg}`)

      // Add error to execution history
      const execution: ExecutionResult = {
        fn: selectedFnEntry.name,
        params: fnArgs.reduce((acc, val, idx) => {
          const paramName = selectedFnEntry.inputs[idx]?.name || `arg${idx}`
          acc[paramName] = val
          return acc
        }, {} as any),
        result: errorMsg,
        status: 'error',
        time: Math.floor(Date.now() / 1000),
        delta: (Date.now() - startTime) / 1000,
        cost: 0
      }
      setExecutionHistory(prev => [execution, ...prev])
    } finally {
      setReading(false)
    }
  }

  async function handleWrite() {
    if (!contractInfo || !selectedFnEntry || !abi) return
    setSending(true)
    const startTime = Date.now()
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractInfo.address, abi, signer)
      const value = ethValue ? ethers.parseEther(ethValue) : BigInt(0)
      const tx = await contract[selectedFnEntry.name](...fnArgs, { value })
      toast.success(`TX sent: ${tx.hash.slice(0, 12)}...`)
      const receipt = await tx.wait()
      const delta = (Date.now() - startTime) / 1000
      toast.success('TX confirmed')

      // Add to execution history
      const execution: ExecutionResult = {
        fn: selectedFnEntry.name,
        params: fnArgs.reduce((acc, val, idx) => {
          const paramName = selectedFnEntry.inputs[idx]?.name || `arg${idx}`
          acc[paramName] = val
          return acc
        }, {} as any),
        result: { hash: receipt.hash, status: receipt.status },
        status: 'success',
        time: Math.floor(Date.now() / 1000),
        delta,
        hash: receipt.hash,
        cost: 0
      }
      setExecutionHistory(prev => [execution, ...prev])

      setSelectedFnName('')
      setFnArgs([])
      setEthValue('')
    } catch (err: any) {
      console.error(err)
      const errorMsg = err?.reason || err?.message || 'Transaction failed'
      toast.error(errorMsg)

      // Add error to execution history
      const execution: ExecutionResult = {
        fn: selectedFnEntry.name,
        params: fnArgs.reduce((acc, val, idx) => {
          const paramName = selectedFnEntry.inputs[idx]?.name || `arg${idx}`
          acc[paramName] = val
          return acc
        }, {} as any),
        result: errorMsg,
        status: 'error',
        time: Math.floor(Date.now() / 1000),
        delta: (Date.now() - startTime) / 1000,
        cost: 0
      }
      setExecutionHistory(prev => [execution, ...prev])
    } finally {
      setSending(false)
    }
  }

  const readCount = allFunctions.filter(f => f.kind === 'read').length
  const writeCount = allFunctions.filter(f => f.kind === 'write').length

  const renderTransactionCard = (exec: ExecutionResult, idx: number) => {
    const isExpanded = expandedTxIdx === idx
    const statusColor = exec.status === 'success' ? 'emerald' : 'red'
    const statusText = exec.status === 'success' ? 'SUC' : 'ERR'

    return (
      <div
        key={idx}
        onClick={() => setExpandedTxIdx(isExpanded ? null : idx)}
        className={`border-2 rounded-lg backdrop-blur-sm transition-all cursor-pointer relative overflow-hidden ${
          exec.status === 'success'
            ? 'border-emerald-500/60 hover:border-emerald-500/80'
            : 'border-red-500/60 hover:border-red-500/80'
        }`}
        style={{ fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
          {exec.hash && (
            <div className="flex items-center gap-1">
              <div className="text-purple-500 text-sm">📄</div>
              <CopyButton text={exec.hash} size="sm" showValueOnHover={true} />
            </div>
          )}

          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              exec.status === 'success' ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {statusText}
            </span>
          </div>

          <div className="text-xs font-bold truncate text-cyan-500 flex-1 min-w-0">
            {exec.fn}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-0.5">
              <span className="text-purple-500 text-xs">$</span>
              <span className="text-cyan-500 font-bold">{exec.cost?.toFixed(2) || '0.00'}</span>
            </div>

            {exec.delta !== undefined && (
              <div className="flex items-center gap-0.5">
                <span className="text-purple-500 text-xs">⏱</span>
                <span className="text-cyan-500 font-bold">{exec.delta.toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Input preview when collapsed */}
        {!isExpanded && (
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-500">INPUT:</span>
              <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>
                {JSON.stringify(exec.params)}
              </span>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-2 space-y-2">
            {/* Input */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-1">INPUT:</div>
              <pre className="text-xs font-mono p-2 rounded" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                {JSON.stringify(exec.params, null, 2)}
              </pre>
            </div>

            {/* Result */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-1">RESULT:</div>
              <pre className={`text-xs font-mono p-2 rounded ${
                exec.status === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`} style={{ backgroundColor: 'var(--bg-input)' }}>
                {typeof exec.result === 'object' ? JSON.stringify(exec.result, null, 2) : exec.result}
              </pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderChatMessage = (exec: ExecutionResult, idx: number) => {
    return (
      <div key={idx} className="space-y-2">
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-500 mb-1">{exec.fn}</div>
            <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              {JSON.stringify(exec.params, null, 2)}
            </div>
          </div>
        </div>

        {/* Assistant response */}
        <div className="flex justify-start">
          <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
            exec.status === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          } border`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                exec.status === 'success' ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {exec.status === 'success' ? 'SUCCESS' : 'ERROR'}
              </span>
              {exec.delta && (
                <span className="text-[9px] font-mono text-purple-500/60">{exec.delta.toFixed(1)}s</span>
              )}
            </div>
            <pre className={`text-xs font-mono whitespace-pre-wrap ${
              exec.status === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {typeof exec.result === 'object' ? JSON.stringify(exec.result, null, 2) : exec.result}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="max-w-7xl mx-auto px-8 py-10 w-full flex-1 flex flex-col">
        {/* Page header */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 8px rgba(0,255,255,0.6)' }} />
          <h1 className="text-2xl font-bold uppercase tracking-[0.15em] font-mono" style={{ color: 'var(--text-primary)' }}>Contracts</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--border-color), transparent)' }} />

          {/* View mode toggle */}
          <div className="flex gap-1 p-0.5 bg-black/60 border border-cyan-500/15 rounded">
            <button
              onClick={() => setViewMode('txs')}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] font-mono rounded-sm transition-all ${
                viewMode === 'txs'
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.1)]'
                  : 'text-white/25 hover:text-purple-400/50 border border-transparent'
              }`}
            >TXS</button>
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] font-mono rounded-sm transition-all ${
                viewMode === 'chat'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(0,255,255,0.1)]'
                  : 'text-white/25 hover:text-cyan-400/50 border border-transparent'
              }`}
            >CHAT</button>
          </div>

          <span className="text-[12px] font-mono" style={{ color: 'var(--text-tertiary)' }}>[{contracts.length}]</span>
        </div>
        <p className="text-[14px] mb-6 ml-6 font-mono" style={{ color: 'var(--text-tertiary)' }}>Interact with deployed smart contracts</p>

        {/* Search and Add Contract */}
        <div className="mb-4 flex gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contracts..."
              className="w-full rounded-xl pl-14 pr-6 py-3 text-[14px] font-mono focus:outline-none transition-all"
              style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={() => setShowAddContract(!showAddContract)}
            className="px-4 py-3 rounded-xl text-[13px] font-bold font-mono uppercase tracking-wider transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20"
          >
            + ADD
          </button>
        </div>

        {/* Add Contract Form */}
        <AnimatePresence>
          {showAddContract && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px rgba(0,255,255,0.8)' }} />
                  <h3 className="text-[13px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>Add Custom Contract</h3>
                </div>

                <div className="space-y-3">
                  {/* Contract Name */}
                  <div>
                    <label className="text-[11px] font-mono mb-1 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Contract Name
                    </label>
                    <input
                      type="text"
                      value={newContractName}
                      onChange={(e) => setNewContractName(e.target.value)}
                      placeholder="MyContract"
                      className="w-full rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none transition-all"
                      style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  {/* Contract Address */}
                  <div>
                    <label className="text-[11px] font-mono mb-1 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Contract Address
                    </label>
                    <input
                      type="text"
                      value={newContractAddress}
                      onChange={(e) => setNewContractAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none transition-all"
                      style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  {/* ABI CID (optional) */}
                  <div>
                    <label className="text-[11px] font-mono mb-1 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      ABI CID <span style={{ color: 'var(--text-tertiary)' }}>(optional - not yet supported)</span>
                    </label>
                    <input
                      type="text"
                      value={newContractAbiCid}
                      onChange={(e) => setNewContractAbiCid(e.target.value)}
                      placeholder="Qm..."
                      disabled
                      className="w-full rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none transition-all opacity-50 cursor-not-allowed"
                      style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  {/* ABI JSON */}
                  <div>
                    <label className="text-[11px] font-mono mb-1 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      ABI JSON <span style={{ color: 'var(--text-tertiary)' }}>(paste ABI array)</span>
                    </label>
                    <textarea
                      value={newContractAbiJson}
                      onChange={(e) => setNewContractAbiJson(e.target.value)}
                      placeholder='[{"type":"function","name":"transfer","inputs":[...],...}]'
                      rows={6}
                      className="w-full rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none transition-all resize-none"
                      style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAddContract}
                      disabled={addingContract}
                      className="flex-1 py-2.5 rounded-lg text-[12px] font-bold font-mono uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2 bg-emerald-500/12 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                    >
                      {addingContract ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Contract'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddContract(false)
                        setNewContractName('')
                        setNewContractAddress('')
                        setNewContractAbiCid('')
                        setNewContractAbiJson('')
                      }}
                      className="px-4 py-2.5 rounded-lg text-[12px] font-bold font-mono uppercase tracking-wider transition-all border hover:bg-white/5"
                      style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contract Grid */}
        <div className="flex flex-wrap gap-2 mb-6">
          {filteredContracts.map((c) => {
            const cardColor = text2color(c.name)
            const isSelected = selectedContract === c.name
            const isCustom = customContracts.some(cc => cc.name === c.name)
            return (
              <div key={c.name} className="relative group/card">
                <button
                  onClick={() => setSelectedContract(isSelected ? '' : c.name)}
                  className="relative px-3 py-2 rounded-lg text-left transition-all duration-200 overflow-hidden"
                  style={{
                    border: isSelected ? `1.5px solid ${cardColor}` : `1.5px solid var(--border-color)`,
                    backgroundColor: isSelected ? colorWithOpacity(cardColor, 0.06) : 'var(--bg-secondary)',
                    boxShadow: isSelected
                      ? `0 0 20px ${colorWithOpacity(cardColor, 0.12)}`
                      : 'var(--card-shadow)',
                  }}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-2 h-px transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />
                  <div className="absolute top-0 left-0 w-px h-2 transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />
                  <div className="absolute bottom-0 right-0 w-2 h-px transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />
                  <div className="absolute bottom-0 right-0 w-px h-2 transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />

                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full transition-all" style={{
                      backgroundColor: isSelected ? cardColor : 'var(--text-tertiary)',
                      boxShadow: isSelected ? `0 0 6px ${cardColor}` : 'none',
                    }} />
                    <div className="text-[13px] font-bold font-mono" style={{ color: isSelected ? cardColor : 'var(--text-primary)' }}>{c.name}</div>
                    {isCustom && (
                      <span className="text-[8px] px-1 py-0.5 rounded font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">CUSTOM</span>
                    )}
                    <div className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{shorten(c.address, 4, 3)}</div>
                  </div>
                </button>

                {/* Remove button for custom contracts */}
                {isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Remove custom contract "${c.name}"?`)) {
                        handleRemoveContract(c.name)
                      }
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-xs font-bold opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-500 flex items-center justify-center"
                    title="Remove custom contract"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
          {filteredContracts.length === 0 && (
            <div className="col-span-full text-center text-[15px] font-mono py-12" style={{ color: 'var(--text-tertiary)' }}>-- NO CONTRACTS FOUND --</div>
          )}
        </div>

        {/* Selected contract interaction */}
        {contractInfo && (() => {
          const activeColor = text2color(contractInfo.name)
          return (
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{
            border: `1.5px solid ${colorWithOpacity(activeColor, 0.3)}`,
            backgroundColor: 'var(--bg-secondary)',
          }}>
            {/* Subtle top glow */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: colorWithOpacity(activeColor, 0.4) }} />

            {/* Contract header bar */}
            <div className="flex items-center gap-4 flex-wrap mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
                <h2 className="text-xl font-bold font-mono" style={{ color: activeColor }}>{contractInfo.name}</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                <span className="text-[13px] font-mono" style={{ color: 'var(--text-secondary)' }}>{shorten(contractInfo.address)}</span>
                <CopyButton text={contractInfo.address} size="sm" />
              </div>

              <div className="flex-1" />

              {/* Read / Write filter toggles */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRead(!showRead)}
                  className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider font-mono transition-all ${
                    showRead
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : ''
                  }`}
                  style={!showRead ? { border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-input)' } : {}}
                >
                  Read{readCount > 0 && ` (${readCount})`}
                </button>
                <button
                  onClick={() => setShowWrite(!showWrite)}
                  className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider font-mono transition-all ${
                    showWrite
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                      : ''
                  }`}
                  style={!showWrite ? { border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-input)' } : {}}
                >
                  Write{writeCount > 0 && ` (${writeCount})`}
                </button>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex gap-6">
              {/* Left: function cards */}
              <div className="w-[380px] shrink-0">
                {/* Function search */}
                <div className="relative mb-4">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    ref={fnSearchRef}
                    type="text"
                    value={fnSearch}
                    onChange={(e) => setFnSearch(e.target.value)}
                    placeholder="Search functions..."
                    className="w-full rounded-xl pl-11 pr-20 py-3 text-[13px] font-mono focus:outline-none transition-all"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {fnSearch && (
                      <button
                        onClick={() => { setFnSearch(''); fnSearchRef.current?.focus() }}
                        className="text-[10px] font-bold font-mono px-2 py-0.5 rounded transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        CLR
                      </button>
                    )}
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {filteredFunctions.length}/{visibleFunctions.length}
                    </span>
                  </div>
                </div>

                {/* Scrollable function cards */}
                <div className="max-h-[600px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                  {filteredFunctions.map((fn) => {
                    const key = `${fn.kind}:${fn.name}`
                    const isActive = selectedFnName === key
                    const isRead = fn.kind === 'read'
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedFnName(isActive ? '' : key)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-150 group relative overflow-hidden ${
                          isActive
                            ? isRead
                              ? 'bg-emerald-500/8'
                              : 'bg-amber-500/8'
                            : ''
                        }`}
                        style={{
                          border: isActive
                            ? `1.5px solid ${isRead ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`
                            : '1.5px solid var(--border-color)',
                          backgroundColor: !isActive ? 'var(--bg-surface)' : undefined,
                        }}
                      >
                        {/* Left accent bar */}
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-colors" style={{
                          backgroundColor: isActive
                            ? isRead ? 'rgb(16,185,129)' : 'rgb(245,158,11)'
                            : 'transparent',
                        }} />

                        {/* Function name row */}
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isRead
                              ? 'bg-emerald-500/12 text-emerald-500 border border-emerald-500/20'
                              : 'bg-amber-500/12 text-amber-500 border border-amber-500/20'
                          }`}>
                            {isRead ? 'R' : 'W'}
                          </span>
                          <span className="text-[14px] font-bold font-mono truncate" style={{
                            color: isActive
                              ? isRead ? 'rgb(16,185,129)' : 'rgb(245,158,11)'
                              : 'var(--text-primary)',
                          }}>{fn.name}</span>
                          {fn.stateMutability === 'payable' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500/60 border border-amber-500/15 ml-auto shrink-0">payable</span>
                          )}
                        </div>

                        {/* Schema: params */}
                        <div className="ml-7 space-y-0.5">
                          {fn.inputs.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {fn.inputs.map((inp: any, i: number) => (
                                <span key={i} className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{inp.name || `_${i}`}</span>
                                  <span style={{ color: 'var(--text-tertiary)' }}> : {inp.type}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {fn.outputs.length > 0 && (
                            <div className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                              <span className="text-emerald-500/40">{'\u2192'} </span>
                              {fn.outputs.map((o: any, i: number) => (
                                <span key={i}>
                                  {i > 0 && ', '}
                                  {o.name && <span style={{ color: 'var(--text-secondary)' }}>{o.name}: </span>}
                                  <span>{o.type}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {fn.inputs.length === 0 && fn.outputs.length === 0 && (
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{'() -> void'}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {filteredFunctions.length === 0 && (
                    <div className="text-center text-[13px] font-mono py-12 rounded-xl" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)' }}>
                      {visibleFunctions.length === 0 ? '-- NO FUNCTIONS --' : '-- NO MATCHES --'}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: interaction panel */}
              <div className="flex-1 min-w-0">
                {selectedFnEntry ? (() => {
                  const isRead = selectedFnEntry.kind === 'read'
                  return (
                  <div className="rounded-xl p-5 space-y-4 relative overflow-hidden" style={{
                    border: `1.5px solid ${isRead ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    backgroundColor: 'var(--bg-surface)',
                  }}>
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: isRead ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)' }} />

                    {/* Function header */}
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase font-mono ${
                        isRead
                          ? 'bg-emerald-500/12 text-emerald-500 border border-emerald-500/25'
                          : 'bg-amber-500/12 text-amber-500 border border-amber-500/25'
                      }`}>{selectedFnEntry.kind}</span>
                      <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{selectedFnEntry.name}</span>
                      {selectedFnEntry.stateMutability === 'payable' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500/60 border border-amber-500/15">payable</span>
                      )}
                    </div>

                    {/* Full signature */}
                    <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                      <code className="text-[13px] font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: isRead ? 'rgb(16,185,129)' : 'rgb(245,158,11)', opacity: 0.6 }}>fn </span>
                        {selectedFnEntry.name}
                        <span style={{ color: 'var(--text-tertiary)' }}>(</span>
                        {selectedFnEntry.inputs.map((inp: any, i: number) => (
                          <span key={i}>
                            {i > 0 && <span style={{ color: 'var(--text-tertiary)' }}>, </span>}
                            <span>{inp.name || `_${i}`}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}> : {inp.type}</span>
                          </span>
                        ))}
                        <span style={{ color: 'var(--text-tertiary)' }}>)</span>
                        {isRead && selectedFnEntry.outputs.length > 0 && (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {' -> '}
                            {selectedFnEntry.outputs.map((o: any, i: number) => (
                              <span key={i}>{i > 0 && ', '}{o.type}{o.name && ` ${o.name}`}</span>
                            ))}
                          </span>
                        )}
                      </code>
                    </div>

                    {/* Args */}
                    <FnArgsInput inputs={selectedFnEntry.inputs} args={fnArgs} setArgs={setFnArgs} />

                    {/* ETH value for write */}
                    {selectedFnEntry.kind === 'write' && (
                      <div>
                        <label className="text-[12px] font-mono mb-1 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          ETH value <span style={{ color: 'var(--text-tertiary)' }}>:: optional</span>
                        </label>
                        <input
                          type="text"
                          value={ethValue}
                          onChange={(e) => setEthValue(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl px-4 py-3 text-[14px] font-mono focus:outline-none transition-all"
                          style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    )}

                    {/* Execute button */}
                    <button
                      onClick={isRead ? handleRead : handleWrite}
                      disabled={reading || sending}
                      className={`w-full py-3.5 rounded-xl text-[14px] font-bold font-mono uppercase tracking-wider transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5 ${
                        isRead
                          ? 'bg-emerald-500/12 text-emerald-500 border-[1.5px] border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-amber-500/12 text-amber-500 border-[1.5px] border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                      style={{
                        boxShadow: isRead
                          ? '0 0 20px rgba(16,185,129,0.08)'
                          : '0 0 20px rgba(245,158,11,0.08)',
                      }}
                    >
                      {(reading || sending) ? (
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {isRead ? `Execute ${selectedFnEntry.name}` : `Send ${selectedFnEntry.name}`}
                        </>
                      )}
                    </button>

                    {/* Read result */}
                    {readResult !== null && (
                      <div className="p-4 rounded-xl relative overflow-hidden" style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid rgba(16,185,129,0.2)' }}>
                        <div className="absolute top-0 left-0 right-0 h-px bg-emerald-500/20" />
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-emerald-500/60">Output</span>
                          <CopyButton text={readResult} size="sm" />
                        </div>
                        <pre className="text-[16px] font-mono font-bold whitespace-pre-wrap break-all leading-relaxed" style={{ color: 'var(--text-primary)' }}>{readResult}</pre>
                      </div>
                    )}
                  </div>
                  )
                })() : (
                  <div className="flex flex-col items-center justify-center h-80 rounded-xl" style={{
                    color: 'var(--text-tertiary)',
                    border: '1.5px dashed var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                  }}>
                    <div className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center" style={{ border: '1.5px solid var(--border-color)' }}>
                      <svg className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-[14px] font-mono">Select a function to interact</span>
                  </div>
                )}
              </div>
            </div>

            {!showRead && !showWrite && (
              <p className="text-[14px] mt-6 text-center font-mono" style={{ color: 'var(--text-tertiary)' }}>Enable Read or Write to see functions</p>
            )}
          </div>
          )
        })()}
      </div>
    </div>
  )
}
