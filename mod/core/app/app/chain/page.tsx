"use client"

import { useState, useEffect, useCallback } from 'react'
import { userContext } from '@/context'

export const dynamic = 'force-dynamic'

type Tab = 'deploy' | 'contracts' | 'interact' | 'config'

const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'deploy', label: 'DEPLOY', icon: '\u25B6' },
  { key: 'contracts', label: 'CONTRACTS', icon: '\u25A4' },
  { key: 'interact', label: 'INTERACT', icon: '\u25C9' },
  { key: 'config', label: 'CONFIG', icon: '\u2630' },
]

const NETWORKS = ['testnet', 'ganache', 'mainnet']

const DEPLOY_GROUPS = [
  ['token', 'oracle', 'registry', 'perms'],
  ['tokengate', 'bloctime'],
  ['treasury'],
  ['market'],
  ['debit'],
]

interface ContractInfo {
  address: string
  contract: string
}

interface DeployStatus {
  deploy_id: string
  status: 'running' | 'complete' | 'failed'
  result?: Record<string, any>
  error?: string
  duration?: number
}

// ==================== DEPLOY PANEL ====================

function DeployPanel({ client, network }: { client: any; network: string }) {
  const [deploying, setDeploying] = useState(false)
  const [deployId, setDeployId] = useState<string | null>(null)
  const [deployStatus, setDeployStatus] = useState<DeployStatus | null>(null)
  const [selectedMods, setSelectedMods] = useState<string[]>([])
  const [log, setLog] = useState<string[]>([])

  const allMods = DEPLOY_GROUPS.flat()

  const toggleMod = (mod: string) => {
    setSelectedMods(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    )
  }

  const handleDeploy = async () => {
    if (!client) return
    setDeploying(true)
    setLog([`> Deploying to ${network}...`])
    setDeployStatus(null)

    try {
      const mods = selectedMods.length > 0 ? selectedMods : undefined
      const res = await client.call('chain.api/deploy', { network, mods })
      setDeployId(res.deploy_id)
      setLog(prev => [...prev, `> Deploy started: ${res.deploy_id}`])
    } catch (err: any) {
      setLog(prev => [...prev, `> ERROR: ${err?.message || 'Deploy failed'}`])
      setDeploying(false)
    }
  }

  // Poll deploy status
  useEffect(() => {
    if (!deployId || !client) return
    const interval = setInterval(async () => {
      try {
        const status = await client.call('chain.api/status', { deploy_id: deployId })
        setDeployStatus(status)
        if (status.status === 'complete') {
          setLog(prev => [...prev, `> Deploy complete in ${status.duration}s`])
          setDeploying(false)
          clearInterval(interval)
        } else if (status.status === 'failed') {
          setLog(prev => [...prev, `> FAILED: ${status.error}`])
          setDeploying(false)
          clearInterval(interval)
        }
      } catch {
        // ignore poll errors
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [deployId, client])

  return (
    <div>
      {/* Deploy Groups Visualization */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px', letterSpacing: '0.1em' }}>
          DEPLOY GROUPS (parallel within group, sequential across)
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {DEPLOY_GROUPS.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {gi > 0 && <span style={{ color: 'var(--text-tertiary)', margin: '0 4px', fontFamily: TERM_FONT }}>{'\u2192'}</span>}
              <div style={{
                border: '2px solid var(--border-color)',
                padding: '8px 12px',
                background: 'var(--bg-secondary)',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
              }}>
                {group.map(mod => {
                  const selected = selectedMods.length === 0 || selectedMods.includes(mod)
                  return (
                    <button
                      key={mod}
                      onClick={() => toggleMod(mod)}
                      style={{
                        fontFamily: TERM_FONT,
                        fontSize: '12px',
                        padding: '4px 8px',
                        border: selected ? '1px solid var(--accent-primary, #10b981)' : '1px solid var(--border-color)',
                        background: selected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        color: selected ? 'var(--accent-primary, #10b981)' : 'var(--text-tertiary)',
                        cursor: 'pointer',
                      }}
                    >
                      {mod}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deploy Button */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
        <button
          onClick={handleDeploy}
          disabled={deploying}
          style={{
            fontFamily: TERM_FONT,
            fontSize: '14px',
            padding: '10px 24px',
            border: '2px solid var(--accent-primary, #10b981)',
            color: deploying ? 'var(--text-tertiary)' : 'var(--accent-primary, #10b981)',
            background: deploying ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
            boxShadow: deploying ? 'none' : '3px 3px 0px 0px var(--accent-primary, #10b981)',
            cursor: deploying ? 'not-allowed' : 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          {deploying ? 'DEPLOYING...' : selectedMods.length > 0 ? `DEPLOY [${selectedMods.join(', ')}]` : 'DEPLOY ALL'}
        </button>
        {selectedMods.length > 0 && (
          <button
            onClick={() => setSelectedMods([])}
            style={{
              fontFamily: TERM_FONT,
              fontSize: '12px',
              padding: '6px 12px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Deploy Log */}
      {log.length > 0 && (
        <div style={{
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '16px',
          fontFamily: TERM_FONT,
          fontSize: '13px',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {log.map((line, i) => (
            <div key={i} style={{
              color: line.includes('ERROR') || line.includes('FAILED')
                ? '#ef4444'
                : line.includes('complete')
                  ? 'var(--accent-primary, #10b981)'
                  : 'var(--text-secondary)',
              marginBottom: '4px',
            }}>
              {line}
            </div>
          ))}
          {deploying && (
            <div style={{ color: 'var(--accent-primary, #10b981)', animation: 'pulse 1s infinite' }}>
              {'> '}waiting...
            </div>
          )}
        </div>
      )}

      {/* Deploy Result */}
      {deployStatus?.status === 'complete' && deployStatus.result && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--accent-primary, #10b981)', marginBottom: '8px' }}>
            DEPLOYED CONTRACTS
          </div>
          {Object.entries(deployStatus.result).map(([name, addr]) => (
            <div key={name} style={{
              fontFamily: TERM_FONT,
              fontSize: '12px',
              color: 'var(--text-secondary)',
              padding: '4px 0',
              display: 'flex',
              gap: '12px',
            }}>
              <span style={{ color: 'var(--text-primary)', minWidth: '100px' }}>{name}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{typeof addr === 'string' ? addr : JSON.stringify(addr)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== CONTRACTS PANEL ====================

function ContractList({ client, network }: { client: any; network: string }) {
  const [contracts, setContracts] = useState<Record<string, ContractInfo>>({})
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!client) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await client.call('chain.api/contracts', { network })
        setContracts(res || {})
      } catch {
        setContracts({})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client, network])

  const copyAddr = (addr: string, name: string) => {
    navigator.clipboard.writeText(addr)
    setCopied(name)
    setTimeout(() => setCopied(null), 2000)
  }

  const explorerUrl = (addr: string) => {
    if (network === 'mainnet') return `https://basescan.org/address/${addr}`
    if (network === 'testnet') return `https://sepolia.basescan.org/address/${addr}`
    return null
  }

  if (loading) return <div style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)' }}>Loading contracts...</div>

  const entries = Object.entries(contracts)
  if (entries.length === 0) return <div style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)' }}>No contracts deployed on {network}</div>

  return (
    <div>
      {entries.map(([name, info]) => (
        <div key={name} style={{
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '12px 16px',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: TERM_FONT, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
              {name}
            </div>
            <div style={{ fontFamily: TERM_FONT, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {info.contract}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: TERM_FONT,
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}>
              {info.address?.slice(0, 6)}...{info.address?.slice(-4)}
            </span>
            <button
              onClick={() => copyAddr(info.address, name)}
              style={{
                fontFamily: TERM_FONT,
                fontSize: '11px',
                padding: '2px 8px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: copied === name ? 'var(--accent-primary, #10b981)' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {copied === name ? 'copied' : 'copy'}
            </button>
            {explorerUrl(info.address) && (
              <a
                href={explorerUrl(info.address)!}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: TERM_FONT,
                  fontSize: '11px',
                  padding: '2px 8px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-tertiary)',
                  textDecoration: 'none',
                }}
              >
                {'\u2197'}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== INTERACT PANEL ====================

interface MethodInfo {
  name: string
  inputs: { name: string; type: string }[]
  outputs: { name: string; type: string }[]
  stateMutability: string
}

function ContractInteract({ client, network }: { client: any; network: string }) {
  const [mods, setMods] = useState<string[]>([])
  const [selectedMod, setSelectedMod] = useState<string>('')
  const [methods, setMethods] = useState<MethodInfo[]>([])
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [params, setParams] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available mods
  useEffect(() => {
    if (!client) return
    client.call('chain.api/mods').then((res: string[]) => setMods(res || [])).catch(() => {})
  }, [client])

  // Load methods when mod selected
  useEffect(() => {
    if (!client || !selectedMod) { setMethods([]); return }
    client.call('chain.api/methods', { contract: selectedMod, network })
      .then((res: MethodInfo[] | { error: string }) => {
        if (Array.isArray(res)) setMethods(res)
        else setMethods([])
      })
      .catch(() => setMethods([]))
  }, [client, selectedMod, network])

  // Reset params when method changes
  useEffect(() => {
    setParams({})
    setResult(null)
    setError(null)
  }, [selectedMethod])

  const currentMethod = methods.find(m => m.name === selectedMethod)
  const isRead = currentMethod?.stateMutability === 'view' || currentMethod?.stateMutability === 'pure'

  const handleExecute = async () => {
    if (!client || !selectedMod || !selectedMethod) return
    setLoading(true)
    setError(null)
    setResult(null)

    const args = currentMethod?.inputs.map(i => params[i.name] || '') || []

    try {
      const endpoint = isRead ? 'chain.api/call' : 'chain.api/send'
      const res = await client.call(endpoint, {
        contract: selectedMod,
        method: selectedMethod,
        args,
        network,
      })
      setResult(res)
    } catch (err: any) {
      setError(err?.message || 'Execution failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Contract Selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {mods.map(mod => (
          <button
            key={mod}
            onClick={() => { setSelectedMod(mod); setSelectedMethod('') }}
            style={{
              fontFamily: TERM_FONT,
              fontSize: '13px',
              padding: '6px 14px',
              border: selectedMod === mod ? '2px solid var(--accent-primary, #10b981)' : '2px solid var(--border-color)',
              background: selectedMod === mod ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              color: selectedMod === mod ? 'var(--accent-primary, #10b981)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: selectedMod === mod ? '2px 2px 0px 0px var(--accent-primary, #10b981)' : 'none',
            }}
          >
            {mod}
          </button>
        ))}
      </div>

      {/* Method Selector */}
      {methods.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px', letterSpacing: '0.1em' }}>
            METHODS
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {methods.map(m => {
              const read = m.stateMutability === 'view' || m.stateMutability === 'pure'
              return (
                <button
                  key={m.name}
                  onClick={() => setSelectedMethod(m.name)}
                  style={{
                    fontFamily: TERM_FONT,
                    fontSize: '11px',
                    padding: '4px 10px',
                    border: selectedMethod === m.name
                      ? `1px solid ${read ? '#3b82f6' : '#f59e0b'}`
                      : '1px solid var(--border-color)',
                    background: selectedMethod === m.name
                      ? (read ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)')
                      : 'transparent',
                    color: selectedMethod === m.name
                      ? (read ? '#3b82f6' : '#f59e0b')
                      : 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  {read ? '\u25CB' : '\u25CF'} {m.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Parameter Inputs */}
      {currentMethod && currentMethod.inputs.length > 0 && (
        <div style={{
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px', letterSpacing: '0.1em' }}>
            PARAMETERS
          </div>
          {currentMethod.inputs.map(input => (
            <div key={input.name} style={{ marginBottom: '10px' }}>
              <label style={{
                fontFamily: TERM_FONT,
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                display: 'block',
                marginBottom: '4px',
              }}>
                {input.name} <span style={{ opacity: 0.5 }}>({input.type})</span>
              </label>
              <input
                value={params[input.name] || ''}
                onChange={e => setParams(prev => ({ ...prev, [input.name]: e.target.value }))}
                placeholder={input.type}
                style={{
                  width: '100%',
                  fontFamily: TERM_FONT,
                  fontSize: '13px',
                  padding: '6px 10px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Execute Button */}
      {currentMethod && (
        <button
          onClick={handleExecute}
          disabled={loading}
          style={{
            fontFamily: TERM_FONT,
            fontSize: '13px',
            padding: '8px 20px',
            border: `2px solid ${isRead ? '#3b82f6' : '#f59e0b'}`,
            color: isRead ? '#3b82f6' : '#f59e0b',
            background: 'transparent',
            boxShadow: `2px 2px 0px 0px ${isRead ? '#3b82f6' : '#f59e0b'}`,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            marginBottom: '16px',
          }}
        >
          {loading ? '...' : isRead ? 'CALL (read)' : 'SEND (write)'}
        </button>
      )}

      {/* Result */}
      {error && (
        <div style={{
          fontFamily: TERM_FONT,
          fontSize: '13px',
          color: '#ef4444',
          border: '1px solid #ef4444',
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.05)',
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          fontFamily: TERM_FONT,
          fontSize: '13px',
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '12px',
        }}>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em' }}>RESULT</div>
          <pre style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ==================== CONFIG VIEWER ====================

function ConfigViewer({ client, network }: { client: any; network: string }) {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['contracts']))

  useEffect(() => {
    if (!client) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await client.call('chain.api/config', { network })
        setConfig(res)
      } catch {
        setConfig(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client, network])

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (loading) return <div style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)' }}>Loading config...</div>
  if (!config) return <div style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)' }}>No config for {network}</div>

  const renderValue = (val: any, path: string, depth: number): JSX.Element => {
    if (val === null || val === undefined) {
      return <span style={{ color: 'var(--text-tertiary)' }}>null</span>
    }
    if (typeof val !== 'object') {
      return <span style={{ color: typeof val === 'string' ? '#10b981' : '#3b82f6' }}>
        {typeof val === 'string' ? `"${val}"` : String(val)}
      </span>
    }
    const entries = Object.entries(val)
    const isExpanded = expanded.has(path)
    return (
      <div style={{ marginLeft: depth > 0 ? '16px' : '0' }}>
        <button
          onClick={() => toggle(path)}
          style={{
            fontFamily: TERM_FONT,
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          {isExpanded ? '\u25BC' : '\u25B6'} {entries.length} {Array.isArray(val) ? 'items' : 'keys'}
        </button>
        {isExpanded && entries.map(([k, v]) => (
          <div key={k} style={{ padding: '2px 0' }}>
            <span style={{ color: 'var(--text-secondary)', fontFamily: TERM_FONT, fontSize: '12px' }}>{k}: </span>
            {renderValue(v, `${path}.${k}`, depth + 1)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      border: '2px solid var(--border-color)',
      background: 'var(--bg-secondary)',
      padding: '16px',
      fontFamily: TERM_FONT,
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '11px' }}>
        {network.toUpperCase()} DEPLOYMENT CONFIG
      </div>
      {renderValue(config, 'root', 0)}
    </div>
  )
}

// ==================== MAIN PAGE ====================

export default function ChainPage() {
  const { client } = userContext()
  const [activeTab, setActiveTab] = useState<Tab>('deploy')
  const [network, setNetwork] = useState('testnet')

  return (
    <div className="min-h-screen" style={{ fontFamily: TERM_FONT, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ color: 'var(--accent-primary, #10b981)', fontSize: '20px', fontFamily: TERM_FONT }}>$</span>
            <span style={{
              fontFamily: TERM_FONT,
              fontSize: '22px',
              letterSpacing: '0.08em',
              color: 'var(--accent-primary, #10b981)',
              textShadow: '0 0 12px var(--accent-primary, #10b981)',
            }}>
              chain
            </span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '14px', fontFamily: TERM_FONT }}>
              --deploy --interact
            </span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', fontFamily: TERM_FONT }}>
            Deploy and interact with on-chain contracts
          </p>
          <div className="mt-3" style={{ height: '2px', background: 'var(--accent-primary, #10b981)', opacity: 0.3 }} />
        </div>

        {/* Network Selector */}
        <div className="mb-6" style={{
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
            NETWORK
          </span>
          {NETWORKS.map(net => (
            <button
              key={net}
              onClick={() => setNetwork(net)}
              style={{
                fontFamily: TERM_FONT,
                fontSize: '13px',
                padding: '4px 12px',
                border: network === net ? '1px solid var(--accent-primary, #10b981)' : '1px solid var(--border-color)',
                background: network === net ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                color: network === net ? 'var(--accent-primary, #10b981)' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {net}
            </button>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-8" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="transition-all"
                style={{
                  fontFamily: TERM_FONT,
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  padding: '8px 16px',
                  border: active ? '2px solid var(--accent-primary, #10b981)' : '2px solid transparent',
                  background: active ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                  color: active ? 'var(--accent-primary, #10b981)' : 'var(--text-tertiary)',
                  boxShadow: active ? '2px 2px 0px 0px var(--accent-primary, #10b981)' : 'none',
                  cursor: 'pointer',
                  textShadow: active ? '0 0 8px var(--accent-primary, #10b981)' : 'none',
                }}
              >
                <span style={{ marginRight: '6px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'deploy' && <DeployPanel client={client} network={network} />}
        {activeTab === 'contracts' && <ContractList client={client} network={network} />}
        {activeTab === 'interact' && <ContractInteract client={client} network={network} />}
        {activeTab === 'config' && <ConfigViewer client={client} network={network} />}
      </div>
    </div>
  )
}
