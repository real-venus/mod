"use client"

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { CopyButton } from '@/ui/CopyButton'
import { TerminalCard } from './GlowCard'
import {
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

const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"

const inputStyle: React.CSSProperties = {
  fontFamily: TERM_FONT,
  fontSize: '14px',
  color: 'var(--text-primary)',
  background: 'var(--bg-input)',
  border: '2px solid var(--border-color)',
  padding: '8px 12px',
  width: '100%',
  outline: 'none',
  boxShadow: '2px 2px 0px 0px rgba(255,255,255,0.04)',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: 'transparent',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: TERM_FONT,
  fontSize: '12px',
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
  marginBottom: '6px',
}

const btnStyle: React.CSSProperties = {
  fontFamily: TERM_FONT,
  fontSize: '14px',
  padding: '10px 16px',
  width: '100%',
  border: '2px solid var(--accent-primary, #10b981)',
  color: 'var(--accent-primary, #10b981)',
  background: 'transparent',
  boxShadow: '3px 3px 0px 0px var(--accent-primary, #10b981)',
  cursor: 'pointer',
}

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
      <div className="py-12 text-center" style={{ fontFamily: TERM_FONT, fontSize: '14px', color: 'var(--text-tertiary)' }}>
        load a safe first
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TerminalCard label="CONTRACT INTERACTION">
        {/* Contract selector */}
        <div className="mb-4">
          <label style={labelStyle}>contract</label>
          <select value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)} style={selectStyle}>
            <option value="">select...</option>
            {contracts.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({shorten(c.address, 6, 4)})</option>
            ))}
          </select>
        </div>

        {/* Write / Read toggle */}
        {selectedContract && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setProposeMode('write')}
              style={{
                fontFamily: TERM_FONT,
                fontSize: '13px',
                padding: '6px 14px',
                border: proposeMode === 'write' ? '2px solid var(--accent-primary, #10b981)' : '2px solid var(--border-color)',
                color: proposeMode === 'write' ? 'var(--accent-primary, #10b981)' : 'var(--text-tertiary)',
                background: proposeMode === 'write' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                boxShadow: proposeMode === 'write' ? '2px 2px 0px 0px var(--accent-primary, #10b981)' : 'none',
                cursor: 'pointer',
              }}
            >write</button>
            <button
              onClick={() => setProposeMode('read')}
              style={{
                fontFamily: TERM_FONT,
                fontSize: '13px',
                padding: '6px 14px',
                border: proposeMode === 'read' ? '2px solid #06b6d4' : '2px solid var(--border-color)',
                color: proposeMode === 'read' ? '#06b6d4' : 'var(--text-tertiary)',
                background: proposeMode === 'read' ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                boxShadow: proposeMode === 'read' ? '2px 2px 0px 0px #06b6d4' : 'none',
                cursor: 'pointer',
              }}
            >read</button>
          </div>
        )}

        {/* WRITE MODE */}
        {proposeMode === 'write' && (
          <>
            {selectedContract && writeFunctions.length > 0 && (
              <div className="mb-4">
                <label style={labelStyle}>function</label>
                <select value={selectedFunction} onChange={(e) => setSelectedFunction(e.target.value)} style={selectStyle}>
                  <option value="">select...</option>
                  {writeFunctions.map((fn) => (
                    <option key={fn.name} value={fn.name}>
                      {fn.name}({fn.inputs.map((inp: any) => `${inp.type} ${inp.name}`).join(', ')})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedContract && writeFunctions.length === 0 && (
              <p style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>no write functions</p>
            )}
            <FnArgsInput inputs={selectedFn?.inputs} args={fnArgs} setArgs={setFnArgs} />
            {selectedFn && (
              <div className="mb-4">
                <label style={labelStyle}>eth value</label>
                <input type="text" value={ethValue} onChange={(e) => setEthValue(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
            )}
            {selectedFn && (
              <button
                onClick={handlePropose}
                disabled={proposing || !isOwner}
                style={{ ...btnStyle, opacity: (proposing || !isOwner) ? 0.4 : 1 }}
              >
                {proposing ? 'signing...' : '> propose transaction'}
              </button>
            )}
            {selectedFn && !isOwner && (
              <p className="mt-2 text-center" style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)' }}>must be a signer to propose</p>
            )}
          </>
        )}

        {/* READ MODE */}
        {proposeMode === 'read' && (
          <>
            {selectedContract && readFunctions.length > 0 && (
              <div className="mb-4">
                <label style={labelStyle}>function</label>
                <select value={selectedReadFunction} onChange={(e) => setSelectedReadFunction(e.target.value)} style={selectStyle}>
                  <option value="">select...</option>
                  {readFunctions.map((fn) => (
                    <option key={fn.name} value={fn.name}>
                      {fn.name}({fn.inputs.map((inp: any) => `${inp.type} ${inp.name}`).join(', ')})
                      {fn.outputs.length > 0 && ` \u2192 ${fn.outputs.map((o: any) => o.type).join(', ')}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedContract && readFunctions.length === 0 && (
              <p style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>no read functions</p>
            )}
            <FnArgsInput inputs={selectedReadFn?.inputs} args={readArgs} setArgs={setReadArgs} />
            {selectedReadFn && (
              <button
                onClick={handleRead}
                disabled={reading}
                style={{
                  ...btnStyle,
                  borderColor: '#06b6d4',
                  color: '#06b6d4',
                  boxShadow: '3px 3px 0px 0px #06b6d4',
                  opacity: reading ? 0.4 : 1,
                }}
              >
                {reading ? 'reading...' : '> call'}
              </button>
            )}
            {readResult !== null && (
              <div className="mt-4" style={{ padding: '12px 16px', border: '2px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'rgba(6,182,212,0.5)' }}>result</span>
                  <CopyButton text={readResult} size="sm" />
                </div>
                <pre style={{ fontFamily: TERM_FONT, fontSize: '14px', color: '#06b6d4', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{readResult}</pre>
              </div>
            )}
          </>
        )}
      </TerminalCard>

      {/* Target contract info */}
      {selectedContractInfo && (
        <div className="flex items-center gap-3 px-2" style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>
          <span>target:</span>
          <span style={{ color: 'var(--text-secondary)' }}>{selectedContractInfo.name}</span>
          <span style={{ opacity: 0.5 }}>{shorten(selectedContractInfo.address)}</span>
          <CopyButton text={selectedContractInfo.address} size="sm" />
        </div>
      )}

      {/* Send ETH */}
      <TerminalCard label="SEND ETH">
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>recipient</label>
            <input type="text" value={sendEthTo} onChange={(e) => setSendEthTo(e.target.value)} placeholder="0x..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>amount (eth)</label>
            <input type="text" value={sendEthAmount} onChange={(e) => setSendEthAmount(e.target.value)} placeholder="0.01" style={inputStyle} />
          </div>
          <button
            onClick={handleSendEth}
            disabled={sendingEth || !isOwner}
            style={{
              ...btnStyle,
              borderColor: '#6366f1',
              color: '#6366f1',
              boxShadow: '3px 3px 0px 0px #6366f1',
              opacity: (sendingEth || !isOwner) ? 0.4 : 1,
            }}
          >
            {sendingEth ? 'signing...' : '> propose eth transfer'}
          </button>
          {!isOwner && <p className="text-center" style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)' }}>must be a signer to propose</p>}
        </div>
      </TerminalCard>

      {/* Last TX Params */}
      {lastTxParams && (
        <TerminalCard label="LAST TX">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'rgba(6,182,212,0.5)' }}>params</span>
            <button onClick={() => setLastTxParams(null)} style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer', border: 'none', background: 'none' }}>dismiss</button>
          </div>
          <div className="space-y-2" style={{ fontSize: '13px' }}>
            {([
              ['chainId', lastTxParams.chainId],
              ['safe', lastTxParams.safe],
              ['to', lastTxParams.to],
              ['value', `${lastTxParams.value} wei (${ethers.formatEther(lastTxParams.value)} ETH)`],
              ['nonce', String(lastTxParams.nonce)],
              ['threshold', String(lastTxParams.threshold)],
              ['sender', lastTxParams.sender],
              ['safeTxHash', lastTxParams.safeTxHash],
              ['data', lastTxParams.data === '0x' ? '0x (empty)' : `${lastTxParams.data.slice(0, 66)}...`],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex gap-3">
                <span style={{ fontFamily: TERM_FONT, color: 'rgba(6,182,212,0.5)', flexShrink: 0, width: '90px' }}>{label}</span>
                <span className="break-all" style={{ fontFamily: TERM_FONT, color: 'var(--text-secondary)' }}>{val}</span>
                {(label === 'safe' || label === 'to' || label === 'safeTxHash') && (
                  <CopyButton text={val.split(' ')[0]} size="sm" />
                )}
              </div>
            ))}
          </div>
        </TerminalCard>
      )}
    </div>
  )
}

function FnArgsInput({ inputs, args, setArgs }: {
  inputs?: any[]; args: string[]; setArgs: (a: string[]) => void
}) {
  if (!inputs || inputs.length === 0) return null
  const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"
  const argInputStyle: React.CSSProperties = {
    fontFamily: TERM_FONT,
    fontSize: '14px',
    color: 'var(--text-primary)',
    background: 'var(--bg-input)',
    border: '2px solid var(--border-color)',
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    boxShadow: '2px 2px 0px 0px rgba(255,255,255,0.04)',
  }
  return (
    <div className="mb-4 space-y-3">
      <label style={{ display: 'block', fontFamily: TERM_FONT, fontSize: '12px', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>args</label>
      {inputs.map((inp: any, i: number) => (
        <div key={i}>
          <label style={{ display: 'block', fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            {inp.name || `arg${i}`} <span style={{ opacity: 0.5 }}>({inp.type})</span>
          </label>
          {inp.type === 'bool' ? (
            <select
              value={args[i] || ''}
              onChange={(e) => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
              style={{ ...argInputStyle, backgroundColor: 'transparent' }}
            >
              <option value="">select...</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type="text"
              value={args[i] || ''}
              onChange={(e) => { const next = [...args]; next[i] = e.target.value; setArgs(next) }}
              placeholder={inp.type}
              style={argInputStyle}
            />
          )}
        </div>
      ))}
    </div>
  )
}
