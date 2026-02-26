"use client"

import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { toast } from 'react-toastify'
import modConfig from '@/config.json'
import { text2color, colorWithOpacity } from '@/utils'

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

function getContracts(): { name: string; address: string }[] {
  const chainConfig = (modConfig.chain as any)?.testnet
  if (!chainConfig?.contracts) return []
  const entries = Object.entries(chainConfig.contracts) as [string, any][]
  const treasury = entries.find(([name]) => name === 'Treasury')
  const rest = entries
    .filter(([name]) => name !== 'Treasury' && name !== 'Safe')
    .sort(([a], [b]) => a.localeCompare(b))
  const ordered = treasury ? [treasury, ...rest] : rest
  return ordered.map(([name, val]) => ({ name, address: val.address }))
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
  const [selectedContract, setSelectedContract] = useState('')
  const [search, setSearch] = useState('')
  const [showRead, setShowRead] = useState(true)
  const [showWrite, setShowWrite] = useState(true)
  const [fnSearch, setFnSearch] = useState('')

  const [selectedFnName, setSelectedFnName] = useState('')
  const [fnArgs, setFnArgs] = useState<string[]>([])
  const [ethValue, setEthValue] = useState('')
  const [sending, setSending] = useState(false)
  const [readResult, setReadResult] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const fnSearchRef = useRef<HTMLInputElement>(null)

  const contracts = getContracts()
  const filteredContracts = search
    ? contracts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : contracts
  const contractInfo = contracts.find((c) => c.name === selectedContract)
  const abi = selectedContract ? CONTRACT_ABIS[selectedContract] : null
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

  async function handleRead() {
    if (!contractInfo || !selectedFnEntry || !abi) return
    setReading(true)
    setReadResult(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(contractInfo.address, abi, provider)
      const result = await contract[selectedFnEntry.name](...fnArgs)
      if (Array.isArray(result)) {
        const formatted = result.map((v: any, i: number) => {
          const outputName = selectedFnEntry.outputs[i]?.name || `[${i}]`
          return `${outputName}: ${v.toString()}`
        })
        setReadResult(formatted.join('\n'))
      } else {
        setReadResult(result.toString())
      }
    } catch (err: any) {
      console.error(err)
      setReadResult(`Error: ${err?.message || 'Read failed'}`)
    } finally {
      setReading(false)
    }
  }

  async function handleWrite() {
    if (!contractInfo || !selectedFnEntry || !abi) return
    setSending(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractInfo.address, abi, signer)
      const value = ethValue ? ethers.parseEther(ethValue) : BigInt(0)
      const tx = await contract[selectedFnEntry.name](...fnArgs, { value })
      toast.success(`TX sent: ${tx.hash.slice(0, 12)}...`)
      await tx.wait()
      toast.success('TX confirmed')
      setSelectedFnName('')
      setFnArgs([])
      setEthValue('')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.reason || err?.message || 'Transaction failed')
    } finally {
      setSending(false)
    }
  }

  const readCount = allFunctions.filter(f => f.kind === 'read').length
  const writeCount = allFunctions.filter(f => f.kind === 'write').length

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Page header */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 8px rgba(0,255,255,0.6)' }} />
          <h1 className="text-2xl font-bold uppercase tracking-[0.15em] font-mono" style={{ color: 'var(--text-primary)' }}>Contracts</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--border-color), transparent)' }} />
          <span className="text-[12px] font-mono" style={{ color: 'var(--text-tertiary)' }}>[{contracts.length}]</span>
        </div>
        <p className="text-[14px] mb-8 ml-6 font-mono" style={{ color: 'var(--text-tertiary)' }}>Interact with deployed smart contracts</p>

        {/* Search */}
        <div className="mb-8 relative">
          <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full rounded-xl pl-14 pr-6 py-4 text-[15px] font-mono focus:outline-none transition-all"
            style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Contract Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
          {filteredContracts.map((c) => {
            const cardColor = text2color(c.name)
            const isSelected = selectedContract === c.name
            return (
              <button
                key={c.name}
                onClick={() => setSelectedContract(isSelected ? '' : c.name)}
                className="group relative p-4 rounded-xl text-left transition-all duration-200 overflow-hidden"
                style={{
                  border: isSelected ? `1.5px solid ${cardColor}` : `1.5px solid var(--border-color)`,
                  backgroundColor: isSelected ? colorWithOpacity(cardColor, 0.06) : 'var(--bg-secondary)',
                  boxShadow: isSelected
                    ? `0 0 20px ${colorWithOpacity(cardColor, 0.12)}`
                    : 'var(--card-shadow)',
                }}
              >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-3 h-px transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />
                <div className="absolute top-0 left-0 w-px h-3 transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />
                <div className="absolute bottom-0 right-0 w-3 h-px transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />
                <div className="absolute bottom-0 right-0 w-px h-3 transition-colors" style={{ backgroundColor: isSelected ? cardColor : 'var(--border-color)' }} />

                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full transition-all" style={{
                    backgroundColor: isSelected ? cardColor : 'var(--text-tertiary)',
                    boxShadow: isSelected ? `0 0 6px ${cardColor}` : 'none',
                  }} />
                  <div className="text-[14px] font-bold font-mono truncate" style={{ color: isSelected ? cardColor : 'var(--text-primary)' }}>{c.name}</div>
                </div>
                <div className="text-[11px] font-mono mt-1.5 ml-3.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{shorten(c.address, 6, 4)}</div>
              </button>
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
