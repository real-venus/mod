import { fetchRates, fetchPrices, fetchBalances } from '@/lib/api'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

beforeEach(() => {
  mockFetch.mockClear()
})

describe('fetchRates', () => {
  it('returns rates array from API response', async () => {
    const mockRates = [
      { protocol: 'aave-v3', token: 'USDC', apy: 3.5, tvl: 1000000 },
      { protocol: 'compound-v3', token: 'USDC', apy: 2.8, tvl: 500000 },
    ]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: mockRates, timestamp: Date.now() }),
    })

    const rates = await fetchRates()
    expect(rates).toEqual(mockRates)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8420/api/rates')
  })

  it('handles flat array response (no rates wrapper)', async () => {
    const mockRates = [{ protocol: 'aave-v3', token: 'USDC', apy: 3.5, tvl: 1000000 }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRates,
    })

    const rates = await fetchRates()
    expect(rates).toEqual(mockRates)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 })
    await expect(fetchRates()).rejects.toThrow('Failed to fetch rates')
  })
})

describe('fetchPrices', () => {
  it('returns prices map from API response', async () => {
    const mockPrices = { ETH: 3500, USDC: 1.0, USDT: 1.0 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ prices: mockPrices, timestamp: Date.now() }),
    })

    const prices = await fetchPrices()
    expect(prices).toEqual(mockPrices)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8420/api/prices')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchPrices()).rejects.toThrow('Failed to fetch prices')
  })
})

describe('fetchBalances', () => {
  it('returns balances for given address', async () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678'
    const mockBalances = { USDC: '100.000000', ETH: '1.500000' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balances: mockBalances, address: addr, timestamp: Date.now() }),
    })

    const balances = await fetchBalances(addr)
    expect(balances).toEqual(mockBalances)
    expect(mockFetch).toHaveBeenCalledWith(`http://localhost:8420/api/positions/${addr}`)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })
    await expect(fetchBalances('0xinvalid')).rejects.toThrow('Failed to fetch balances')
  })
})
