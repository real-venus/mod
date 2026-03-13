"use client";

import { CheckCircleIcon, ClockIcon, ClipboardDocumentIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface SearchResultProps {
  address: string
  total: number
  claimed: number
  unclaimed: number
  claimData?: {
    amount: number
    recipient: string
    from: string
  }
  onCopy: (text: string, label: string) => void
  onClaim?: () => void
  claiming?: boolean
  canClaim?: boolean
  recipientAddress?: string
  onRecipientChange?: (address: string) => void
}

export function SearchResult({
  address,
  total,
  claimed,
  unclaimed,
  claimData,
  onCopy,
  onClaim,
  claiming = false,
  canClaim = false,
  recipientAddress = '',
  onRecipientChange
}: SearchResultProps) {
  const isClaimed = claimed > 0
  const hasAllocation = total > 0

  return (
    <div className="border border-neutral-800 bg-neutral-950/50 p-4 space-y-3 mt-3">
      {/* Status */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {isClaimed ? (
            <CheckCircleIcon className="w-4 h-4 text-neutral-400" />
          ) : (
            <ClockIcon className="w-4 h-4 text-neutral-400" />
          )}
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            {isClaimed ? 'claimed' : hasAllocation ? 'unclaimed' : 'no allocation'}
          </span>
        </div>
      </div>

      {/* Recipient EVM Address Input */}
      {unclaimed > 0 && onRecipientChange && (
        <div className="pt-2">
          <div className="text-xs text-neutral-600 mb-2 uppercase tracking-wider">recipient evm address</div>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => onRecipientChange(e.target.value)}
            placeholder="0x..."
            className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>
      )}

      {unclaimed > 0 && canClaim && onClaim && (
        <button
          onClick={onClaim}
          disabled={claiming || !recipientAddress.trim()}
          className="w-full px-3 py-2.5 bg-white text-black text-xs font-mono uppercase tracking-wider hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {claiming ? (
            <>
              <ArrowPathIcon className="w-3 h-3 animate-spin inline mr-2" />
              claiming...
            </>
          ) : (
            'claim'
          )}
        </button>
      )}

      {/* Address */}
      <button
        onClick={() => onCopy(address, 'Address')}
        className="font-mono text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-2 group w-full"
      >
        <span className="truncate">{address}</span>
        <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </button>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-4 pt-2">
        <div>
          <div className="text-xs text-neutral-600 mb-1">total</div>
          <div className="font-mono text-lg text-neutral-200">
            {total.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-600 mb-1">claimed</div>
          <div className="font-mono text-lg text-neutral-400">
            {claimed.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-600 mb-1">unclaimed</div>
          <div className="font-mono text-lg text-neutral-200">
            {unclaimed.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Recipient */}
      {claimData?.recipient && (
        <div className="pt-3 border-t border-neutral-800">
          <div className="text-xs text-neutral-600 mb-1">recipient</div>
          <button
            onClick={() => onCopy(claimData.recipient, 'Recipient')}
            className="font-mono text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-2 group"
          >
            <span className="truncate">{claimData.recipient}</span>
            <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      )}
    </div>
  )
}
