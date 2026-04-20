'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { API_URL } from './config'

// ── Types ───────────────────────────────────────────────

type Chain = 'ethereum' | 'arbitrum' | 'base' | 'polygon' | 'optimism'
type View = 'pools' | 'tokens' | 'explore'
type PoolChartTab = 'volume' | 'tvl' | 'fees'
type PoolDetailTab = 'charts' | 'swaps' | 'info'

interface Pool {
  id: string
  token0: { symbol: string; name: string; id?: string }
  token1: { symbol: string; name: string; id?: string }
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

const fmtNum = (n: string | number) => {
  const v = typeof n === 'string' ? parseInt(n) : n
  if (isNaN(v)) return '0'
  return v.toLocaleString()
}

const fmtAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''

const fmtTime = (ts: string) => {
  const d = new Date(parseInt(ts) * 1000)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const fmtTimeShort = (ts: string) => {
  const d = new Date(parseInt(ts) * 1000)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const feePct = (tier: string) => {
  const v = parseInt(tier)
  if (v === 100) return '0.01%'
  if (v === 500) return '0.05%'
  if (v === 3000) return '0.3%'
  if (v === 10000) return '1%'
  return (v / 10000).toFixed(2) + '%'
}

const feeTierColor = (tier: string) => {
  const v = parseInt(tier)
  if (v === 100) return 'bg-blue-500/15 text-blue-400'
  if (v === 500) return 'bg-emerald-500/15 text-emerald-400'
  if (v === 3000) return 'bg-uni-pink/15 text-uni-pink'
  if (v === 10000) return 'bg-orange-500/15 text-orange-400'
  return 'bg-slate-500/15 text-slate-400'
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

const CHAINS: { key: Chain; label: string; color: string }[] = [
  { key: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  { key: 'arbitrum', label: 'Arbitrum', color: '#28A0F0' },
  { key: 'base', label: 'Base', color: '#0052FF' },
  { key: 'polygon', label: 'Polygon', color: '#8247E5' },
  { key: 'optimism', label: 'Optimism', color: '#FF0420' },
]

type SortKey = 'totalValueLockedUSD' | 'volumeUSD' | 'txCount' | 'feeTier'

async function apiFetch(path: string, timeoutMs = 120000): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(`${API_URL}${path}`, { signal: controller.signal })
    if (!r.ok) {
      const ct = r.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const body = await r.json()
        throw new Error(body.detail || body.message || `API error ${r.status}`)
      }
      throw new Error(`API error ${r.status}: ${r.statusText}`)
    }
    return r.json()
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('Request timed out — backend may be loading data')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// ── Main ────────────────────────────────────────────────

export default function Home() {
  const [chain, setChain] = useState<Chain>('ethereum')
  const [view, setView] = useState<View>('pools')
  const [source, setSource] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [backendOk, setBackendOk] = useState<boolean | null>(null)

  const [pools, setPools] = useState<Pool[]>([])
  const [poolSearch, setPoolSearch] = useState('')
  const [poolSort, setPoolSort] = useState<SortKey>('totalValueLockedUSD')
  const [poolSortDir, setPoolSortDir] = useState<'desc' | 'asc'>('desc')
  const [poolLimit, setPoolLimit] = useState(50)

  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [poolHistory, setPoolHistory] = useState<PoolDay[]>([])
  const [poolSwaps, setPoolSwaps] = useState<Swap[]>([])
  const [poolChartTab, setPoolChartTab] = useState<PoolChartTab>('volume')
  const [poolDetailTab, setPoolDetailTab] = useState<PoolDetailTab>('charts')
  const [poolDays, setPoolDays] = useState(30)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [copied, setCopied] = useState('')

  const [tokens, setTokens] = useState<Token[]>([])
  const [tokenSearch, setTokenSearch] = useState('')

  const [exploring, setExploring] = useState(false)
  const [exploreProgress, setExploreProgress] = useState<any>(null)
  const [exploreResult, setExploreResult] = useState<any>(null)
  const [exploreBlocks, setExploreBlocks] = useState(5000)
  const abortRef = useRef<AbortController | null>(null)

  const [chainOpen, setChainOpen] = useState(false)
  const chainRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (chainRef.current && !chainRef.current.contains(e.target as Node)) {
        setChainOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Health check on mount + retry every 5s while offline
  useEffect(() => {
    const check = () =>
      fetch(`${API_URL}/health`)
        .then(r => setBackendOk(r.ok))
        .catch(() => setBackendOk(false))
    check()
    const id = setInterval(() => {
      if (!backendOk) check()
    }, 5000)
    return () => clearInterval(id)
  }, [backendOk])

  // ── Data fetching ───────────────────────────────────────

  const fetchPools = useCallback(async (update = false) => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch(`/pools?chain=${chain}&limit=${poolLimit}&source=${source}&update=${update}`)
      setPools(data)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [chain, poolLimit, source])

  const fetchTokens = useCallback(async (update = false) => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch(`/tokens?chain=${chain}&limit=50&source=${source}&update=${update}`)
      setTokens(data)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [chain, source])

  useEffect(() => {
    setSelectedPool(null)
    if (view === 'pools') fetchPools()
    else if (view === 'tokens') fetchTokens()
  }, [view, chain, fetchPools, fetchTokens])

  // ── Pool Detail ────────────────────────────────────────

  const openPool = useCallback(async (pool: Pool) => {
    setSelectedPool(pool)
    setPoolDetailTab('charts')
    setPoolChartTab('volume')
    setLoadingDetail(true)
    try {
      const [hist, sw] = await Promise.all([
        apiFetch(`/pool/${pool.id}/history?chain=${chain}&days=${poolDays}&source=${source}`).catch(() => []),
        apiFetch(`/swaps/${pool.id}?chain=${chain}&days=${poolDays}&limit=100&source=${source}`).catch(() => []),
      ])
      setPoolHistory(hist)
      setPoolSwaps(sw)
    } catch {}
    setLoadingDetail(false)
  }, [chain, poolDays, source])

  const refreshPoolDetail = useCallback(async () => {
    if (!selectedPool) return
    setLoadingDetail(true)
    try {
      const [hist, sw] = await Promise.all([
        apiFetch(`/pool/${selectedPool.id}/history?chain=${chain}&days=${poolDays}&source=${source}&update=true`).catch(() => []),
        apiFetch(`/swaps/${selectedPool.id}?chain=${chain}&days=${poolDays}&limit=100&source=${source}&update=true`).catch(() => []),
      ])
      setPoolHistory(hist)
      setPoolSwaps(sw)
    } catch {}
    setLoadingDetail(false)
  }, [selectedPool, chain, poolDays, source])

  useEffect(() => {
    if (selectedPool) {
      setLoadingDetail(true)
      Promise.all([
        apiFetch(`/pool/${selectedPool.id}/history?chain=${chain}&days=${poolDays}&source=${source}`).catch(() => []),
        apiFetch(`/swaps/${selectedPool.id}?chain=${chain}&days=${poolDays}&limit=100&source=${source}`).catch(() => []),
      ]).then(([hist, sw]) => {
        setPoolHistory(hist)
        setPoolSwaps(sw)
      }).finally(() => setLoadingDetail(false))
    }
  }, [poolDays])

  // ── Explorer ───────────────────────────────────────────

  const startExplore = useCallback(async () => {
    setExploring(true)
    setExploreProgress(null)
    setExploreResult(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const r = await fetch(
        `${API_URL}/explore?chain=${chain}&blocks=${exploreBlocks}&stream=true`,
        { signal: controller.signal }
      )
      const reader = r.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.pools || data.tokens) {
              setExploreResult(data)
              setExploreProgress({ status: 'done' })
            } else {
              setExploreProgress(data)
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message)
    }
    setExploring(false)
  }, [chain, exploreBlocks])

  const stopExplore = () => {
    abortRef.current?.abort()
    setExploring(false)
  }

  // ── Sort & Filter ──────────────────────────────────────

  const sortedPools = [...pools]
    .filter(p => {
      if (!poolSearch) return true
      const q = poolSearch.toLowerCase()
      return (
        p.token0.symbol.toLowerCase().includes(q) ||
        p.token1.symbol.toLowerCase().includes(q) ||
        p.token0.name?.toLowerCase().includes(q) ||
        p.token1.name?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = parseFloat((a as any)[poolSort]) || 0
      const bv = parseFloat((b as any)[poolSort]) || 0
      return poolSortDir === 'desc' ? bv - av : av - bv
    })

  const filteredTokens = tokens.filter(t => {
    if (!tokenSearch) return true
    const q = tokenSearch.toLowerCase()
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
  })

  const toggleSort = (key: SortKey) => {
    if (poolSort === key) setPoolSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setPoolSort(key); setPoolSortDir('desc') }
  }

  const sortArrow = (key: SortKey) => {
    if (poolSort !== key) return ''
    return poolSortDir === 'desc' ? ' \u2193' : ' \u2191'
  }

  const handleCopy = (text: string) => {
    copyToClipboard(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 1500)
  }

  const totalTVL = pools.reduce((s, p) => s + parseFloat(p.totalValueLockedUSD || '0'), 0)
  const totalVol = pools.reduce((s, p) => s + parseFloat(p.volumeUSD || '0'), 0)

  const chartData = [...poolHistory].reverse().map(d => ({
    date: d.date,
    volume: parseFloat(d.volumeUSD) || 0,
    tvl: parseFloat(d.tvlUSD) || 0,
    fees: parseFloat(d.feesUSD) || 0,
  }))

  const activeChain = CHAINS.find(c => c.key === chain)!

  // ── Chain Dropdown ─────────────────────────────────────

  const ChainDropdown = () => (
    <div className="relative" ref={chainRef}>
      <button
        onClick={() => setChainOpen(!chainOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-uni-card border border-uni-border hover:border-slate-500 transition-colors"
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: activeChain.color }} />
        <span className="text-sm font-medium text-white">{activeChain.label}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${chainOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {chainOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-uni-card border border-uni-border rounded-xl shadow-xl shadow-black/40 overflow-hidden z-50">
          {CHAINS.map(c => (
            <button
              key={c.key}
              onClick={() => { setChain(c.key); setChainOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                chain === c.key
                  ? 'bg-white/5 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="font-medium">{c.label}</span>
              {chain === c.key && (
                <svg className="w-4 h-4 ml-auto text-uni-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ── Pool Detail View ───────────────────────────────────

  if (selectedPool) {
    const p = selectedPool
    return (
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <button onClick={() => setSelectedPool(null)}
          className="btn btn-ghost text-sm mb-4 inline-flex items-center gap-2">
          ← Back to pools
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {p.token0.symbol} / {p.token1.symbol}
              </h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${feeTierColor(p.feeTier)}`}>
                {feePct(p.feeTier)}
              </span>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-white/5 text-slate-400 capitalize">
                {chain}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-400 font-mono">{fmtAddr(p.id)}</span>
              <button onClick={() => handleCopy(p.id)}
                className="text-xs text-slate-500 hover:text-uni-pink transition-colors">
                {copied === p.id ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={poolDays} onChange={e => setPoolDays(parseInt(e.target.value))}
              className="text-sm">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            <button onClick={refreshPoolDetail} disabled={loadingDetail}
              className="btn btn-ghost text-sm">
              {loadingDetail ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">TVL</div>
            <div className="text-xl font-bold text-white">{fmt(p.totalValueLockedUSD)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Volume</div>
            <div className="text-xl font-bold text-white">{fmt(p.volumeUSD)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Transactions</div>
            <div className="text-xl font-bold text-white">{fmtNum(p.txCount)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              {p.token0.symbol} Price
            </div>
            <div className="text-xl font-bold text-white">
              {parseFloat(p.token0Price) > 1000
                ? fmt(p.token0Price, 0)
                : parseFloat(p.token0Price) < 0.001
                  ? parseFloat(p.token0Price).toExponential(3)
                  : `$${parseFloat(p.token0Price).toFixed(4)}`
              }
            </div>
          </div>
        </div>

        {/* Detail Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {(['charts', 'swaps', 'info'] as PoolDetailTab[]).map(t => (
            <button key={t} onClick={() => setPoolDetailTab(t)}
              className={`tab ${poolDetailTab === t ? 'tab-active' : 'tab-inactive'}`}>
              {t === 'charts' ? 'Charts' : t === 'swaps' ? `Swaps (${poolSwaps.length})` : 'Info'}
            </button>
          ))}
        </div>

        {/* Charts Tab */}
        {poolDetailTab === 'charts' && (
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              {(['volume', 'tvl', 'fees'] as PoolChartTab[]).map(t => (
                <button key={t} onClick={() => setPoolChartTab(t)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    poolChartTab === t
                      ? 'bg-uni-pink/20 text-uni-pink'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}>
                  {t === 'volume' ? 'Volume' : t === 'tvl' ? 'TVL' : 'Fees'}
                </button>
              ))}
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <div className="w-5 h-5 border-2 border-uni-pink border-t-transparent rounded-full animate-spin mr-2" />
                Loading chart data...
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-center py-16 text-slate-500">No chart data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                {poolChartTab === 'tvl' ? (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={d => new Date(d * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => fmt(v, 0)} />
                    <Tooltip
                      contentStyle={{ background: '#131a2a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={d => new Date(Number(d) * 1000).toLocaleDateString()}
                      formatter={(v: number) => [fmt(v), 'TVL']} />
                    <defs>
                      <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7B61FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="tvl" stroke="#7B61FF" fill="url(#tvlGrad)" strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={d => new Date(d * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => fmt(v, 0)} />
                    <Tooltip
                      contentStyle={{ background: '#131a2a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={d => new Date(Number(d) * 1000).toLocaleDateString()}
                      formatter={(v: number) => [fmt(v), poolChartTab === 'volume' ? 'Volume' : 'Fees']} />
                    <Bar dataKey={poolChartTab === 'volume' ? 'volume' : 'fees'}
                      fill={poolChartTab === 'volume' ? '#FC72FF' : '#22c55e'}
                      radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Swaps Tab */}
        {poolDetailTab === 'swaps' && (
          <div className="card overflow-x-auto">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <div className="w-5 h-5 border-2 border-uni-pink border-t-transparent rounded-full animate-spin mr-2" />
                Loading swaps...
              </div>
            ) : poolSwaps.length === 0 ? (
              <div className="text-center py-16 text-slate-500">No swaps found for this pool</div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>{p.token0.symbol}</th>
                      <th>{p.token1.symbol}</th>
                      <th>USD Value</th>
                      <th>Sender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolSwaps.map((s, i) => (
                      <tr key={s.id || i}>
                        <td className="text-xs text-slate-400 whitespace-nowrap">
                          {s.timestamp ? fmtTimeShort(s.timestamp) : '-'}
                          <div className="text-[10px] text-slate-600">{s.timestamp ? fmtTime(s.timestamp) : ''}</div>
                        </td>
                        <td className={`font-mono text-sm ${parseFloat(s.amount0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {parseFloat(s.amount0) < 0 ? '' : '+'}{parseFloat(s.amount0).toFixed(4)}
                        </td>
                        <td className={`font-mono text-sm ${parseFloat(s.amount1) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {parseFloat(s.amount1) < 0 ? '' : '+'}{parseFloat(s.amount1).toFixed(4)}
                        </td>
                        <td className="text-white font-medium">{s.amountUSD ? fmt(s.amountUSD) : '-'}</td>
                        <td>
                          <span className="font-mono text-xs text-slate-500 cursor-pointer hover:text-uni-pink"
                            onClick={() => handleCopy(s.sender)}>
                            {copied === s.sender ? 'Copied!' : fmtAddr(s.sender)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 text-xs text-slate-500 border-t border-uni-border">
                  {poolSwaps.length} swaps | {poolDays} days | {chain}
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Tab */}
        {poolDetailTab === 'info' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Pool Details</h3>
              <div className="space-y-3">
                <InfoRow label="Pool Address" value={p.id} copyable onCopy={handleCopy} copied={copied} />
                <InfoRow label="Fee Tier" value={feePct(p.feeTier)} />
                <InfoRow label="Chain" value={chain.charAt(0).toUpperCase() + chain.slice(1)} />
                <InfoRow label="Total Txns" value={fmtNum(p.txCount)} />
              </div>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Token 0 — {p.token0.symbol}</h3>
              <div className="space-y-3">
                <InfoRow label="Name" value={p.token0.name || p.token0.symbol} />
                <InfoRow label="Symbol" value={p.token0.symbol} />
                {p.token0.id && <InfoRow label="Address" value={p.token0.id} copyable onCopy={handleCopy} copied={copied} />}
                <InfoRow label={`Price (in ${p.token1.symbol})`} value={parseFloat(p.token0Price).toFixed(6)} />
              </div>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Token 1 — {p.token1.symbol}</h3>
              <div className="space-y-3">
                <InfoRow label="Name" value={p.token1.name || p.token1.symbol} />
                <InfoRow label="Symbol" value={p.token1.symbol} />
                {p.token1.id && <InfoRow label="Address" value={p.token1.id} copyable onCopy={handleCopy} copied={copied} />}
                <InfoRow label={`Price (in ${p.token0.symbol})`} value={parseFloat(p.token1Price).toFixed(6)} />
              </div>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Data Sources</h3>
              <div className="space-y-3">
                <InfoRow label="Current Source" value={source} />
                <InfoRow label="History Days" value={`${poolDays}`} />
                <InfoRow label="Swaps Loaded" value={`${poolSwaps.length}`} />
                <InfoRow label="Chart Points" value={`${chartData.length}`} />
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  // ── Main View ──────────────────────────────────────────

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Uniswap V3</h1>
          <p className="text-sm text-slate-400 mt-0.5">Multi-chain pool explorer</p>
        </div>
        <div className="flex items-center gap-3">
          <ChainDropdown />
        </div>
      </header>

      {/* Backend Status Banner */}
      {backendOk === false && (
        <div className="card p-4 mb-4 border-amber-500/40 text-amber-400 text-sm flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span>Backend offline at <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{API_URL}</code> — run <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">m uniswap/serve</code> to start</span>
        </div>
      )}

      {/* Stats Bar */}
      {view === 'pools' && pools.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Total TVL</div>
            <div className="text-lg sm:text-xl font-bold text-white mt-0.5">{fmt(totalTVL)}</div>
          </div>
          <div className="card p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Total Volume</div>
            <div className="text-lg sm:text-xl font-bold text-white mt-0.5">{fmt(totalVol)}</div>
          </div>
          <div className="card p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Pools Loaded</div>
            <div className="text-lg sm:text-xl font-bold text-white mt-0.5">{pools.length}</div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-2 mb-4">
        {(['pools', 'tokens', 'explore'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`tab ${view === v ? 'tab-active' : 'tab-inactive'}`}>
            {v === 'pools' ? 'Pools' : v === 'tokens' ? 'Tokens' : 'Explorer'}
          </button>
        ))}
        <div className="flex-1" />
        <select value={source} onChange={e => setSource(e.target.value)}
          className="text-xs">
          <option value="auto">Auto</option>
          <option value="hypersync">HyperSync</option>
          <option value="graph">The Graph</option>
          <option value="rpc">RPC</option>
        </select>
        {view !== 'explore' && (
          <button onClick={() => view === 'pools' ? fetchPools(true) : fetchTokens(true)}
            disabled={loading} className="btn btn-ghost text-xs">
            {loading ? '...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 mb-4 border-red-500/40 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400 ml-4 shrink-0">✕</button>
        </div>
      )}

      {/* ── Pools View ───────────────────────────────────── */}
      {view === 'pools' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={poolSearch}
                onChange={e => setPoolSearch(e.target.value)}
                placeholder="Search pools by token..."
                className="w-full bg-uni-card border border-uni-border rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-uni-pink placeholder:text-slate-500"
              />
              {poolSearch && (
                <button onClick={() => setPoolSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                  ✕
                </button>
              )}
            </div>
            <select value={poolLimit} onChange={e => setPoolLimit(parseInt(e.target.value))}
              className="text-xs">
              <option value={25}>25 pools</option>
              <option value={50}>50 pools</option>
              <option value={100}>100 pools</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="w-5 h-5 border-2 border-uni-pink border-t-transparent rounded-full animate-spin mr-2" />
              Loading pools on {chain}...
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="w-8 text-center">#</th>
                    <th>Pool</th>
                    <th className="cursor-pointer select-none hover:text-uni-pink"
                      onClick={() => toggleSort('feeTier')}>Fee{sortArrow('feeTier')}</th>
                    <th className="cursor-pointer select-none hover:text-uni-pink"
                      onClick={() => toggleSort('totalValueLockedUSD')}>TVL{sortArrow('totalValueLockedUSD')}</th>
                    <th className="cursor-pointer select-none hover:text-uni-pink"
                      onClick={() => toggleSort('volumeUSD')}>Volume{sortArrow('volumeUSD')}</th>
                    <th className="cursor-pointer select-none hover:text-uni-pink"
                      onClick={() => toggleSort('txCount')}>Txns{sortArrow('txCount')}</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPools.map((p, i) => (
                    <tr key={p.id} className="cursor-pointer group" onClick={() => openPool(p)}>
                      <td className="text-center text-xs text-slate-500">{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white group-hover:text-uni-pink transition-colors">
                            {p.token0.symbol}/{p.token1.symbol}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{fmtAddr(p.id)}</div>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${feeTierColor(p.feeTier)}`}>
                          {feePct(p.feeTier)}
                        </span>
                      </td>
                      <td className="text-white">{fmt(p.totalValueLockedUSD)}</td>
                      <td>{fmt(p.volumeUSD)}</td>
                      <td className="text-slate-400">{fmtNum(p.txCount)}</td>
                      <td className="text-xs text-slate-400">
                        {parseFloat(p.token0Price) > 1000
                          ? fmt(p.token0Price, 0)
                          : `$${parseFloat(p.token0Price).toFixed(4)}`
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedPools.length === 0 && pools.length > 0 && (
                <div className="text-center py-8 text-slate-500">No pools match &quot;{poolSearch}&quot;</div>
              )}
              {pools.length === 0 && !loading && (
                <div className="text-center py-8 text-slate-500">
                  No pools found on {chain}
                  {backendOk === false && <div className="text-xs mt-1 text-slate-600">Backend is offline</div>}
                </div>
              )}
              {sortedPools.length > 0 && (
                <div className="p-3 text-xs text-slate-500 border-t border-uni-border flex items-center justify-between">
                  <span>Showing {sortedPools.length} of {pools.length} pools</span>
                  <span>Click any pool to view details</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Tokens View ──────────────────────────────────── */}
      {view === 'tokens' && (
        <>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <input
                type="text"
                value={tokenSearch}
                onChange={e => setTokenSearch(e.target.value)}
                placeholder="Search tokens..."
                className="w-full bg-uni-card border border-uni-border rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-uni-pink placeholder:text-slate-500"
              />
              {tokenSearch && (
                <button onClick={() => setTokenSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                  ✕
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="w-5 h-5 border-2 border-uni-pink border-t-transparent rounded-full animate-spin mr-2" />
              Loading tokens...
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="w-8 text-center">#</th>
                    <th>Token</th>
                    <th>Symbol</th>
                    <th>TVL</th>
                    <th>Volume</th>
                    <th>Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokens.map((t, i) => (
                    <tr key={t.id}>
                      <td className="text-center text-xs text-slate-500">{i + 1}</td>
                      <td>
                        <span className="text-white font-medium">{t.name}</span>
                        <div className="text-[11px] text-slate-500 font-mono cursor-pointer hover:text-uni-pink"
                          onClick={() => handleCopy(t.id)}>
                          {copied === t.id ? 'Copied!' : fmtAddr(t.id)}
                        </div>
                      </td>
                      <td><span className="text-uni-pink font-medium">{t.symbol}</span></td>
                      <td className="text-white">{fmt(t.totalValueLockedUSD)}</td>
                      <td>{fmt(t.volumeUSD)}</td>
                      <td className="text-slate-400">{fmtNum(t.txCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTokens.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  {tokenSearch ? `No tokens match "${tokenSearch}"` : `No tokens found on ${chain}`}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Explorer View ────────────────────────────────── */}
      {view === 'explore' && (
        <div>
          <div className="card p-5 mb-4">
            <h3 className="text-sm font-medium text-white mb-3">Block Scanner</h3>
            <p className="text-xs text-slate-400 mb-4">
              Scan recent blocks to discover all active pools and token prices. Uses direct RPC — no API keys needed.
            </p>
            <div className="flex items-center gap-3">
              <select value={exploreBlocks} onChange={e => setExploreBlocks(parseInt(e.target.value))}
                className="text-sm">
                <option value={1000}>1,000 blocks</option>
                <option value={5000}>5,000 blocks</option>
                <option value={10000}>10,000 blocks</option>
                <option value={25000}>25,000 blocks</option>
                <option value={50000}>50,000 blocks</option>
              </select>
              {exploring ? (
                <button onClick={stopExplore} className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm">
                  Stop
                </button>
              ) : (
                <button onClick={startExplore} className="btn btn-primary text-sm">
                  Start Scan
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {exploreProgress && exploreProgress.status !== 'done' && (
            <div className="card p-4 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 border-2 border-uni-pink border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-300">
                  {exploreProgress.status || 'Scanning...'}
                </span>
              </div>
              {exploreProgress.blocks_scanned !== undefined && exploreProgress.total_blocks !== undefined && (
                <>
                  <div className="w-full bg-uni-border rounded-full h-2 mb-2">
                    <div className="bg-uni-pink h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (exploreProgress.blocks_scanned / exploreProgress.total_blocks) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{exploreProgress.blocks_scanned?.toLocaleString()} / {exploreProgress.total_blocks?.toLocaleString()} blocks</span>
                    <span>{exploreProgress.pools_found || 0} pools | {exploreProgress.tokens_found || 0} tokens</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results */}
          {exploreResult && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="card p-3">
                  <div className="text-[10px] text-slate-400 uppercase">Pools Found</div>
                  <div className="text-lg font-bold text-white">{exploreResult.pools?.length || 0}</div>
                </div>
                <div className="card p-3">
                  <div className="text-[10px] text-slate-400 uppercase">Tokens Found</div>
                  <div className="text-lg font-bold text-white">{exploreResult.tokens?.length || 0}</div>
                </div>
                <div className="card p-3">
                  <div className="text-[10px] text-slate-400 uppercase">Chain</div>
                  <div className="text-lg font-bold text-white capitalize">{chain}</div>
                </div>
                <div className="card p-3">
                  <div className="text-[10px] text-slate-400 uppercase">Blocks Scanned</div>
                  <div className="text-lg font-bold text-white">{exploreBlocks.toLocaleString()}</div>
                </div>
              </div>

              {exploreResult.tokens?.length > 0 && (
                <div className="card overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Token</th>
                        <th>Price</th>
                        <th>Volume</th>
                        <th>Swaps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exploreResult.tokens.slice(0, 100).map((t: any, i: number) => (
                        <tr key={t.address || i}>
                          <td className="text-xs text-slate-500">{i + 1}</td>
                          <td>
                            <span className="text-white font-medium">{t.symbol || 'Unknown'}</span>
                            <div className="text-[11px] text-slate-500 font-mono">{fmtAddr(t.address || '')}</div>
                          </td>
                          <td className="text-white font-medium">
                            {t.price_usd ? fmt(t.price_usd) : '-'}
                          </td>
                          <td>{t.total_volume_usd ? fmt(t.total_volume_usd) : '-'}</td>
                          <td className="text-slate-400">{t.total_swaps?.toLocaleString() || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!exploring && !exploreResult && (
            <div className="card p-8 text-center text-slate-500">
              Click &quot;Start Scan&quot; to discover pools and tokens from recent blocks
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-600">
        Uniswap V3 | {chain} | Source: {source} | The Graph + HyperSync + RPC
      </footer>
    </main>
  )
}

// ── Info Row Component ───────────────────────────────────

function InfoRow({ label, value, copyable, onCopy, copied }: {
  label: string
  value: string
  copyable?: boolean
  onCopy?: (v: string) => void
  copied?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className={`text-sm text-right ${copyable ? 'font-mono text-xs' : 'text-white'}`}>
        {copyable ? (
          <button onClick={() => onCopy?.(value)}
            className="text-slate-300 hover:text-uni-pink transition-colors text-right">
            {copied === value ? 'Copied!' : fmtAddr(value)}
          </button>
        ) : value}
      </span>
    </div>
  )
}
