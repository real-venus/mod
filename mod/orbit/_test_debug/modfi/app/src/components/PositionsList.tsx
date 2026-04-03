'use client'

import { usePositions } from '@/hooks/usePositions'
import { PositionCard } from './PositionCard'

interface Props {
  onUnstake: (protocolId: string, token: string, amount: string) => void
}

export function PositionsList({ onUnstake }: Props) {
  const { data: positions, isLoading } = usePositions()

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Your Positions</h2>
        <div className="text-sm text-modfi-muted animate-pulse">Loading positions...</div>
      </div>
    )
  }

  if (!positions || positions.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-4">
        Your Positions
        <span className="text-sm text-modfi-muted font-normal ml-2">({positions.length})</span>
      </h2>
      <div className="space-y-3">
        {positions.map((p, i) => (
          <PositionCard key={`${p.protocolId}-${p.token}-${i}`} position={p} onUnstake={onUnstake} />
        ))}
      </div>
    </div>
  )
}
