import { formatUsd, formatApy, formatBalance, shortenAddress, formatTvl } from '@/lib/format'

describe('formatUsd', () => {
  it('formats billions', () => {
    expect(formatUsd(1_500_000_000)).toBe('$1.50B')
    expect(formatUsd(10_000_000_000)).toBe('$10.00B')
  })

  it('formats millions', () => {
    expect(formatUsd(1_500_000)).toBe('$1.50M')
    expect(formatUsd(250_000_000)).toBe('$250.00M')
  })

  it('formats thousands', () => {
    expect(formatUsd(1_500)).toBe('$1.50K')
    expect(formatUsd(999_999)).toBe('$1000.00K')
  })

  it('formats small values', () => {
    expect(formatUsd(500)).toBe('$500.00')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(1.5)).toBe('$1.50')
  })

  it('handles boundary values', () => {
    expect(formatUsd(1_000_000_000)).toBe('$1.00B')
    expect(formatUsd(1_000_000)).toBe('$1.00M')
    expect(formatUsd(1_000)).toBe('$1.00K')
  })
})

describe('formatApy', () => {
  it('formats APY with 2 decimal places', () => {
    expect(formatApy(5.23)).toBe('5.23%')
    expect(formatApy(0)).toBe('0.00%')
    expect(formatApy(100)).toBe('100.00%')
    expect(formatApy(0.01)).toBe('0.01%')
  })
})

describe('formatBalance', () => {
  it('formats numeric balance', () => {
    expect(formatBalance(1.23456789)).toBe('1.2346')
  })

  it('formats string balance', () => {
    expect(formatBalance('1.23456789')).toBe('1.2346')
  })

  it('returns 0 for zero', () => {
    expect(formatBalance(0)).toBe('0')
    expect(formatBalance('0')).toBe('0')
  })

  it('returns <0.0001 for very small values', () => {
    expect(formatBalance(0.00001)).toBe('<0.0001')
    expect(formatBalance('0.00009')).toBe('<0.0001')
  })

  it('respects custom decimals', () => {
    expect(formatBalance(1.23456789, 2)).toBe('1.23')
    expect(formatBalance(1.23456789, 6)).toBe('1.234568')
  })
})

describe('shortenAddress', () => {
  it('shortens a standard ETH address', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x1234...5678')
  })
})

describe('formatTvl', () => {
  it('delegates to formatUsd', () => {
    expect(formatTvl(5_000_000)).toBe('$5.00M')
    expect(formatTvl(500_000_000)).toBe('$500.00M')
  })
})
