"use client";

import { CheckCircleIcon, ClipboardDocumentIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface ClaimData {
  amount: number
  recipient: string
  from: string
}

interface ClaimHistoryProps {
  claims: Record<string, ClaimData>
  loading?: boolean
  isOwner?: boolean
  onRefresh: () => void
  onCopy: (text: string, label: string) => void
  onDelete?: (address: string) => void
}

export function ClaimHistory({
  claims,
  loading = false,
  isOwner = false,
  onRefresh,
  onCopy,
  onDelete
}: ClaimHistoryProps) {
  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const entries = Object.entries(claims).sort(([, a], [, b]) => Number(b.amount) - Number(a.amount))

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="text-xs uppercase tracking-wider text-neutral-500">
          claimed ({entries.length})
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 hover:bg-neutral-900 transition-colors"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
          <p className="text-xs text-neutral-600">no claims</p>
        </div>
      )}

      {/* List */}
      {!loading && entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(([address, claimData]) => (
            <div
              key={address}
              className="flex items-center justify-between p-3 border border-neutral-900 hover:border-neutral-800 transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <button
                  onClick={() => onCopy(address, 'Address')}
                  className="font-mono text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-2 group"
                >
                  {formatAddress(address)}
                  <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                {claimData.recipient && (
                  <button
                    onClick={() => onCopy(claimData.recipient, 'Recipient')}
                    className="font-mono text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1 group"
                  >
                    → {formatAddress(claimData.recipient)}
                    <ClipboardDocumentIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-sm text-neutral-300">
                  {Number(claimData.amount).toLocaleString()}
                </div>
                <CheckCircleIcon className="w-4 h-4 text-neutral-600" />
                {isOwner && onDelete && (
                  <button
                    onClick={() => onDelete(address)}
                    className="p-1.5 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
