"use client";

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'react-toastify'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/openhouse/api'

interface StatusData {
  shareholders: number
  total_shares: number
  shares_sold: number
  available_shares: number
  total_contributed: number
  total_dividends_distributed: number
  dividend_count: number
  contract: string
  is_active: boolean
}

interface Shareholder {
  address: string
  shares: number
  contribution: number
  ownership_pct: number
  dividends_claimed: number
  joined: number
}

interface PropertyData {
  description: string
  total_shares: number
  share_price: string
  available_shares: number
  is_active: boolean
  status: string
  contract: string
}

interface DividendRecord {
  timestamp: number
  total_amount: number
  per_share: number
  recipients: number
}

async function api(path: string, opts?: { method?: string; body?: any }) {
  const res = await fetch(`${API_URL}/${path}`, {
    method: opts?.method || 'GET',
    headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.error || 'Request failed')
  }
  return res.json()
}

function formatAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || '--'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatNum(n: number, decimals = 2) {
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function timeAgo(ts: number) {
  if (!ts) return '--'
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type Tab = 'overview' | 'shareholders' | 'dividends'

function OpenHousePageInner() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [property, setProperty] = useState<PropertyData | null>(null)
  const [shareholders, setShareholders] = useState<Shareholder[]>([])
  const [dividends, setDividends] = useState<DividendRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  // Purchase form
  const [buyAddr, setBuyAddr] = useState('')
  const [buyShares, setBuyShares] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p, sh, d] = await Promise.all([
        api('status').catch(() => null),
        api('property').catch(() => null),
        api('shareholders').catch(() => []),
        api('dividends').catch(() => []),
      ])
      if (s) setStatus(s)
      if (p) setProperty(p)
      setShareholders(Array.isArray(sh) ? sh : [])
      setDividends(Array.isArray(d) ? d : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handlePurchase = async () => {
    if (!buyAddr.trim() || !buyShares.trim()) {
      toast.error('Address and share count required')
      return
    }
    setPurchasing(true)
    try {
      const result = await api('purchase', {
        method: 'POST',
        body: { buyer: buyAddr.trim(), share_count: parseInt(buyShares), payment: 0 },
      })
      if (result.success) {
        toast.success(`Purchased ${result.shares_purchased} shares`)
        setBuyAddr('')
        setBuyShares('')
        fetchAll()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Purchase failed')
    }
    setPurchasing(false)
  }

  const soldPct = status && status.total_shares > 0
    ? (status.shares_sold / status.total_shares) * 100
    : 0

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'shareholders', label: `Shareholders${status ? ` (${status.shareholders})` : ''}` },
    { key: 'dividends', label: `Dividends${dividends.length ? ` (${dividends.length})` : ''}` },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e5e5e5] font-mono">
      <div className="relative z-10 p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between border border-white/10 rounded-lg p-4 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-lg">
              OH
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider uppercase">OPENHOUSE</h1>
              <p className="text-xs text-white/40 uppercase tracking-wider">Collective Asset Ownership</p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-white/50 hover:bg-white/10 hover:text-white/70 disabled:opacity-30 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Stats grid */}
        {status && (
          <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
            {/* Share progress */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Shares sold</span>
                <span className="text-xs font-bold text-emerald-400">{soldPct.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
                  style={{ width: `${Math.max(soldPct, 0.5)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-white/25">{formatNum(status.shares_sold)} sold</span>
                <span className="text-[10px] text-white/25">{formatNum(status.total_shares)} total</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 border-t border-white/[0.06]">
              <div className="p-4 text-center border-r border-b md:border-b-0 border-white/[0.06]">
                <p className="text-lg font-bold text-white/90 tabular-nums">{status.shareholders}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Shareholders</p>
              </div>
              <div className="p-4 text-center border-b md:border-b-0 md:border-r border-white/[0.06]">
                <p className="text-lg font-bold text-amber-400 tabular-nums">{formatNum(status.available_shares)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Available</p>
              </div>
              <div className="p-4 text-center border-r border-white/[0.06]">
                <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatNum(status.total_contributed)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Contributed</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-lg font-bold text-violet-400 tabular-nums">{formatNum(status.total_dividends_distributed)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Dividends</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t.key
                  ? 'bg-white/10 text-white/80'
                  : 'bg-white/[0.02] text-white/30 hover:text-white/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && property && (
          <div className="space-y-4">
            {/* Property info */}
            <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5 space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Property Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Description</p>
                  <p className="text-sm text-white/70 mt-0.5">{property.description || 'No description'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Status</p>
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
                    property.is_active
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                      : 'text-red-400 border-red-500/30 bg-red-500/10'
                  }`}>
                    {property.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Share Price</p>
                  <p className="text-sm font-bold text-amber-400 mt-0.5">{property.share_price} ETH</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Contract</p>
                  <p className="text-xs text-white/50 font-mono mt-0.5">{property.contract || 'Not deployed'}</p>
                </div>
              </div>
            </div>

            {/* Purchase form */}
            <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5 space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Purchase Shares</h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Buyer address (0x...)"
                  value={buyAddr}
                  onChange={e => setBuyAddr(e.target.value)}
                  className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                />
                <input
                  type="number"
                  placeholder="Shares"
                  value={buyShares}
                  onChange={e => setBuyShares(e.target.value)}
                  min="1"
                  className="w-28 text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                />
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || !buyAddr.trim() || !buyShares.trim()}
                  className="px-5 py-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {purchasing ? 'Processing...' : 'Buy'}
                </button>
              </div>
              {buyShares && property && (
                <p className="text-[10px] text-white/30">
                  Cost: {(parseInt(buyShares || '0') * parseFloat(property.share_price || '0')).toFixed(4)} ETH
                </p>
              )}
            </div>
          </div>
        )}

        {/* Shareholders Tab */}
        {tab === 'shareholders' && (
          <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_100px] gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.01]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Address</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Shares</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Ownership</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Contributed</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Dividends</div>
            </div>

            {shareholders.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-xs text-white/30 uppercase tracking-wider">No shareholders yet</span>
              </div>
            ) : (
              shareholders.map(sh => (
                <div
                  key={sh.address}
                  className="grid grid-cols-[1fr_100px_100px_100px_100px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors items-center"
                >
                  <button
                    onClick={() => { navigator.clipboard.writeText(sh.address); toast.success('Address copied') }}
                    className="text-xs font-mono text-white/60 hover:text-white/90 transition-colors truncate text-left"
                    title={sh.address}
                  >
                    {sh.address}
                  </button>
                  <span className="text-xs font-bold text-amber-400/80 text-right">{formatNum(sh.shares, 0)}</span>
                  <span className="text-xs text-white/50 text-right">{sh.ownership_pct}%</span>
                  <span className="text-xs text-white/50 text-right">{formatNum(sh.contribution)}</span>
                  <span className="text-xs text-violet-400/70 text-right">{formatNum(sh.dividends_claimed)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Dividends Tab */}
        {tab === 'dividends' && (
          <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_100px] gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.01]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Date</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Total</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Per Share</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Recipients</div>
            </div>

            {dividends.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-xs text-white/30 uppercase tracking-wider">No dividends distributed yet</span>
              </div>
            ) : (
              [...dividends].reverse().map((d, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_120px_100px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors items-center"
                >
                  <span className="text-xs text-white/50">{timeAgo(d.timestamp)}</span>
                  <span className="text-xs font-bold text-emerald-400/80 text-right">{formatNum(d.total_amount)}</span>
                  <span className="text-xs text-white/50 text-right">{formatNum(d.per_share, 6)}</span>
                  <span className="text-xs text-white/40 text-right">{d.recipients}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-white/15 uppercase tracking-wider py-4">
          OpenHouse Module
        </div>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(OpenHousePageInner), { ssr: false })
