"use client"

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { toast } from 'react-toastify'
import modConfig from '@/config.json'

// ABI imports
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
    .map((item) => ({ name: item.name, inputs: item.inputs || [], outputs: item.outputs || [] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function getReadFunctions(abi: any[]) {
  return abi
    .filter((item) => item.type === 'function' && (item.stateMutability === 'view' || item.stateMutability === 'pure'))
    .map((item) => ({ name: item.name, inputs: item.inputs || [], outputs: item.outputs || [] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function shorten(addr: string, start = 6, end = 4) {
  if (!addr || addr.length < start + end + 2) return addr
  return `${addr.slice(0, start)}...${addr.slice(-end)}`
}

const inputClass = 'w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-white/20 focus:border-amber-500/50 focus:outline-none transition-colors'
const selectClass = 'w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none transition-colors appearance-none cursor-pointer'

interface ContractsTabProps {
  show: boolean
}

export function ContractsTab({ show }: ContractsTabProps) {
  const [selectedContract, setSelectedContract] = useState('')
  const [mode, setMode] = useState<'read' | 'write'>('read')

  // Write state
  const [selectedFunction, setSelectedFunction] = useState('')
  const [fnArgs, setFnArgs] = useState<string[]>([])
  const [ethValue, setEthValue] = useState('')
  const [sending, setSending] = useState(false)

  // Read state
  const [selectedReadFunction, setSelectedReadFunction] = useState('')
  const [readArgs, setReadArgs] = useState<string[]>([])
  const [readResult, setReadResult] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const contracts = getContracts()
  const contractInfo = contracts.find((c) => c.name === selectedContract)
  const abi = selectedContract ? CONTRACT_ABIS[selectedContract] : null
  const writeFunctions = abi ? getWriteFunctions(abi) : []
  const readFunctions = abi ? getReadFunctions(abi) : []
  const selectedFn = writeFunctions.find((f) => f.name === selectedFunction)
  const selectedReadFn = readFunctions.find((f) => f.name === selectedReadFunction)

  useEffect(() => {
    setSelectedFunction('')
    setFnArgs([])
    setSelectedReadFunction('')
    setReadArgs([])
    setReadResult(null)
  }, [selectedContract])

  useEffect(() => {
    if (selectedFn) setFnArgs(new Array(selectedFn.inputs.length).fill(''))
    else setFnArgs([])
  }, [selectedFunction]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedReadFn) setReadArgs(new Array(selectedReadFn.inputs.length).fill(''))
    else setReadArgs([])
    setReadResult(null)
  }, [selectedReadFunction]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRead() {
    if (!contractInfo || !selectedReadFn || !abi) return
    setReading(true)
    setReadResult(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(contractInfo.address, abi, provider)
      const result = await contract[selectedReadFn.name](...readArgs)
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
      setReadResult(`Error: ${err?.message || 'Read failed'}`)
    } finally {
      setReading(false)
    }
  }

  async function handleWrite() {
    if (!contractInfo || !selectedFn || !abi) return
    setSending(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractInfo.address, abi, signer)
      const value = ethValue ? ethers.parseEther(ethValue) : BigInt(0)
      const tx = await contract[selectedFn.name](...fnArgs, { value })
      toast.success(`TX sent: ${tx.hash.slice(0, 12)}...`)
      await tx.wait()
      toast.success('TX confirmed')
      setSelectedFunction('')
      setFnArgs([])
      setEthValue('')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.reason || err?.message || 'Transaction failed')
    } finally {
      setSending(false)
    }
  }

  if (!show) return null

  return (
    <div className="mt-5">
      <div className="border-t border-white/[0.06] pt-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-500/60 mb-4">Contracts</h3>

        {/* Contract Selector */}
        <div className="mb-3">
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className={selectClass}
          >
            <option value="">Select contract...</option>
            {contracts.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Contract address */}
        {contractInfo && (
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-[10px] font-mono text-white/30">{shorten(contractInfo.address)}</span>
            <CopyButton text={contractInfo.address} size="sm" />
          </div>
        )}

        {/* Read / Write toggle */}
        {selectedContract && (
          <div className="flex gap-1 mb-4 p-1 bg-white/[0.03] rounded-lg">
            <button
              onClick={() => setMode('read')}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${
                mode === 'read'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-white/30 hover:text-white/50 border border-transparent'
              }`}
            >Read</button>
            <button
              onClick={() => setMode('write')}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${
                mode === 'write'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-white/30 hover:text-white/50 border border-transparent'
              }`}
            >Write</button>
          </div>
        )}

        {/* READ MODE */}
        {mode === 'read' && selectedContract && (
          <div className="space-y-3">
            {readFunctions.length > 0 ? (
              <>
                <select
                  value={selectedReadFunction}
                  onChange={(e) => setSelectedReadFunction(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select function...</option>
                  {readFunctions.map((fn) => (
                    <option key={fn.name} value={fn.name}>
                      {fn.name}({fn.inputs.map((inp: any) => inp.type).join(', ')})
                      {fn.outputs.length > 0 && ` → ${fn.outputs.map((o: any) => o.type).join(', ')}`}
                    </option>
                  ))}
                </select>

                <FnArgsInput inputs={selectedReadFn?.inputs} args={readArgs} setArgs={setReadArgs} />

                {selectedReadFn && (
                  <button
                    onClick={handleRead}
                    disabled={reading}
                    className="w-full py-2 rounded-lg text-sm font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {reading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 'Call'}
                  </button>
                )}

                {readResult !== null && (
                  <div className="p-3 bg-white/[0.03] border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/60">Result</span>
                      <CopyButton text={readResult} size="sm" />
                    </div>
                    <pre className="text-sm font-mono text-emerald-300/80 whitespace-pre-wrap break-all">{readResult}</pre>
                  </div>
                )}
              </>
            ) : (
              <p className="text-white/20 text-sm">No read functions</p>
            )}
          </div>
        )}

        {/* WRITE MODE */}
        {mode === 'write' && selectedContract && (
          <div className="space-y-3">
            {writeFunctions.length > 0 ? (
              <>
                <select
                  value={selectedFunction}
                  onChange={(e) => setSelectedFunction(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select function...</option>
                  {writeFunctions.map((fn) => (
                    <option key={fn.name} value={fn.name}>
                      {fn.name}({fn.inputs.map((inp: any) => `${inp.type} ${inp.name}`).join(', ')})
                    </option>
                  ))}
                </select>

                <FnArgsInput inputs={selectedFn?.inputs} args={fnArgs} setArgs={setFnArgs} />

                {selectedFn && (
                  <>
                    <div>
                      <label className="text-[10px] text-white/30 mb-0.5 block">ETH value (optional)</label>
                      <input
                        type="text"
                        value={ethValue}
                        onChange={(e) => setEthValue(e.target.value)}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleWrite}
                      disabled={sending}
                      className="w-full py-2 rounded-lg text-sm font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {sending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 'Send Transaction'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="text-white/20 text-sm">No write functions</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FnArgsInput({ inputs, args, setArgs }: {
  inputs?: any[]
  args: string[]
  setArgs: (a: string[]) => void
}) {
  if (!inputs || inputs.length === 0) return null
  return (
    <div className="space-y-2">
      {inputs.map((inp: any, i: number) => (
        <div key={i}>
          <label className="text-[10px] text-white/30 mb-0.5 block">
            {inp.name || `arg${i}`} <span className="text-white/15">({inp.type})</span>
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
