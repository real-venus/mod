'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { getAllAdapters, ProtocolPosition } from '@/adapters'

const BASE_RPC = 'https://mainnet.base.org'

export function usePositions() {
  const { address, isConnected } = useAccount()

  return useQuery<ProtocolPosition[]>({
    queryKey: ['modfi-positions', address],
    queryFn: async () => {
      if (!address) return []
      const provider = new ethers.JsonRpcProvider(BASE_RPC)
      const adapters = getAllAdapters()
      const results = await Promise.allSettled(
        adapters.map(a => a.getPositions(address, provider))
      )
      const positions: ProtocolPosition[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') positions.push(...r.value)
      }
      return positions
    },
    enabled: isConnected && !!address,
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  })
}
