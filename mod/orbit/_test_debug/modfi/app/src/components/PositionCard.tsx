'use client'

import { ProtocolPosition } from '@/adapters/types'
import { getProtocol } from '@/config/protocols'
import { RiskBadge } from './RiskBadge'
import { formatBalance, formatApy } from '@/lib/format'

interface Props {
  position: ProtocolPosition
  onUnstake: (protocolId: string, token: string, amount: string) => void
}

export function PositionCard({ position, onUnstake }: Props) {
  const protocol = getProtocol(position.protocolId)

  return (
    <div className="bg-modfi-card border border-modfi-border rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{protocol?.name || position.protocolId}</span>
            {protocol && <RiskBadge level={protocol.riskLevel} />}
          </div>
          <div className="text-sm text-modfi-muted mt-0.5">
            {formatBalance(position.amount)} {position.token}
            {position.apy > 0 && (
              <span className="text-modfi-green ml-2">{formatApy(position.apy)} APY</span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => onUnstake(position.protocolId, position.token, position.amount)}
        className="px-4 py-2 rounded-lg border border-modfi-border text-sm text-modfi-text hover:border-modfi-red hover:text-modfi-red transition-colors"
      >
        Unstake
      </button>
    </div>
  )
}
