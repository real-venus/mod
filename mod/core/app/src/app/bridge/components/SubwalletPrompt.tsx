"use client";

import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface SubwalletPromptProps {
  type: 'auth' | 'evm'
  connected?: boolean
  connecting?: boolean
  processing?: boolean
  onConnect: () => void
  onGenerateToken?: () => void
}

export function SubwalletPrompt({
  type,
  connected = false,
  connecting = false,
  processing = false,
  onConnect,
  onGenerateToken
}: SubwalletPromptProps) {
  if (type === 'auth') {
    return (
      <div className="border border-neutral-800 bg-neutral-950/50 p-4">
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
          {connected ? 'authentication' : 'connect wallet'}
        </div>
        <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
          {connected
            ? 'sign message to generate authentication token'
            : 'connect subwallet to access sr25519 account'
          }
        </p>
        {!connected ? (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="px-4 py-2 bg-white text-black text-xs font-mono uppercase tracking-wider hover:bg-neutral-200 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            {connecting ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                connecting
              </>
            ) : (
              'connect'
            )}
          </button>
        ) : (
          <button
            onClick={onGenerateToken}
            disabled={processing}
            className="px-4 py-2 bg-white text-black text-xs font-mono uppercase tracking-wider hover:bg-neutral-200 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            {processing ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                generating
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4" />
                generate token
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="border border-neutral-800 bg-neutral-950/50 p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
        evm wallet required
      </div>
      <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
        connect evm wallet to receive bridged tokens
      </p>
      <button
        onClick={onConnect}
        className="px-4 py-2 bg-white text-black text-xs font-mono uppercase tracking-wider hover:bg-neutral-200 transition-all"
      >
        connect
      </button>
    </div>
  )
}
