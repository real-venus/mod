"use client";

import { WalletIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'

interface WalletCardProps {
  address: string
  type: 'metamask' | 'subwallet' | 'sr25519' | null
  evmAddress?: string
  onCopy: (text: string, label: string) => void
}

export function WalletCard({ address, type, evmAddress, onCopy }: WalletCardProps) {
  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="border-b border-neutral-800 pb-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center bg-neutral-900 border border-neutral-700">
          <WalletIcon className="w-4 h-4 text-neutral-400" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
            {type === 'sr25519' ? 'sr25519' : 'evm'}
          </div>
          <button
            onClick={() => onCopy(address, 'Address')}
            className="font-mono text-sm text-neutral-200 hover:text-white transition-colors flex items-center gap-2 group"
          >
            {formatAddress(address)}
            <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          {type === 'sr25519' && evmAddress && (
            <button
              onClick={() => onCopy(evmAddress, 'EVM Address')}
              className="font-mono text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1 mt-1 group"
            >
              evm: {formatAddress(evmAddress)}
              <ClipboardDocumentIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
