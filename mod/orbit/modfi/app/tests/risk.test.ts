import { getRiskDisplay, RISK_CONFIG } from '@/lib/risk'

describe('RISK_CONFIG', () => {
  it('has all three risk levels', () => {
    expect(RISK_CONFIG).toHaveProperty('LOW')
    expect(RISK_CONFIG).toHaveProperty('MEDIUM')
    expect(RISK_CONFIG).toHaveProperty('HIGH')
  })

  it('LOW uses green styling', () => {
    expect(RISK_CONFIG.LOW.color).toContain('green')
    expect(RISK_CONFIG.LOW.bgColor).toContain('green')
    expect(RISK_CONFIG.LOW.label).toBe('Low Risk')
    expect(RISK_CONFIG.LOW.level).toBe('LOW')
  })

  it('MEDIUM uses yellow styling', () => {
    expect(RISK_CONFIG.MEDIUM.color).toContain('yellow')
    expect(RISK_CONFIG.MEDIUM.bgColor).toContain('yellow')
    expect(RISK_CONFIG.MEDIUM.label).toBe('Med Risk')
    expect(RISK_CONFIG.MEDIUM.level).toBe('MEDIUM')
  })

  it('HIGH uses red styling', () => {
    expect(RISK_CONFIG.HIGH.color).toContain('red')
    expect(RISK_CONFIG.HIGH.bgColor).toContain('red')
    expect(RISK_CONFIG.HIGH.label).toBe('High Risk')
    expect(RISK_CONFIG.HIGH.level).toBe('HIGH')
  })
})

describe('getRiskDisplay', () => {
  it('returns correct display for each level', () => {
    expect(getRiskDisplay('LOW')).toBe(RISK_CONFIG.LOW)
    expect(getRiskDisplay('MEDIUM')).toBe(RISK_CONFIG.MEDIUM)
    expect(getRiskDisplay('HIGH')).toBe(RISK_CONFIG.HIGH)
  })
})
