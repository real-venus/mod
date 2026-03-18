"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { userContext } from '@/context/UserContext';
import { timeAgo, text2color } from '@/utils';
import { CopyButton } from '@/ui/CopyButton';

export default function TransactionsPage() {
  const { client, user } = userContext();
  const searchParams = useSearchParams();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'complete'>('all');
  const [showMyTxs, setShowMyTxs] = useState(true);
  const [expandedTxIdx, setExpandedTxIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchTxs = async () => {
      if (!client) return;
      setLoading(true);
      try {
        const result = await client.call('txs', { df: 0, n: 1000, page: 0 });
        const txs = Array.isArray(result) ? result : [];
        setTxs(txs);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchTxs();
  }, [client]);

  const filtered = txs.filter(tx => {
    if (showMyTxs && user?.key) {
      if (tx.key !== user.key && tx.owner !== user.key && tx.client !== user.key) return false;
    }
    if (statusFilter !== 'all') {
      const hasCompleted = tx.result !== undefined && tx.result !== null;
      if (statusFilter === 'complete') {
        if (!(hasCompleted || tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete')) return false;
      } else if (statusFilter === 'pending') {
        if (hasCompleted || !(tx.status === 'pending' || tx.status === 'running')) return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (tx.fn && tx.fn.toLowerCase().includes(q)) ||
        (tx.hash && tx.hash.toLowerCase().includes(q)) ||
        (tx.owner && tx.owner.toLowerCase().includes(q)) ||
        (tx.client && tx.client.toLowerCase().includes(q)) ||
        (tx.method && tx.method.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCost24h = filtered.reduce((acc, tx) => {
    const now = Date.now() / 1000;
    if (parseInt(tx.time) >= now - 86400 && tx.cost) return acc + parseFloat(tx.cost);
    return acc;
  }, 0);

  const count24h = filtered.filter(tx => parseInt(tx.time) >= Date.now() / 1000 - 86400).length;

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-gray-500 text-xs">null</span>;
    if (typeof value === 'object') {
      const json = JSON.stringify(value, null, 2);
      return (
        <pre className="text-xs font-mono leading-relaxed p-3 overflow-x-auto rounded-sm" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: 'var(--text-secondary)' }}>
          {json}
        </pre>
      );
    }
    return <span className="text-green-400 text-xs font-mono break-all">{String(value)}</span>;
  };

  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-base">{'>'}</span>
            <h1 className="text-lg font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-primary)' }}>TXS</h1>
            <div className="flex gap-1 ml-3">
              {(['all', 'pending', 'complete'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all rounded-sm"
                  style={{
                    backgroundColor: statusFilter === s ? 'rgba(16,185,129,0.15)' : 'transparent',
                    border: statusFilter === s ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-color)',
                    color: statusFilter === s ? 'rgb(52,211,153)' : 'var(--text-tertiary)',
                  }}
                >
                  {s === 'all' ? 'ALL' : s === 'pending' ? 'PND' : 'OK'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              24h <span className="text-amber-400">${totalCost24h.toFixed(2)}</span> ({count24h})
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>{filtered.length}tx</span>
            <button
              onClick={() => setShowMyTxs(!showMyTxs)}
              className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all rounded-sm"
              style={{
                backgroundColor: showMyTxs ? 'rgba(168,85,247,0.15)' : 'transparent',
                border: showMyTxs ? '1px solid rgba(168,85,247,0.4)' : '1px solid var(--border-color)',
                color: showMyTxs ? 'rgb(192,132,252)' : 'var(--text-tertiary)',
              }}
            >
              {showMyTxs ? 'MINE' : 'ALL'}
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search..."
          className="w-full px-3 py-2 text-sm font-bold tracking-wider focus:outline-none rounded-sm"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />

        {/* Transaction rows */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-sm font-bold text-green-400 animate-pulse tracking-[0.3em]">loading...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>no transactions</div>
          </div>
        ) : (
          <div className="border rounded-sm" style={{ borderColor: 'var(--border-color)' }}>
            {/* Table header */}
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
              <span className="w-5">ST</span>
              <span className="flex-1 min-w-0">FUNCTION</span>
              <span className="w-24 hidden md:block">CLIENT</span>
              <span className="w-24 hidden md:block">SERVER</span>
              <span className="w-16 text-right">COST</span>
              <span className="w-14 text-right">TIME</span>
              <span className="w-20 text-right">AGO</span>
            </div>

            {filtered.map((tx, idx) => {
              const hasCompleted = tx.result !== undefined && tx.result !== null;
              const isInProgress = (tx.status === 'running' || tx.status === 'pending') && !hasCompleted;
              const isOk = hasCompleted || tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete';
              const isErr = tx.status === 'error' || tx.status === 'failed';
              const fnColor = text2color(tx.fn || tx.key);
              const timestamp = parseInt(tx.time);
              const time = isNaN(timestamp) ? tx.time : timeAgo(timestamp * 1000);
              const cost = tx.cost?.toFixed(2) || '0.00';
              const isExpanded = expandedTxIdx === idx;
              const hasParams = tx.params !== null && tx.params !== undefined;
              const hasResults = tx.result !== undefined;

              return (
                <div key={tx.cid || tx.hash || idx}>
                  <div
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:brightness-110"
                    onClick={() => setExpandedTxIdx(isExpanded ? null : idx)}
                    style={{
                      backgroundColor: isExpanded ? 'rgba(16,185,129,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: isInProgress ? '3px solid rgba(59,130,246,0.6)' : isErr ? '3px solid rgba(239,68,68,0.5)' : '3px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    {/* Status icon */}
                    <span className={`w-5 text-sm font-bold ${isInProgress ? 'text-blue-400 animate-pulse' : isErr ? 'text-red-400' : 'text-emerald-500'}`}>
                      {isInProgress ? '~' : isErr ? 'x' : '.'}
                    </span>

                    {/* Function name */}
                    <span className="flex-1 text-sm font-bold truncate min-w-0" style={{ color: fnColor }}>
                      {tx.fn}
                    </span>

                    {/* Client */}
                    <span className="w-24 hidden md:block text-xs font-mono tabular-nums truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {tx.client ? shortAddr(tx.client) : <span className="opacity-30">-</span>}
                    </span>

                    {/* Server / Owner */}
                    <span className="w-24 hidden md:block text-xs font-mono tabular-nums truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {tx.owner ? shortAddr(tx.owner) : tx.key ? shortAddr(tx.key) : <span className="opacity-30">-</span>}
                    </span>

                    {/* Cost */}
                    <span className="w-16 text-right text-xs font-bold text-amber-400 tabular-nums">
                      ${cost}
                    </span>

                    {/* Duration */}
                    <span className="w-14 text-right text-xs font-bold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                      {tx.delta !== undefined ? `${tx.delta.toFixed(1)}s` : '-'}
                    </span>

                    {/* Time ago */}
                    <span className="w-20 text-right text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                      {time}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-3 space-y-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {tx.client && (
                          <span className="flex items-center gap-1">
                            <span className="text-blue-400">client</span>
                            <CopyButton text={tx.client} size="sm" showValueOnHover={true} />
                          </span>
                        )}
                        {tx.key && (
                          <span className="flex items-center gap-1">
                            <span className="text-purple-400">key</span>
                            <CopyButton text={tx.key} size="sm" showValueOnHover={true} />
                          </span>
                        )}
                        {tx.owner && (
                          <span className="flex items-center gap-1">
                            <span className="text-amber-400">server</span>
                            <CopyButton text={tx.owner} size="sm" showValueOnHover={true} />
                          </span>
                        )}
                        {(tx.hash || tx.cid) && (
                          <span className="flex items-center gap-1">
                            <span className="text-cyan-400">id</span>
                            <CopyButton text={tx.hash || tx.cid || ''} size="sm" showValueOnHover={true} />
                          </span>
                        )}
                      </div>
                      {/* Params */}
                      {hasParams && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">params</div>
                          {renderValue(tx.params)}
                        </div>
                      )}
                      {/* Result */}
                      {hasResults && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">result</div>
                          {renderValue(tx.result)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
