import { ProtocolAdapter } from './types'
import { aaveV3Adapter } from './aave-v3'
import { compoundV3Adapter } from './compound-v3'
import { moonwellAdapter } from './moonwell'
import { morphoAdapter } from './morpho'
import { extraFinanceAdapter } from './extra-finance'
import { aerodromeAdapter } from './aerodrome'

export const ADAPTERS: Record<string, ProtocolAdapter> = {
  'aave-v3': aaveV3Adapter,
  'compound-v3': compoundV3Adapter,
  'moonwell': moonwellAdapter,
  'morpho': morphoAdapter,
  'extra-finance': extraFinanceAdapter,
  'aerodrome': aerodromeAdapter,
}

export function getAdapter(protocolId: string): ProtocolAdapter | undefined {
  return ADAPTERS[protocolId]
}

export function getAllAdapters(): ProtocolAdapter[] {
  return Object.values(ADAPTERS)
}

export type { ProtocolAdapter, ProtocolPosition, TxRequest } from './types'
