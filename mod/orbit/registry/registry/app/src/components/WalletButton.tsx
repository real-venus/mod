'use client';

interface WalletButtonProps {
  wallet: string | null;
  onConnect: () => void;
}

export default function WalletButton({ wallet, onConnect }: WalletButtonProps) {
  if (wallet) {
    const truncated = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    return (
      <div
        className="px-4 py-2 rounded-lg text-sm font-mono"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          color: 'var(--accent)',
        }}
      >
        {truncated}
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: 'var(--accent)',
        color: '#000000',
      }}
    >
      Connect Wallet
    </button>
  );
}
