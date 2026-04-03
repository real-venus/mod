'use client'

import { RiskLevel } from '@/config/protocols'
import { getRiskDisplay } from '@/lib/risk'

export function RiskBadge({ level }: { level: RiskLevel }) {
  const risk = getRiskDisplay(level)
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${risk.bgColor} ${risk.borderColor} ${risk.color}`}>
      {risk.label}
    </span>
  )
}
