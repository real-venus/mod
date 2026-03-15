"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { userContext } from '@/context/UserContext';
import { TransactionCard } from '@/chat/transactions/TransactionCard';

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
    // Filter by user
    if (showMyTxs && user?.key) {
      if (tx.key !== user.key && tx.owner !== user.key && tx.client !== user.key) {
        return false;
      }
    }

    // Filter by status
    if (statusFilter !== 'all') {
      const hasCompleted = tx.result !== undefined && tx.result !== null;
      if (statusFilter === 'complete') {
        if (!(hasCompleted || tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete')) {
          return false;
        }
      } else if (statusFilter === 'pending') {
        if (hasCompleted || !(tx.status === 'pending' || tx.status === 'running')) {
          return false;
        }
      }
    }

    // Filter by search query
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
    const twentyFourHoursAgo = now - (24 * 60 * 60);
    if (parseInt(tx.time) >= twentyFourHoursAgo && tx.cost) {
      return acc + parseFloat(tx.cost);
    }
    return acc;
  }, 0);

  const count24h = filtered.filter(tx => {
    const now = Date.now() / 1000;
    const twentyFourHoursAgo = now - (24 * 60 * 60);
    return parseInt(tx.time) >= twentyFourHoursAgo;
  }).length;

  return (
    <div className="min-h-screen p-4" style={{ fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header - 8bit style */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-cyan-400 text-lg font-bold" style={{ textShadow: '0 0 10px rgba(0,255,255,0.4)' }}>►</span>
            <h1 className="text-4xl font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-primary)', textShadow: '2px 2px 0px rgba(168,85,247,0.3)' }}>
              Transactions
            </h1>
            <div className="h-[2px] w-16" style={{ background: 'linear-gradient(to right, rgba(0,255,255,0.6), transparent)' }} />
          </div>

          {/* My Txs Toggle - pixel button */}
          <button
            onClick={() => setShowMyTxs(!showMyTxs)}
            className="flex items-center gap-2 px-4 py-2 transition-all font-bold text-[11px] uppercase tracking-[0.15em]"
            style={{
              backgroundColor: showMyTxs ? 'rgba(168,85,247,0.15)' : 'var(--bg-surface)',
              border: showMyTxs ? '3px solid rgba(168,85,247,0.5)' : '3px solid var(--border-color)',
              color: showMyTxs ? 'rgb(192,132,252)' : 'var(--text-secondary)',
              boxShadow: showMyTxs ? '0 0 10px rgba(168,85,247,0.15)' : 'none',
            }}
          >
            <span className="text-[10px]">{showMyTxs ? '◆' : '◇'}</span>
            <span>{showMyTxs ? 'MY TXS' : 'ALL TXS'}</span>
          </button>
        </div>

        {/* Search & Filters - 8bit panel */}
        <div className="p-3 space-y-3" style={{
          backgroundColor: 'var(--bg-surface)',
          border: '3px solid var(--border-strong)',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
        }}>
          {/* Search Bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-[10px] font-bold">⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="SEARCH BY FUNCTION, HASH, OWNER..."
              className="w-full pl-8 pr-4 py-2.5 text-[12px] font-bold tracking-wider transition-all focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '2px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Filter Buttons & Stats */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-1">
              {(['all', 'pending', 'complete'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all"
                  style={{
                    backgroundColor: statusFilter === s ? 'rgba(168,85,247,0.15)' : 'transparent',
                    border: statusFilter === s ? '2px solid rgba(168,85,247,0.5)' : '2px solid var(--border-color)',
                    color: statusFilter === s ? 'rgb(192,132,252)' : 'var(--text-secondary)',
                    boxShadow: statusFilter === s ? '0 0 8px rgba(168,85,247,0.1)' : 'none',
                  }}
                >
                  {s === 'all' ? '■ ALL' : s === 'pending' ? '▸ PEND' : '✓ DONE'}
                </button>
              ))}
            </div>

            {/* 24h Stats - pixel box */}
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-2 px-2 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <span className="font-bold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>24H</span>
                <span className="font-bold text-amber-400 tabular-nums" style={{ textShadow: '0 0 6px rgba(245,158,11,0.3)' }}>${totalCost24h.toFixed(2)}</span>
                <span className="font-bold" style={{ color: 'var(--text-tertiary)' }}>({count24h})</span>
              </div>
              <div className="px-2 py-1 font-bold" style={{ color: 'var(--text-secondary)', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.2)' }}>
                {filtered.length} TX{filtered.length !== 1 ? 'S' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="text-2xl font-bold text-purple-400 animate-pulse tracking-[0.3em]">▓▒░ ░▒▓</div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>Loading transactions...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{
            backgroundColor: 'var(--bg-surface)',
            border: '3px dashed var(--border-color)',
          }}>
            <div className="text-lg font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>¯\_(ツ)_/¯</div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx, idx) => (
              <div
                key={tx.cid || tx.hash || idx}
                onClick={() => setExpandedTxIdx(expandedTxIdx === idx ? null : idx)}
              >
                <TransactionCard
                  tx={tx}
                  idx={idx}
                  isExpanded={expandedTxIdx === idx}
                  compact={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
