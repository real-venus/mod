"use client";

import { ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'

interface BalanceEntry {
  address: string
  total: number
  claimed: number
  unclaimed: number
}

interface BalanceSheetProps {
  entries: BalanceEntry[]
  loading?: boolean
  onRefresh: () => void
  onCopy: (text: string, label: string) => void
}

export function BalanceSheet({
  entries,
  loading = false,
  onRefresh,
  onCopy
}: BalanceSheetProps) {
  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`
  }

  const totalBalance = entries.reduce((sum, e) => sum + e.total, 0)
  const totalClaimed = entries.reduce((sum, e) => sum + e.claimed, 0)
  const totalUnclaimed = entries.reduce((sum, e) => sum + e.unclaimed, 0)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="text-xs uppercase tracking-wider text-neutral-500">
          balance sheet ({entries.length})
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 hover:bg-neutral-900 transition-colors"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4 p-3 border border-neutral-800 bg-neutral-950/50">
        <div>
          <div className="text-xs text-neutral-600 mb-1">total</div>
          <div className="font-mono text-lg text-neutral-200">
            {totalBalance.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-600 mb-1">claimed</div>
          <div className="font-mono text-lg text-neutral-400">
            {totalClaimed.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-600 mb-1">unclaimed</div>
          <div className="font-mono text-lg text-neutral-200">
            {totalUnclaimed.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin text-neutral-700" />
          <p className="text-xs text-neutral-600">loading</p>
        </div>
      )}

      {/* Empty */}
      {!loading && entries.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-xs text-neutral-600">no balances</p>
        </div>
      )}

      {/* Table */}
      {!loading && entries.length > 0 && (
        <div className="border border-neutral-900">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-900 bg-neutral-950/50">
                <th className="text-left p-2 text-xs text-neutral-600 font-normal uppercase tracking-wider">
                  address
                </th>
                <th className="text-right p-2 text-xs text-neutral-600 font-normal uppercase tracking-wider">
                  total
                </th>
                <th className="text-right p-2 text-xs text-neutral-600 font-normal uppercase tracking-wider">
                  claimed
                </th>
                <th className="text-right p-2 text-xs text-neutral-600 font-normal uppercase tracking-wider">
                  unclaimed
                </th>
                <th className="text-right p-2 text-xs text-neutral-600 font-normal uppercase tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.address}
                  className="border-b border-neutral-900 hover:bg-neutral-950/50 transition-colors"
                >
                  <td className="p-2">
                    <button
                      onClick={() => onCopy(entry.address, 'Address')}
                      className="text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-2 group"
                    >
                      {formatAddress(entry.address)}
                      <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>
                  <td className="p-2 text-right text-neutral-300">
                    {entry.total.toLocaleString()}
                  </td>
                  <td className="p-2 text-right text-neutral-500">
                    {entry.claimed.toLocaleString()}
                  </td>
                  <td className="p-2 text-right text-neutral-300">
                    {entry.unclaimed.toLocaleString()}
                  </td>
                  <td className="p-2 text-right text-neutral-600">
                    {entry.total > 0
                      ? `${((entry.claimed / entry.total) * 100).toFixed(0)}%`
                      : '0%'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
