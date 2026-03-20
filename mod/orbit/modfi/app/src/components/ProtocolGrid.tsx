'use client'

import { useState } from 'react'
import { PROTOCOLS, RiskLevel, ProtocolCategory } from '@/config/protocols'
import { ProtocolCard } from './ProtocolCard'
import { RateData } from '@/lib/api'

interface Props {
  rates: RateData[]
  onStake: (protocolId: string) => void
}

type SortBy = 'name' | 'apy' | 'risk'
type FilterRisk = 'ALL' | RiskLevel
type FilterCategory = 'ALL' | ProtocolCategory

const RISK_ORDER: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }

export function ProtocolGrid({ rates, onStake }: Props) {
  const [sortBy, setSortBy] = useState<SortBy>('risk')
  const [filterRisk, setFilterRisk] = useState<FilterRisk>('ALL')
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL')

  let filtered = PROTOCOLS.filter(p => {
    if (filterRisk !== 'ALL' && p.riskLevel !== filterRisk) return false
    if (filterCategory !== 'ALL' && p.category !== filterCategory) return false
    return true
  })

  filtered.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'risk') return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]
    if (sortBy === 'apy') {
      const aRates = rates.filter(r => r.protocol?.toLowerCase().includes(a.defiLlamaSlug))
      const bRates = rates.filter(r => r.protocol?.toLowerCase().includes(b.defiLlamaSlug))
      const aMax = Math.max(0, ...aRates.map(r => r.apy))
      const bMax = Math.max(0, ...bRates.map(r => r.apy))
      return bMax - aMax
    }
    return 0
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Protocols</h2>
        <div className="flex items-center gap-2 text-xs">
          {/* Risk filter */}
          <div className="flex gap-1">
            {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as FilterRisk[]).map(r => (
              <button
                key={r}
                onClick={() => setFilterRisk(r)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filterRisk === r
                    ? 'bg-modfi-purple/20 text-modfi-purple border border-modfi-purple/30'
                    : 'bg-modfi-card text-modfi-muted border border-modfi-border hover:border-modfi-purple/20'
                }`}
              >
                {r === 'ALL' ? 'All' : r}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="bg-modfi-card text-modfi-text border border-modfi-border rounded-md px-2 py-1 text-xs"
          >
            <option value="risk">Sort: Risk</option>
            <option value="apy">Sort: APY</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-4">
        {(['ALL', 'lending', 'dex', 'leverage'] as FilterCategory[]).map(c => (
          <button
            key={c}
            onClick={() => setFilterCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              filterCategory === c
                ? 'bg-modfi-purple/10 text-modfi-purple border border-modfi-purple/20'
                : 'text-modfi-muted hover:text-modfi-text'
            }`}
          >
            {c === 'ALL' ? 'All' : c === 'dex' ? 'DEX / LP' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <ProtocolCard key={p.id} protocol={p} rates={rates} onStake={onStake} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-modfi-muted py-12">
          No protocols match your filters
        </div>
      )}
    </div>
  )
}
