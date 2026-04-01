"use client"

import { useMetaMask } from './MetaMaskProvider'

interface MetaMaskButtonProps {
  className?: string
  showBalance?: boolean
}

export default function MetaMaskButton({
  className = '',
  showBalance = false
}: MetaMaskButtonProps) {
  const { account, chainId, isConnecting, isConnected, connect, disconnect } = useMetaMask()

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      5: 'Goerli',
      137: 'Polygon',
      80001: 'Mumbai',
      84532: 'Base Sepolia',
      8453: 'Base',
      // Add more chains as needed
    }
    return chains[chainId] || `Chain ${chainId}`
  }

  if (isConnected && account) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border" style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)'
        }}>
          {/* Chain Badge */}
          {chainId && (
            <span className="text-xs px-2 py-1 rounded" style={{
              background: 'var(--accent-primary)',
              color: 'white'
            }}>
              {getChainName(chainId)}
            </span>
          )}

          {/* Account */}
          <span className="text-sm font-mono">{formatAddress(account)}</span>

          {/* Status Indicator */}
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>

        <button
          onClick={disconnect}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)'
          }}
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className={`px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        color: 'white'
      }}
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Connecting...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
            <path d="M36.0001 7.07L25.2001 0L27.3001 6.84L23.5001 7.67L21.3001 0.5L10.8001 7.42L13.0001 14.32L9.1001 15.18L6.9001 8.28L3.6001 10.27L6.4001 18.38L2.5001 19.22L0.100098 12.22L0.000100001 12.28C-0.0223999 19.93 3.31809 27.28 9.1001 32.43L13.6001 28.93L10.1001 24.93L14.4001 21.16L17.9001 25.16L23.3001 20.93L19.8001 16.93L24.1001 13.16L27.6001 17.16L33.8001 12.34C35.4001 10.53 36.3001 8.84 36.0001 7.07Z" fill="#E17726" />
            <path d="M33.8001 12.34L27.6001 17.16L24.1001 13.16L19.8001 16.93L23.3001 20.93L17.9001 25.16L14.4001 21.16L10.1001 24.93L13.6001 28.93L9.1001 32.43C15.1001 37.79 24.1001 38.92 31.3001 35.43C38.5001 31.94 42.8001 24.68 42.1001 17.22L39.7001 24.22L35.8001 23.38L38.6001 15.27L35.3001 13.28L33.8001 12.34Z" fill="#E27625" />
            <path d="M14.4001 21.16L19.8001 16.93L24.1001 13.16L27.6001 17.16L33.8001 12.34L35.3001 13.28L32.5001 21.38L28.6001 22.22L31.4001 30.32L27.5001 31.16L24.7001 23.06L20.8001 23.9L23.6001 32L19.7001 32.84L17.0001 24.74L13.1001 25.58L15.9001 33.68L12.0001 34.52L9.2001 26.42L5.3001 27.26L8.1001 35.36L9.1001 32.43L13.6001 28.93L10.1001 24.93L14.4001 21.16Z" fill="#E27625" />
            <path d="M39.7001 24.22L42.1001 17.22C42.8001 24.68 38.5001 31.94 31.3001 35.43C24.1001 38.92 15.1001 37.79 9.1001 32.43L8.1001 35.36L5.3001 27.26L9.2001 26.42L12.0001 34.52L15.9001 33.68L13.1001 25.58L17.0001 24.74L19.7001 32.84L23.6001 32L20.8001 23.9L24.7001 23.06L27.5001 31.16L31.4001 30.32L28.6001 22.22L32.5001 21.38L35.3001 13.28L38.6001 15.27L35.8001 23.38L39.7001 24.22Z" fill="#D5BFB2" />
            <path d="M27.3001 6.84L25.2001 0L21.3001 0.5L23.5001 7.67L27.3001 6.84ZM13.0001 14.32L10.8001 7.42L6.9001 8.28L9.1001 15.18L13.0001 14.32ZM6.4001 18.38L3.6001 10.27L0.100098 12.22L2.5001 19.22L6.4001 18.38Z" fill="#233447" />
            <path d="M0.100098 12.22L2.5001 19.22C2.5001 19.22 2.5001 19.22 2.5001 19.23L6.4001 18.39L3.6001 10.28L0.100098 12.23C0.100098 12.23 0.100098 12.22 0.100098 12.22Z" fill="#CC6228" />
            <path d="M2.5001 19.23L0.000100001 12.28C-0.0223999 19.93 3.31809 27.28 9.1001 32.43" fill="#E27625" />
            <path d="M9.1001 15.18L6.9001 8.28L3.6001 10.27L6.4001 18.38L9.1001 15.18Z" fill="#F5841F" />
          </svg>
          Connect MetaMask
        </span>
      )}
    </button>
  )
}
