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
    <div className="min-h-screen p-6" style={{ fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Transactions</h1>

          {/* My Txs Toggle */}
          <button
            onClick={() => setShowMyTxs(!showMyTxs)}
            className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-bold text-sm"
            style={{
              backgroundColor: showMyTxs ? 'var(--bg-surface)' : 'transparent',
              borderColor: showMyTxs ? 'var(--border-strong)' : 'var(--border-color)',
              color: showMyTxs ? 'var(--text-accent)' : 'var(--text-secondary)',
            }}
          >
            <span className={showMyTxs ? 'text-cyan-500' : ''}>👤</span>
            <span>{showMyTxs ? 'My Txs' : 'All Txs'}</span>
          </button>
        </div>

        {/* Search & Filters - Always Visible */}
        <div className="border-2 rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
          {/* Search Bar */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by function, hash, owner..."
            className="w-full px-4 py-3 text-base border-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />

          {/* Filter Buttons & Stats */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {(['all', 'pending', 'complete'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-4 py-2 text-sm font-bold uppercase rounded-lg transition-all border-2"
                  style={{
                    backgroundColor: statusFilter === s ? 'var(--bg-input)' : 'transparent',
                    borderColor: statusFilter === s ? 'var(--border-strong)' : 'var(--border-color)',
                    color: statusFilter === s ? 'var(--text-accent)' : 'var(--text-secondary)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* 24h Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>24H</span>
                <span className="font-mono font-bold text-amber-400 tabular-nums">${totalCost24h.toFixed(2)}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>({count24h})</span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500/30 border-t-purple-500" />
              <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>Loading transactions...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border-2 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-3">
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
