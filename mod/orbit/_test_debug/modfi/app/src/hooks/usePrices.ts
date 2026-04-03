'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPrices, PriceData } from '@/lib/api'

export function usePrices() {
  return useQuery<PriceData>({
    queryKey: ['modfi-prices'],
    queryFn: fetchPrices,
    refetchInterval: 60 * 1000, // 1 min
    staleTime: 30 * 1000,
  })
}
