"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { userContext } from '@/context/UserContext';
import { TransactionStats } from './stats';

export default function TransactionsPage() {
  const { client } = userContext();
  const searchParams = useSearchParams();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState<'all' | 'success' | 'pending' | 'failed'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const fetchTxs = async () => {
      if (!client) return;
      setLoading(true);
      try {
        const result = await client.call('tx/search', { query: search, status: status !== 'all' ? status : undefined });
        setTxs(result?.data || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchTxs();
  }, [client, search, status]);

  const filtered = txs.filter(tx => status === 'all' || tx.status === status);

  const getStatusColors = (txStatus: string) => {
    switch(txStatus) {
      case 'success':
        return 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/40 border-2 border-green-300 dark:border-green-700';
      case 'pending':
        return 'bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/40 border-2 border-yellow-300 dark:border-yellow-700';
      case 'failed':
        return 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/40 border-2 border-red-300 dark:border-red-700';
      default:
        return 'bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-800 dark:to-slate-800 border-2 border-gray-300 dark:border-gray-600';
    }
  };

  const getStatusBadge = (txStatus: string) => {
    switch(txStatus) {
      case 'success':
        return <span className="px-4 py-2 rounded-full text-base font-bold bg-green-600 dark:bg-green-500 text-white shadow-lg">✓ Success</span>;
      case 'pending':
        return <span className="px-4 py-2 rounded-full text-base font-bold bg-yellow-600 dark:bg-yellow-500 text-white shadow-lg">⏳ Pending</span>;
      case 'failed':
        return <span className="px-4 py-2 rounded-full text-base font-bold bg-red-600 dark:bg-red-500 text-white shadow-lg">✗ Failed</span>;
      default:
        return <span className="px-4 py-2 rounded-full text-base font-bold bg-gray-600 dark:bg-gray-500 text-white shadow-lg">Unknown</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Transactions</h1>

        {/* Collapsible Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Filters & Search</span>
            <svg className={`w-6 h-6 text-gray-500 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {filtersOpen && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search transactions..."
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <div className="flex flex-wrap gap-3">
                {(['all', 'success', 'pending', 'failed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-5 py-2.5 text-base font-semibold rounded-lg transition-all transform hover:scale-105 ${
                      status === s
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="text-base text-gray-600 dark:text-gray-400 font-medium">
                Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <TransactionStats txs={filtered} />

        {/* Transaction List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-lg text-gray-500">Loading transactions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <p className="text-xl text-gray-500 dark:text-gray-400">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((tx, i) => (
              <div
                key={tx.hash || i}
                className={`${getStatusColors(tx.status)} rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 p-6`}
              >
                <div className="flex flex-col gap-4">
                  {/* Top Section - Hash and Status Badge */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                        {tx.hash?.slice(0, 16)}...{tx.hash?.slice(-8)}
                      </div>
                      <div className="text-base text-gray-600 dark:text-gray-300 mt-1">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'No timestamp'}
                      </div>
                    </div>
                    {getStatusBadge(tx.status)}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t-2 border-gray-300/50 dark:border-gray-600/50">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Method</span>
                      <span className="font-semibold text-lg text-gray-900 dark:text-white mt-1">{tx.method || 'transfer'}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Amount</span>
                      <span className="font-bold text-xl text-gray-900 dark:text-white mt-1">{tx.amount || '0'}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Cost</span>
                      <span className="font-bold text-xl text-gray-900 dark:text-white mt-1">{tx.cost || '0'}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Client</span>
                      <span className="font-semibold text-lg text-gray-900 dark:text-white mt-1 truncate" title={tx.client}>
                        {tx.client ? (tx.client.length > 12 ? `${tx.client.slice(0, 8)}...${tx.client.slice(-4)}` : tx.client) : '-'}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Owner</span>
                      <span className="font-semibold text-lg text-gray-900 dark:text-white mt-1 truncate" title={tx.owner}>
                        {tx.owner ? (tx.owner.length > 12 ? `${tx.owner.slice(0, 8)}...${tx.owner.slice(-4)}` : tx.owner) : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}