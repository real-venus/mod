'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { API_URL } from './config'

// ── Types ───────────────────────────────────────────────

type Chain = 'ethereum' | 'arbitrum' | 'base' | 'polygon' | 'optimism'
type Tab = 'pools' | 'swaps' | 'tokens' | 'saved'
type Source = 'auto' | 'hypersync' | 'graph' | 'rpc'

interface Pool {
  id: string
  token0: { symbol: string; name: string }
  token1: { symbol: string; name: string }
  feeTier: string
  volumeUSD: string
  totalValueLockedUSD: string
  txCount: string
  token0Price: string
  token1Price: string
}

interface Swap {
  id: string
  timestamp: string
  amount0: string
  amount1: string
  amountUSD: string
  sender: string
  pool?: { id: string; token0: { symbol: string }; token1: { symbol: string } }
}

interface Token {
  id: string
  symbol: string
  name: string
  volumeUSD: string
  totalValueLockedUSD: string
  txCount: string
}

interface SavedFile {
  filename: string
  size: number
  modified: string
}

interface PoolDay {
  date: number
  volumeUSD: string
  tvlUSD: string
  feesUSD: string
}

// ── Helpers ─────────────────────────────────────────────

const fmt = (n: string | number, d = 2) => {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '$0'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(d)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(d)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(d)}K`
  return `$${v.toFixed(d)}`
}

const fmtAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''

const fmtTime = (ts: string) => {
  const d = new Date(parseInt(ts) * 1000)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const feePct = (tier: string) => (parseInt(tier) / 10000).toFixed(2) + '%'

const CHAINS: { key: Chain; label: string; color: string }[] = [
  { key: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  { key: 'arbitrum', label: 'Arbitrum', color: '#28A0F0' },
  { key: 'base', label: 'Base', color: '#0052FF' },
  { key: 'polygon', label: 'Polygon', color: '#8247E5' },
  { key: 'optimism', label: 'Optimism', color: '#FF0420' },
]

// ── Main ────────────────────────────────────────────────

export default function Home() {
  const [chain, setChain] = useState<Chain>('ethereum')
  const [tab, setTab] = useState<Tab>('pools')
  const [source, setSource] = useState<Source>('auto')
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [pools, setPools] = useState<Pool[]>([])
  const [swaps, setSwaps] = useState<Swap[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [saved, setSaved] = useState<SavedFile[]>([])
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [poolHistory, setPoolHistory] = useState<PoolDay[]>([])

  // ── Fetchers ──────────────────────────────────────────

  const fetchPools = useCallback(async (update = false) => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API_URL}/pools?chain=${chain}&limit=25&update=${update}`)
      if (!r.ok) throw new Error(await r.text())
      setPools(await r.json())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [chain])

  const fetchSwaps = useCallback(async (update = false) => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API_URL}/swaps?chain=${chain}&days=${days}&limit=200&source=${source}&update=${update}`)
      if (!r.ok) throw new Error(await r.text())
      setSwaps(await r.json())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [chain, days, source])

  const fetchTokens = useCallback(async (update = false) => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API_URL}/tokens?chain=${chain}&limit=25&update=${update}`)
      if (!r.ok) throw new Error(await r.text())
      setTokens(await r.json())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [chain])

  const fetchSaved = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API_URL}/saved?chain=${chain}`)
      if (!r.ok) throw new Error(await r.text())
      setSaved(await r.json())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [chain])

  const fetchPoolHistory = useCallback(async (poolId: string) => {
    try {
      const r = await fetch(`${API_URL}/pool/${poolId}/history?chain=${chain}&days=${days}`)
      if (!r.ok) return
      setPoolHistory(await r.json())
    } catch {}
  }, [chain, days])

  const fetchCurrent = useCallback((update = false) => {
    if (tab === 'pools') fetchPools(update)
    else if (tab === 'swaps') fetchSwaps(update)
    else if (tab === 'tokens') fetchTokens(update)
    else if (tab === 'saved') fetchSaved()
  }, [tab, fetchPools, fetchSwaps, fetchTokens, fetchSaved])

  // ── Effects ───────────────────────────────────────────

  useEffect(() => {
    fetchCurrent(false)
  }, [fetchCurrent])

  useEffect(() => {
    if (selectedPool) fetchPoolHistory(selectedPool)
  }, [selectedPool, fetchPoolHistory])

  // ── Actions ───────────────────────────────────────────

  const saveCurrentData = async () => {
    setSaving(true)
    const data = tab === 'pools' ? pools : tab === 'swaps' ? swaps : tokens
    const name = tab
    try {
      await fetch(`${API_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, name, chain }),
      })
    } catch {}
    setSaving(false)
  }

  const deleteSaved = async (filename: string) => {
    await fetch(`${API_URL}/saved/${filename}`, { method: 'DELETE' })
    fetchSaved()
  }

  const downloadSaved = async (filename: string) => {
    const r = await fetch(`${API_URL}/saved/${filename}`)
    const data = await r.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────

  return (
    <main className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Uniswap V3 Explorer</h1>
          <p className="text-sm text-slate-400 mt-1">Multi-chain pool & swap history</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={chain} onChange={e => setChain(e.target.value as Chain)}>
            {CHAINS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select value={source} onChange={e => setSource(e.target.value as Source)}>
            <option value="auto">Auto (best effort)</option>
            <option value="hypersync">HyperSync (fast)</option>
            <option value="graph">The Graph</option>
            <option value="rpc">RPC (unlimited)</option>
          </select>
          <select value={days} onChange={e => setDays(parseInt(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['pools', 'swaps', 'tokens', 'saved'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`tab ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => fetchCurrent(true)} disabled={loading}
          className="btn btn-ghost text-sm" title="Force refresh (bypass cache)">
          {loading ? '...' : 'Refresh'}
        </button>
        {tab !== 'saved' && (
          <button onClick={saveCurrentData} disabled={saving}
            className="btn btn-primary text-sm">
            {saving ? 'Saving...' : 'Save to LocalFS'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 mb-4 border-red-500/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-uni-pink border-t-transparent rounded-full animate-spin mr-2" />
          Loading {tab}...
        </div>
      )}

      {/* Pools Tab */}
      {tab === 'pools' && !loading && (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Pool</th>
                <th>Fee</th>
                <th>TVL</th>
                <th>Volume</th>
                <th>Txns</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pools.map(p => (
                <tr key={p.id}>
                  <td className="font-medium text-white">
                    {p.token0.symbol}/{p.token1.symbol}
                    <div className="text-xs text-slate-500 font-mono">{fmtAddr(p.id)}</div>
                  </td>
                  <td><span className="text-xs bg-uni-pink/10 text-uni-pink px-2 py-0.5 rounded">{feePct(p.feeTier)}</span></td>
                  <td>{fmt(p.totalValueLockedUSD)}</td>
                  <td>{fmt(p.volumeUSD)}</td>
                  <td className="text-slate-400">{parseInt(p.txCount).toLocaleString()}</td>
                  <td className="text-xs text-slate-400">{parseFloat(p.token0Price).toFixed(4)}</td>
                  <td>
                    <button onClick={() => setSelectedPool(selectedPool === p.id ? null : p.id)}
                      className="btn-ghost text-xs px-2 py-1 rounded">
                      {selectedPool === p.id ? 'Hide' : 'Chart'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pools.length === 0 && <div className="text-center py-8 text-slate-500">No pools found</div>}
        </div>
      )}

      {/* Pool History Chart */}
      {selectedPool && poolHistory.length > 0 && (
        <div className="card p-6 mt-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            Daily Volume — {fmtAddr(selectedPool)}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[...poolHistory].reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={d => new Date(d * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={v => fmt(v, 0)} />
              <Tooltip
                contentStyle={{ background: '#131a2a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelFormatter={d => new Date(Number(d) * 1000).toLocaleDateString()}
                formatter={(v: number) => [fmt(v), 'Volume']} />
              <Bar dataKey="volumeUSD" fill="#FC72FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Swaps Tab */}
      {tab === 'swaps' && !loading && (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Pool</th>
                <th>Amount 0</th>
                <th>Amount 1</th>
                <th>USD</th>
                <th>Sender</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s, i) => (
                <tr key={s.id || i}>
                  <td className="text-xs text-slate-400">{s.timestamp ? fmtTime(s.timestamp) : '-'}</td>
                  <td className="font-medium text-white text-sm">
                    {s.pool ? `${s.pool.token0.symbol}/${s.pool.token1.symbol}` : fmtAddr(s.pool?.id || '')}
                  </td>
                  <td className={`text-sm ${parseFloat(s.amount0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {parseFloat(s.amount0).toFixed(4)}
                  </td>
                  <td className={`text-sm ${parseFloat(s.amount1) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {parseFloat(s.amount1).toFixed(4)}
                  </td>
                  <td>{s.amountUSD ? fmt(s.amountUSD) : '-'}</td>
                  <td className="font-mono text-xs text-slate-500">{fmtAddr(s.sender)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {swaps.length === 0 && <div className="text-center py-8 text-slate-500">No swaps found</div>}
          <div className="p-4 text-xs text-slate-500 border-t border-uni-border">
            {swaps.length} swaps | source: {source} | {days} days | {chain}
          </div>
        </div>
      )}

      {/* Tokens Tab */}
      {tab === 'tokens' && !loading && (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Symbol</th>
                <th>TVL</th>
                <th>Volume</th>
                <th>Txns</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map(t => (
                <tr key={t.id}>
                  <td>
                    <span className="text-white font-medium">{t.name}</span>
                    <div className="text-xs text-slate-500 font-mono">{fmtAddr(t.id)}</div>
                  </td>
                  <td><span className="text-uni-pink font-medium">{t.symbol}</span></td>
                  <td>{fmt(t.totalValueLockedUSD)}</td>
                  <td>{fmt(t.volumeUSD)}</td>
                  <td className="text-slate-400">{parseInt(t.txCount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tokens.length === 0 && <div className="text-center py-8 text-slate-500">No tokens found</div>}
        </div>
      )}

      {/* Saved Tab */}
      {tab === 'saved' && !loading && (
        <div className="card">
          {saved.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No saved files. Use &quot;Save to LocalFS&quot; on the pools/swaps/tokens tabs.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Saved</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {saved.map(f => (
                  <tr key={f.filename}>
                    <td className="font-mono text-sm text-white">{f.filename}</td>
                    <td className="text-slate-400">{(f.size / 1024).toFixed(1)} KB</td>
                    <td className="text-xs text-slate-400">{new Date(f.modified).toLocaleString()}</td>
                    <td className="flex gap-2">
                      <button onClick={() => downloadSaved(f.filename)}
                        className="btn-ghost text-xs px-2 py-1 rounded">Download</button>
                      <button onClick={() => deleteSaved(f.filename)}
                        className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-600">
        Uniswap V3 Explorer | Sources: The Graph + HyperSync + Direct RPC (round-robin, cached)
      </footer>
    </main>
  )
}
