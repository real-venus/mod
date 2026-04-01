"use client";

interface TransactionStatsProps {
  txs: any[];
}

export function TransactionStats({ txs }: TransactionStatsProps) {
  const stats = {
    total: txs.length,
    success: txs.filter(t => t.status === 'success').length,
    pending: txs.filter(t => t.status === 'pending').length,
    failed: txs.filter(t => t.status === 'failed').length,
    volume: txs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0).toFixed(2)
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 rounded-xl shadow-lg p-6">
      <div className="flex flex-wrap items-center gap-6 text-white">
        <div className="flex flex-col">
          <span className="text-sm opacity-90 uppercase tracking-wide">Total Transactions</span>
          <span className="text-3xl font-bold">{stats.total}</span>
        </div>

        <div className="h-12 w-px bg-white/30"></div>

        <div className="flex flex-col">
          <span className="text-sm opacity-90 uppercase tracking-wide">✓ Success</span>
          <span className="text-3xl font-bold text-green-300">{stats.success}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-sm opacity-90 uppercase tracking-wide">⏳ Pending</span>
          <span className="text-3xl font-bold text-yellow-300">{stats.pending}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-sm opacity-90 uppercase tracking-wide">✗ Failed</span>
          <span className="text-3xl font-bold text-red-300">{stats.failed}</span>
        </div>

        <div className="h-12 w-px bg-white/30"></div>

        <div className="flex flex-col ml-auto">
          <span className="text-sm opacity-90 uppercase tracking-wide">Total Volume</span>
          <span className="text-3xl font-bold">{stats.volume}</span>
        </div>
      </div>
    </div>
  );
}