'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchRates, RateData } from '@/lib/api'

export function useRates() {
  return useQuery<RateData[]>({
    queryKey: ['modfi-rates'],
    queryFn: fetchRates,
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 2 * 60 * 1000,
  })
}

export function useProtocolRates(protocolSlug: string) {
  const { data: rates } = useRates()
  if (!rates) return {}
  const map: Record<string, { apy: number; tvl: number }> = {}
  for (const r of rates) {
    if (r.protocol?.toLowerCase().includes(protocolSlug.toLowerCase())) {
      map[r.token] = { apy: r.apy, tvl: r.tvl }
    }
  }
  return map
}
