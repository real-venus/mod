'use client'

import { ProtocolMeta } from '@/config/protocols'
import { RiskBadge } from './RiskBadge'
import { formatApy, formatTvl } from '@/lib/format'
import { RateData } from '@/lib/api'

interface Props {
  protocol: ProtocolMeta
  rates: RateData[]
  onStake: (protocolId: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  lending: 'Lending',
  dex: 'DEX / LP',
  yield: 'Yield',
  leverage: 'Leverage',
}

export function ProtocolCard({ protocol, rates, onStake }: Props) {
  // Find best APY for this protocol
  const protocolRates = rates.filter(r =>
    r.protocol?.toLowerCase().includes(protocol.defiLlamaSlug.toLowerCase())
  )

  const bestRate = protocolRates.reduce<RateData | null>((best, r) => {
    if (!best || r.apy > best.apy) return r
    return best
  }, null)

  const totalTvl = protocolRates.reduce((sum, r) => sum + (r.tvl || 0), 0)

  return (
    <div className="bg-modfi-card border border-modfi-border rounded-xl p-5 hover:border-modfi-purple/30 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white text-lg">{protocol.name}</h3>
          <span className="text-xs text-modfi-muted">{CATEGORY_LABELS[protocol.category] || protocol.category}</span>
        </div>
        <RiskBadge level={protocol.riskLevel} />
      </div>

      <p className="text-sm text-modfi-muted mb-4 leading-relaxed">{protocol.description}</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-modfi-bg rounded-lg p-3">
          <div className="text-xs text-modfi-muted mb-1">Best APY</div>
          <div className="font-mono text-lg font-bold text-modfi-green">
            {bestRate ? formatApy(bestRate.apy) : '--'}
          </div>
          {bestRate?.token && (
            <div className="text-xs text-modfi-muted">{bestRate.token}</div>
          )}
        </div>
        <div className="bg-modfi-bg rounded-lg p-3">
          <div className="text-xs text-modfi-muted mb-1">TVL</div>
          <div className="font-mono text-lg font-bold text-modfi-text">
            {totalTvl > 0 ? formatTvl(totalTvl) : '--'}
          </div>
        </div>
      </div>

      {/* Token APYs */}
      {protocolRates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {protocolRates.map((r, i) => (
            <span key={i} className="text-xs bg-modfi-bg px-2 py-1 rounded-md font-mono">
              <span className="text-modfi-muted">{r.token}</span>{' '}
              <span className="text-modfi-green">{formatApy(r.apy)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Supported tokens */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-modfi-muted">Tokens:</span>
        <div className="flex gap-1">
          {protocol.supportedTokens.map(t => (
            <span key={t} className="text-xs bg-modfi-border/50 px-1.5 py-0.5 rounded text-modfi-text">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Risk factors */}
      <details className="mb-4 group/details">
        <summary className="text-xs text-modfi-muted cursor-pointer hover:text-modfi-text transition-colors">
          Risk factors
        </summary>
        <ul className="mt-2 space-y-1">
          {protocol.riskFactors.map((f, i) => (
            <li key={i} className="text-xs text-modfi-muted flex items-start gap-1.5">
              <span className="text-modfi-purple mt-0.5">-</span> {f}
            </li>
          ))}
        </ul>
      </details>

      <button
        onClick={() => onStake(protocol.id)}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-modfi-purple to-modfi-violet text-white font-medium text-sm hover:opacity-90 transition-opacity"
      >
        Stake
      </button>
    </div>
  )
}
