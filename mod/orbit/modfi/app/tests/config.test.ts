import { TOKENS } from '@/config/tokens'
import { PROTOCOLS, getProtocol } from '@/config/protocols'

describe('Token config', () => {
  it('has all expected tokens', () => {
    expect(TOKENS).toHaveProperty('USDC')
    expect(TOKENS).toHaveProperty('USDT')
    expect(TOKENS).toHaveProperty('WETH')
    expect(TOKENS).toHaveProperty('ETH')
    expect(TOKENS).toHaveProperty('cbETH')
  })

  it('each token has valid address format', () => {
    for (const [symbol, token] of Object.entries(TOKENS)) {
      expect(token.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(token.symbol).toBe(symbol)
      expect(token.decimals).toBeGreaterThan(0)
      expect(token.name.length).toBeGreaterThan(0)
    }
  })

  it('USDC/USDT have 6 decimals', () => {
    expect(TOKENS.USDC.decimals).toBe(6)
    expect(TOKENS.USDT.decimals).toBe(6)
  })

  it('ETH/WETH/cbETH have 18 decimals', () => {
    expect(TOKENS.ETH.decimals).toBe(18)
    expect(TOKENS.WETH.decimals).toBe(18)
    expect(TOKENS.cbETH.decimals).toBe(18)
  })
})

describe('Protocol config', () => {
  it('has all 6 protocols', () => {
    expect(PROTOCOLS).toHaveLength(6)
  })

  it('each protocol has unique id', () => {
    const ids = PROTOCOLS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each protocol has required fields', () => {
    for (const protocol of PROTOCOLS) {
      expect(protocol.id).toBeTruthy()
      expect(protocol.name).toBeTruthy()
      expect(protocol.description).toBeTruthy()
      expect(protocol.url).toMatch(/^https:\/\//)
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(protocol.riskLevel)
      expect(protocol.riskFactors.length).toBeGreaterThan(0)
      expect(protocol.supportedTokens.length).toBeGreaterThan(0)
      expect(protocol.defiLlamaSlug).toBeTruthy()
      expect(protocol.chain).toBe('Base')
      expect(['lending', 'dex', 'yield', 'leverage']).toContain(protocol.category)
    }
  })

  it('each protocol references valid tokens', () => {
    for (const protocol of PROTOCOLS) {
      for (const token of protocol.supportedTokens) {
        expect(TOKENS).toHaveProperty(token)
      }
    }
  })

  it('has correct risk levels for known protocols', () => {
    expect(getProtocol('aave-v3')?.riskLevel).toBe('LOW')
    expect(getProtocol('compound-v3')?.riskLevel).toBe('LOW')
    expect(getProtocol('moonwell')?.riskLevel).toBe('MEDIUM')
    expect(getProtocol('morpho')?.riskLevel).toBe('MEDIUM')
    expect(getProtocol('extra-finance')?.riskLevel).toBe('HIGH')
    expect(getProtocol('aerodrome')?.riskLevel).toBe('MEDIUM')
  })
})

describe('getProtocol', () => {
  it('returns protocol by id', () => {
    const aave = getProtocol('aave-v3')
    expect(aave).toBeDefined()
    expect(aave!.name).toBe('Aave V3')
  })

  it('returns undefined for unknown id', () => {
    expect(getProtocol('nonexistent')).toBeUndefined()
  })
})
