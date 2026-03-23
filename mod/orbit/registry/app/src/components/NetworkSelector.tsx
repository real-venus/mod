'use client'

import { getEvmNetworks, NetworkConfig } from '@/network/registry'

interface Props {
  value: string
  onChange: (key: string) => void
}

export function NetworkSelector({ value, onChange }: Props) {
  const networks = getEvmNetworks()

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-gray-300"
    >
      {Object.entries(networks).map(([key, net]) => (
        <option key={key} value={key}>{net.name}</option>
      ))}
    </select>
  )
}
