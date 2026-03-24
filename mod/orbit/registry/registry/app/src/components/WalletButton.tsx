'use client';

interface Props {
  wallet: string | null;
  onConnect: () => void;
}

export default function WalletButton({ wallet, onConnect }: Props) {
  if (wallet) {
    return (
      <div
        className="px-4 py-2 rounded-lg text-sm font-mono"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        {wallet.slice(0, 6)}...{wallet.slice(-4)}
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      className="px-4 py-2 rounded-lg text-sm font-medium"
      style={{
        backgroundColor: 'var(--accent)',
        color: '#000000',
      }}
    >
      Connect
    </button>
  );
}
