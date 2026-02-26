"use client"

import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { toast } from 'react-toastify'
import modConfig from '@/config.json'

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

function getWriteFunctions(abi: any[]) {
  return abi
    .filter((item) => item.type === 'function' && item.stateMutability !== 'view' && item.stateMutability !== 'pure')
    .map((item) => ({ name: item.name, inputs: item.inputs || [], outputs: item.outputs || [], stateMutability: item.stateMutability }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function getReadFunctions(abi: any[]) {
  return abi
    .filter((item) => item.type === 'function' && (item.stateMutability === 'view' || item.stateMutability === 'pure'))
    .map((item) => ({ name: item.name, inputs: item.inputs || [], outputs: item.outputs || [], stateMutability: item.stateMutability }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function shorten(addr: string, start = 6, end = 4) {
  if (!addr || addr.length < start + end + 2) return addr
  return `${addr.slice(0, start)}...${addr.slice(-end)}`
}

const inputClass = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-3.5 text-[15px] text-white font-mono placeholder-white/20 focus:border-amber-500/50 focus:bg-white/[0.05] focus:outline-none transition-all'
const selectClass = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-3.5 text-[15px] text-white focus:border-amber-500/50 focus:outline-none transition-all appearance-none cursor-pointer'

function FnArgsInput({ inputs, args, setArgs }: {
  inputs?: any[]
  args: string[]
  setArgs: (a: string[]) => void
}) {
  if (!inputs || inputs.length === 0) return null
  return (
    <div className="space-y-4">
      {inputs.map((inp: any, i: number) => (
        <div key={i}>
          <label className="text-[13px] text-white/50 mb-2 block font-bold tracking-wide">
            {inp.name || `arg${i}`} <span className="text-white/20">({inp.type})</span>
          </label>
          {inp.type === 'bool' ? (
            <select
              value={args[i] || ''}
              onChange={(e) => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
              className={selectClass}
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
              className={inputClass}
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
  const writeFunctions = abi ? getWriteFunctions(abi) : []
  const readFunctions = abi ? getReadFunctions(abi) : []

  const allFunctions = [
    ...(showRead ? readFunctions.map(f => ({ ...f, kind: 'read' as const })) : []),
    ...(showWrite ? writeFunctions.map(f => ({ ...f, kind: 'write' as const })) : []),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const filteredFunctions = fnSearch
    ? allFunctions.filter(f => f.name.toLowerCase().includes(fnSearch.toLowerCase()))
    : allFunctions

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

  return (
    <div className="min-h-full" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Page header */}
        <h1 className="text-2xl font-bold uppercase tracking-[0.15em] text-amber-400 mb-2">Contracts</h1>
        <p className="text-[15px] text-white/30 mb-8">Interact with deployed smart contracts</p>

        {/* Search */}
        <div className="mb-8 relative">
          <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-14 pr-6 py-4 text-[17px] text-white font-mono placeholder-white/20 focus:border-amber-500/40 focus:bg-white/[0.05] focus:outline-none transition-all"
            style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.3)' }}
          />
        </div>

        {/* Contract Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-10">
          {filteredContracts.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelectedContract(selectedContract === c.name ? '' : c.name)}
              className={`relative p-5 rounded-2xl border text-left transition-all duration-200 ${
                selectedContract === c.name
                  ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20 shadow-xl shadow-amber-500/5'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10 hover:shadow-lg hover:shadow-black/20'
              }`}
            >
              <div className={`text-[17px] font-bold truncate ${
                selectedContract === c.name ? 'text-amber-400' : 'text-white/70'
              }`}>{c.name}</div>
              <div className="text-[13px] font-mono text-white/20 mt-2 truncate">{shorten(c.address, 6, 4)}</div>
            </button>
          ))}
          {filteredContracts.length === 0 && (
            <div className="col-span-full text-center text-white/20 text-[17px] py-12">No contracts found</div>
          )}
        </div>

        {/* Selected contract interaction */}
        {contractInfo && (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-8" style={{ boxShadow: '0 4px 40px rgba(0,0,0,0.4)' }}>
            {/* Contract header bar */}
            <div className="flex items-center gap-4 flex-wrap mb-8">
              <h2 className="text-2xl font-bold text-amber-400">{contractInfo.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-mono text-white/30">{shorten(contractInfo.address)}</span>
                <CopyButton text={contractInfo.address} size="sm" />
              </div>

              <div className="w-px h-6 bg-white/[0.08] mx-2" />

              {/* Read / Write filter bubbles */}
              <button
                onClick={() => setShowRead(!showRead)}
                className={`px-5 py-2 rounded-full text-[14px] font-bold uppercase tracking-wider transition-all ${
                  showRead
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/40'
                }`}
              >Read</button>
              <button
                onClick={() => setShowWrite(!showWrite)}
                className={`px-5 py-2 rounded-full text-[14px] font-bold uppercase tracking-wider transition-all ${
                  showWrite
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/40'
                }`}
              >Write</button>
            </div>

            {/* Two-column layout: function list + interaction panel */}
            <div className="flex gap-8">
              {/* Left: function list with search */}
              <div className="w-[380px] shrink-0">
                {/* Function search */}
                <div className="relative mb-4">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    ref={fnSearchRef}
                    type="text"
                    value={fnSearch}
                    onChange={(e) => setFnSearch(e.target.value)}
                    placeholder="Search functions..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-12 pr-16 py-3.5 text-[15px] text-white font-mono placeholder-white/20 focus:border-amber-500/40 focus:bg-white/[0.05] focus:outline-none transition-all"
                  />
                  {fnSearch && (
                    <button
                      onClick={() => { setFnSearch(''); fnSearchRef.current?.focus() }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white/30 hover:text-white/60 bg-white/[0.06] px-2.5 py-1 rounded-lg transition-colors"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Count */}
                <div className="text-[13px] text-white/25 mb-3 px-2">
                  {filteredFunctions.length} function{filteredFunctions.length !== 1 ? 's' : ''}
                  {fnSearch && <span className="text-amber-500/40"> matching &ldquo;{fnSearch}&rdquo;</span>}
                </div>

                {/* Scrollable function list */}
                <div className="max-h-[600px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                  {filteredFunctions.map((fn) => {
                    const key = `${fn.kind}:${fn.name}`
                    const isActive = selectedFnName === key
                    const isRead = fn.kind === 'read'
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedFnName(isActive ? '' : key)}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 group ${
                          isActive
                            ? isRead
                              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                              : 'bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5'
                            : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* R/W badge */}
                          <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold ${
                            isRead
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          }`}>
                            {isRead ? 'R' : 'W'}
                          </span>
                          {/* Function name */}
                          <span className={`text-[15px] font-bold truncate ${
                            isActive
                              ? isRead ? 'text-emerald-300' : 'text-amber-300'
                              : 'text-white/70 group-hover:text-white/90'
                          }`}>{fn.name}</span>
                        </div>
                        {/* Signature hint */}
                        <div className="mt-1.5 ml-10 text-[13px] text-white/20 truncate">
                          ({fn.inputs.map((inp: any) => inp.type).join(', ')})
                          {isRead && fn.outputs.length > 0 && (
                            <span className="text-emerald-500/30"> {'\u2192'} {fn.outputs.map((o: any) => o.type).join(', ')}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {filteredFunctions.length === 0 && (
                    <div className="text-center text-white/20 text-[15px] py-12 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                      {allFunctions.length === 0 ? 'No functions available' : 'No matches'}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: interaction panel */}
              <div className="flex-1 min-w-0">
                {selectedFnEntry ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
                    {/* Function header */}
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-[13px] font-bold uppercase ${
                        selectedFnEntry.kind === 'read'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>{selectedFnEntry.kind}</span>
                      <span className="text-xl font-bold text-white/80">{selectedFnEntry.name}</span>
                    </div>

                    {/* Signature */}
                    <div className="px-5 py-3.5 bg-black/40 border border-white/[0.06] rounded-xl">
                      <code className="text-[14px] text-white/40 leading-relaxed">
                        {selectedFnEntry.name}({selectedFnEntry.inputs.map((inp: any) => `${inp.type}${inp.name ? ' ' + inp.name : ''}`).join(', ')})
                        {selectedFnEntry.kind === 'read' && selectedFnEntry.outputs.length > 0 && (
                          <span className="text-emerald-500/40"> {'\u2192'} {selectedFnEntry.outputs.map((o: any) => `${o.type}${o.name ? ' ' + o.name : ''}`).join(', ')}</span>
                        )}
                        {selectedFnEntry.stateMutability === 'payable' && (
                          <span className="text-amber-500/40"> payable</span>
                        )}
                      </code>
                    </div>

                    {/* Args */}
                    <FnArgsInput inputs={selectedFnEntry.inputs} args={fnArgs} setArgs={setFnArgs} />

                    {/* ETH value for write */}
                    {selectedFnEntry.kind === 'write' && (
                      <div>
                        <label className="text-[13px] text-white/50 mb-2 block font-bold tracking-wide">ETH value (optional)</label>
                        <input
                          type="text"
                          value={ethValue}
                          onChange={(e) => setEthValue(e.target.value)}
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                    )}

                    {/* Execute button */}
                    <button
                      onClick={selectedFnEntry.kind === 'read' ? handleRead : handleWrite}
                      disabled={reading || sending}
                      className={`w-full py-4 rounded-2xl text-[16px] font-bold transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5 ${
                        selectedFnEntry.kind === 'read'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/10'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:shadow-lg hover:shadow-amber-500/10'
                      }`}
                    >
                      {(reading || sending) ? (
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      ) : selectedFnEntry.kind === 'read' ? 'Call' : 'Send Transaction'}
                    </button>

                    {/* Read result */}
                    {readResult !== null && (
                      <div className="p-5 bg-black/40 border border-emerald-500/20 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[13px] font-bold uppercase tracking-wider text-emerald-500/60">Result</span>
                          <CopyButton text={readResult} size="sm" />
                        </div>
                        <pre className="text-[16px] font-mono text-emerald-300/80 whitespace-pre-wrap break-all leading-relaxed">{readResult}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 text-white/15 rounded-2xl border border-white/[0.04] bg-white/[0.01]">
                    <MagnifyingGlassIcon className="w-10 h-10 mb-4 text-white/10" />
                    <span className="text-[17px]">Select a function from the list</span>
                  </div>
                )}
              </div>
            </div>

            {!showRead && !showWrite && (
              <p className="text-white/20 text-[17px] mt-6 text-center">Enable Read or Write to see functions</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
