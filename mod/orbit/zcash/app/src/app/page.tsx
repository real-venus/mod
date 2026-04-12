'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8930'

type Info = {
  blocks?: number; transactions?: number; difficulty?: number; hashrate?: string
  market_price_usd?: number; market_cap_usd?: number; circulation?: number
  mempool_transactions?: number; mempool_size?: number
  best_block_height?: number; best_block_hash?: string
}

type Block = {
  height?: number; hash?: string; time?: string; size?: number
  transaction_count?: number; input_total?: number; output_total?: number; difficulty?: number
}

type Tx = {
  hash?: string; block_id?: number; time?: string; size?: number; fee?: number
  input_total?: number; output_total?: number; input_count?: number; output_count?: number
  is_coinbase?: boolean; has_shielded?: boolean
}

type Address = {
  address?: string; balance?: number; received?: number; spent?: number
  transaction_count?: number; first_seen?: string; last_seen?: string
}

type SearchResult = { type?: string; result?: any; error?: string }

async function api(path: string) {
  const res = await fetch(`/api${path}`)
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try { detail = JSON.parse(text).detail || text } catch {}
    throw new Error(detail)
  }
  return res.json()
}

function formatZEC(zatoshi: number | undefined) {
  if (zatoshi == null) return '\u2014'
  return (zatoshi / 100_000_000).toFixed(4) + ' ZEC'
}

function formatNum(n: number | undefined) {
  if (n == null) return '\u2014'
  return n.toLocaleString()
}

function timeAgo(t: string | undefined) {
  if (!t) return '\u2014'
  const diff = Date.now() - new Date(t).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Components ──

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent ? '#f4b728' : '#eee' }}>{value}</div>
    </div>
  )
}

function BlockDetail({ block, onHashClick }: { block: Block; onHashClick?: (h: string) => void }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.badge}>Block</span>
        <span style={styles.cardTitle}>#{formatNum(block.height)}</span>
        {block.time && <span style={styles.cardTime}>{timeAgo(block.time)}</span>}
      </div>
      <div style={styles.grid}>
        <Row label="Hash" value={block.hash || '\u2014'} mono />
        <Row label="Time" value={block.time || '\u2014'} />
        <Row label="Transactions" value={formatNum(block.transaction_count)} />
        <Row label="Size" value={block.size ? `${formatNum(block.size)} bytes` : '\u2014'} />
        <Row label="Input Total" value={formatZEC(block.input_total)} />
        <Row label="Output Total" value={formatZEC(block.output_total)} />
        <Row label="Difficulty" value={block.difficulty?.toExponential(2) || '\u2014'} />
      </div>
    </div>
  )
}

function TxDetail({ tx }: { tx: Tx }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' }}>Transaction</span>
      </div>
      <div style={styles.grid}>
        <Row label="Hash" value={tx.hash || '\u2014'} mono />
        <Row label="Block" value={tx.block_id != null ? `#${formatNum(tx.block_id)}` : '\u2014'} />
        <Row label="Time" value={tx.time || '\u2014'} />
        <Row label="Fee" value={formatZEC(tx.fee)} />
        <Row label="Input Total" value={formatZEC(tx.input_total)} />
        <Row label="Output Total" value={formatZEC(tx.output_total)} />
        <Row label="Inputs / Outputs" value={`${tx.input_count ?? '?'} / ${tx.output_count ?? '?'}`} />
        <Row label="Coinbase" value={tx.is_coinbase ? 'Yes' : 'No'} />
        <Row label="Shielded" value={tx.has_shielded ? 'Yes' : 'No'} highlight={tx.has_shielded} />
      </div>
    </div>
  )
}

function AddressDetail({ addr }: { addr: Address }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, background: '#22c55e20', color: '#4ade80', border: '1px solid #22c55e40' }}>Address</span>
      </div>
      <div style={styles.grid}>
        <Row label="Address" value={addr.address || '\u2014'} mono />
        <Row label="Balance" value={formatZEC(addr.balance)} />
        <Row label="Received" value={formatZEC(addr.received)} />
        <Row label="Spent" value={formatZEC(addr.spent)} />
        <Row label="Transactions" value={formatNum(addr.transaction_count)} />
        <Row label="First Seen" value={addr.first_seen || '\u2014'} />
        <Row label="Last Seen" value={addr.last_seen || '\u2014'} />
      </div>
    </div>
  )
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={styles.row}>
      <div style={styles.rowLabel}>{label}</div>
      <div style={{
        fontSize: 14, wordBreak: 'break-all' as const,
        ...(mono ? { fontFamily: 'monospace', fontSize: 13 } : {}),
        ...(highlight ? { color: '#f4b728' } : {}),
      }}>{value}</div>
    </div>
  )
}

// ── Main ──

export default function Home() {
  const [info, setInfo] = useState<Info>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [latestBlock, setLatestBlock] = useState<Block | null>(null)
  const [tab, setTab] = useState<'overview' | 'search'>('overview')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [apiOnline, setApiOnline] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [i, b] = await Promise.all([api('/info'), api('/block')])
      setInfo(i)
      setLatestBlock(b)
      setError('')
      setApiOnline(true)
      setLastRefresh(new Date())
    } catch (e: any) {
      setApiOnline(false)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const doSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchResult(null)
    try {
      const r = await api(`/search/${encodeURIComponent(query.trim())}`)
      setSearchResult(r)
      setTab('search')
      setError('')
    } catch (e: any) {
      setSearchResult({ error: e.message })
      setTab('search')
    } finally {
      setSearching(false)
    }
  }

  const price = info.market_price_usd ? `$${info.market_price_usd.toFixed(2)}` : '\u2014'
  const mcap = info.market_cap_usd ? `$${(info.market_cap_usd / 1e9).toFixed(2)}B` : '\u2014'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.logo}>Z</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.5 }}>Zcash Explorer</h1>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              <span style={{ color: apiOnline ? '#4ade80' : '#ef4444' }}>{apiOnline ? 'Connected' : 'Offline'}</span>
              {lastRefresh && <span> &middot; {timeAgo(lastRefresh.toISOString())}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#888', fontSize: 14 }}>ZEC <b style={{ color: '#f4b728' }}>{price}</b></span>
          <button onClick={refresh} style={styles.btn}>Refresh</button>
        </div>
      </div>

      {/* Error Banner */}
      {error && !searchResult?.error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Search */}
      <div style={{ ...styles.card, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search by block height, tx hash, or address (t1/t3/zs/zc)..."
            style={styles.input}
          />
          <button onClick={doSearch} disabled={searching} style={styles.searchBtn}>
            {searching ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['overview', 'search'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? '#f4b72815' : 'transparent',
            color: tab === t ? '#f4b728' : '#666',
            border: `1px solid ${tab === t ? '#f4b72830' : 'transparent'}`,
            padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            fontWeight: 500, textTransform: 'capitalize' as const,
          }}>{t}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <>
          {loading ? (
            <div style={{ ...styles.card, textAlign: 'center' as const, padding: 40 }}>
              <div style={{ color: '#888' }}>Loading blockchain data...</div>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <Stat label="Price" value={price} accent />
                <Stat label="Market Cap" value={mcap} />
                <Stat label="Block Height" value={formatNum(info.best_block_height)} accent />
                <Stat label="Total Transactions" value={formatNum(info.transactions)} />
                <Stat label="Difficulty" value={info.difficulty?.toExponential(2) || '\u2014'} />
                <Stat label="Hashrate (24h)" value={info.hashrate || '\u2014'} />
                <Stat label="Mempool" value={`${formatNum(info.mempool_transactions)} txs`} />
                <Stat label="Circulation" value={info.circulation ? formatZEC(info.circulation) : '\u2014'} />
              </div>

              {/* Latest Block */}
              {latestBlock && <BlockDetail block={latestBlock} />}

              {/* Block Hash */}
              {info.best_block_hash && (
                <div style={{ ...styles.card, padding: 16 }}>
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Latest Block Hash</div>
                  <code style={{ fontSize: 13, wordBreak: 'break-all' as const, color: '#f4b728', fontFamily: 'monospace' }}>{info.best_block_hash}</code>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Search Tab */}
      {tab === 'search' && (
        <>
          {searchResult ? (
            searchResult.error ? (
              <div style={styles.card}><p style={{ color: '#ef4444', margin: 0 }}>{searchResult.error}</p></div>
            ) : searchResult.type === 'block' ? (
              <BlockDetail block={searchResult.result} />
            ) : searchResult.type === 'transaction' ? (
              <TxDetail tx={searchResult.result} />
            ) : searchResult.type === 'address' ? (
              <AddressDetail addr={searchResult.result} />
            ) : (
              <div style={styles.card}><pre style={{ fontSize: 13, overflow: 'auto', margin: 0 }}>{JSON.stringify(searchResult, null, 2)}</pre></div>
            )
          ) : (
            <div style={{ ...styles.card, textAlign: 'center' as const, padding: 40 }}>
              <div style={{ color: '#666', fontSize: 14 }}>Search for a block height, transaction hash, or Zcash address</div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center' as const, padding: '32px 0 16px', color: '#333', fontSize: 12 }}>
        Powered by Mod Protocol
      </div>
    </div>
  )
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#0d0d14', border: '1px solid #1a1a2e', borderRadius: 10, padding: 20, marginBottom: 16 },
  stat: { background: '#0d0d14', border: '1px solid #1a1a2e', borderRadius: 10, padding: 16 },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: 700 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 600 },
  cardTime: { color: '#666', fontSize: 13, marginLeft: 'auto' },
  badge: { background: '#f4b72820', color: '#f4b728', border: '1px solid #f4b72840', padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0 20px' },
  row: { padding: '8px 0', borderBottom: '1px solid #111' },
  rowLabel: { color: '#666', fontSize: 12, marginBottom: 2 },
  logo: { width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #f4b728, #e8952e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#000' },
  btn: { background: '#1a1a2e', color: '#aaa', border: '1px solid #2a2a3e', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  searchBtn: { background: '#f4b728', color: '#000', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' },
  input: { background: '#0a0a12', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14, flex: 1, outline: 'none' },
  error: { background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 },
}
