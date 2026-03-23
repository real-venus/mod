'use client'

interface Props {
  wallet: string | null
  onConnect: () => void
}

export function WalletButton({ wallet, onConnect }: Props) {
  if (wallet) {
    return (
      <div className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-gray-400 font-mono">
        {wallet.slice(0, 6)}...{wallet.slice(-4)}
      </div>
    )
  }

  return (
    <button
      onClick={onConnect}
      className="px-4 py-2 bg-surface border border-accent text-accent rounded-lg text-sm font-medium hover:bg-accent/10"
    >
      Connect Wallet
    </button>
  )
}
