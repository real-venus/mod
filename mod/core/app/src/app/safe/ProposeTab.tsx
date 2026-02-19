"use client"

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import {
  PaperAirplaneIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { GlowCard } from './GlowCard'
import {
  ACCENT, inputClass, selectClass, btnClass,
  CONTRACT_ABIS, getWriteFunctions, getReadFunctions, getContracts,
} from './shared'
import { shorten } from '@/utils'
import {
  proposeSafeTransaction,
  encodeContractCall,
  type SafeInfo,
  type SafeTxParams,
} from '@/network/safe'
import { toast } from 'react-toastify'

export function ProposeTab({
  safeInfo, walletAddress, isOwner,
}: {
  safeInfo: SafeInfo | null
  walletAddress: string
  isOwner: boolean
}) {
  const [selectedContract, setSelectedContract] = useState('')
  const [selectedFunction, setSelectedFunction] = useState('')
  const [fnArgs, setFnArgs] = useState<string[]>([])
  const [ethValue, setEthValue] = useState('')
  const [proposing, setProposing] = useState(false)
  const [proposeMode, setProposeMode] = useState<'write' | 'read'>('write')

  const [selectedReadFunction, setSelectedReadFunction] = useState('')
  const [readArgs, setReadArgs] = useState<string[]>([])
  const [readResult, setReadResult] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const [sendEthTo, setSendEthTo] = useState('')
  const [sendEthAmount, setSendEthAmount] = useState('')
  const [sendingEth, setSendingEth] = useState(false)

  const [lastTxParams, setLastTxParams] = useState<SafeTxParams | null>(null)

  const contracts = getContracts()
  const selectedContractInfo = contracts.find((c) => c.name === selectedContract)
  const abi = selectedContract ? CONTRACT_ABIS[selectedContract] : null
  const writeFunctions = abi ? getWriteFunctions(abi) : []
  const selectedFn = writeFunctions.find((f) => f.name === selectedFunction)
  const readFunctions = abi ? getReadFunctions(abi) : []
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
        safeInfo.address, selectedContractInfo.address, data, signer, network.chainId, weiValue
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
        safeInfo.address, sendEthTo, '0x', signer, network.chainId, weiValue
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

  async function handleRead() {
    if (!selectedContractInfo || !selectedReadFn || !abi) { toast.error('Select contract and function'); return }
    setReading(true)
    setReadResult(null)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(selectedContractInfo.address, abi, provider)
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
      toast.error(err?.message || 'Read failed')
      setReadResult(`Error: ${err?.message || 'Read failed'}`)
    } finally {
      setReading(false)
    }
  }

  if (!safeInfo) {
    return (
      <GlowCard color={ACCENT}>
        <p className="text-white/40 text-center py-4">Load a Safe first</p>
      </GlowCard>
    )
  }

  return (
    <div className="space-y-4">
      <GlowCard color={ACCENT} delay={0.1}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">Contract Interaction</h2>

        {/* Contract selector */}
        <div className="mb-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Contract</label>
          <select value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)} className={selectClass}>
            <option value="">Select a contract...</option>
            {contracts.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({shorten(c.address, 6, 4)})</option>
            ))}
          </select>
        </div>

        {/* Write / Read toggle */}
        {selectedContract && (
          <div className="flex gap-1 mb-4 p-1 bg-white/[0.03] rounded-lg">
            <button
              onClick={() => setProposeMode('write')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                proposeMode === 'write' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/30 hover:text-white/50'
              }`}
            >Write</button>
            <button
              onClick={() => setProposeMode('read')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                proposeMode === 'read' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white/30 hover:text-white/50'
              }`}
            >Read</button>
          </div>
        )}

        {/* WRITE MODE */}
        {proposeMode === 'write' && (
          <>
            {selectedContract && writeFunctions.length > 0 && (
              <div className="mb-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Function</label>
                <select value={selectedFunction} onChange={(e) => setSelectedFunction(e.target.value)} className={selectClass}>
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
            <FnArgsInput inputs={selectedFn?.inputs} args={fnArgs} setArgs={setFnArgs} color="amber" />
            {selectedFn && (
              <div className="mb-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">ETH Value (optional)</label>
                <input type="text" value={ethValue} onChange={(e) => setEthValue(e.target.value)} placeholder="0" className={inputClass} />
              </div>
            )}
            {selectedFn && (
              <button
                onClick={handlePropose}
                disabled={proposing || !isOwner}
                className={`${btnClass} w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 flex items-center justify-center gap-2`}
              >
                {proposing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <><PaperAirplaneIcon className="w-4 h-4" /> Propose Transaction</>}
              </button>
            )}
            {selectedFn && !isOwner && (
              <p className="text-xs text-amber-500/40 mt-2 text-center">You must be a Safe signer to propose</p>
            )}
          </>
        )}

        {/* READ MODE */}
        {proposeMode === 'read' && (
          <>
            {selectedContract && readFunctions.length > 0 && (
              <div className="mb-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Function</label>
                <select value={selectedReadFunction} onChange={(e) => setSelectedReadFunction(e.target.value)} className={selectClass}>
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
            <FnArgsInput inputs={selectedReadFn?.inputs} args={readArgs} setArgs={setReadArgs} color="emerald" />
            {selectedReadFn && (
              <button
                onClick={handleRead}
                disabled={reading}
                className={`${btnClass} w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 flex items-center justify-center gap-2`}
              >
                {reading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 'Call'}
              </button>
            )}
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
            <input type="text" value={sendEthTo} onChange={(e) => setSendEthTo(e.target.value)} placeholder="0x..." className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] text-white/30 mb-0.5 block">Amount (ETH)</label>
            <input type="text" value={sendEthAmount} onChange={(e) => setSendEthAmount(e.target.value)} placeholder="0.01" className={inputClass} />
          </div>
          <button
            onClick={handleSendEth}
            disabled={sendingEth || !isOwner}
            className={`${btnClass} w-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 flex items-center justify-center gap-2`}
          >
            {sendingEth ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <><PaperAirplaneIcon className="w-4 h-4" /> Propose ETH Transfer</>}
          </button>
          {!isOwner && <p className="text-xs text-indigo-500/40 mt-1 text-center">You must be a Safe signer to propose</p>}
        </div>
      </GlowCard>

      {/* Last TX Params */}
      {lastTxParams && (
        <GlowCard color="#22d3ee" delay={0.1}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400/70">Last TX Params</h2>
            <button onClick={() => setLastTxParams(null)} className="text-[10px] text-white/30 hover:text-white/60">dismiss</button>
          </div>
          <div className="space-y-1.5 text-xs font-mono">
            {[
              ['chainId', lastTxParams.chainId],
              ['safe', lastTxParams.safe],
              ['to', lastTxParams.to],
              ['value', `${lastTxParams.value} wei (${ethers.formatEther(lastTxParams.value)} ETH)`],
              ['nonce', String(lastTxParams.nonce)],
              ['threshold', String(lastTxParams.threshold)],
              ['sender', lastTxParams.sender],
              ['safeTxHash', lastTxParams.safeTxHash],
              ['data', lastTxParams.data === '0x' ? '0x (empty)' : `${lastTxParams.data.slice(0, 66)}...`],
            ].map(([label, val]) => (
              <div key={label} className="flex gap-2">
                <span className="text-cyan-400/50 shrink-0 w-20">{label}</span>
                <span className="text-white/70 break-all">{val}</span>
                {(label === 'safe' || label === 'to' || label === 'safeTxHash') && (
                  <CopyButton text={val.split(' ')[0]} size="sm" />
                )}
              </div>
            ))}
          </div>
        </GlowCard>
      )}
    </div>
  )
}

function FnArgsInput({ inputs, args, setArgs, color }: {
  inputs?: any[]; args: string[]; setArgs: (a: string[]) => void; color: string
}) {
  if (!inputs || inputs.length === 0) return null
  return (
    <div className="mb-4 space-y-3">
      <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 block">Arguments</label>
      {inputs.map((inp: any, i: number) => (
        <div key={i}>
          <label className="text-[10px] text-white/30 mb-0.5 block">
            {inp.name || `arg${i}`} <span className={`text-${color}-500/40`}>({inp.type})</span>
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
