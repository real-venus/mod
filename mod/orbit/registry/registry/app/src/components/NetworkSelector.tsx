'use client';

import { getNetworks } from '@/network/registry';

interface Props {
  value: string;
  onChange: (key: string) => void;
}

export default function NetworkSelector({ value, onChange }: Props) {
  const networks = getNetworks();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm rounded-lg px-3 py-2"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        minWidth: 160,
      }}
    >
      {Object.entries(networks).map(([key, net]) => (
        <option key={key} value={key}>
          {net.name} ({net.type})
        </option>
      ))}
    </select>
  );
}
