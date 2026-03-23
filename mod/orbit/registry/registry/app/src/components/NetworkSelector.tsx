'use client';

import { getEvmNetworks } from '@/network/registry';

interface NetworkSelectorProps {
  value: string;
  onChange: (networkKey: string) => void;
}

export default function NetworkSelector({ value, onChange }: NetworkSelectorProps) {
  const networks = getEvmNetworks();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm rounded-lg cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        padding: '8px 12px',
        minWidth: '160px',
      }}
    >
      {Object.entries(networks).map(([key, net]) => (
        <option key={key} value={key}>
          {net.name}
        </option>
      ))}
    </select>
  );
}
