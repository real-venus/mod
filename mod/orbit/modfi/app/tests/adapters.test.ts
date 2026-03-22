import { ethers } from 'ethers'
import { ADAPTERS, getAdapter, getAllAdapters } from '@/adapters'
import { TOKENS } from '@/config/tokens'
import { PROTOCOLS } from '@/config/protocols'

const TEST_USER = '0x1234567890abcdef1234567890abcdef12345678'

describe('Adapter registry', () => {
  it('has an adapter for every protocol in config', () => {
    for (const protocol of PROTOCOLS) {
      expect(ADAPTERS).toHaveProperty(protocol.id)
    }
  })

  it('getAdapter returns correct adapter', () => {
    const aave = getAdapter('aave-v3')
    expect(aave).toBeDefined()
    expect(aave!.meta.id).toBe('aave-v3')
  })

  it('getAdapter returns undefined for unknown protocol', () => {
    expect(getAdapter('nonexistent')).toBeUndefined()
  })

  it('getAllAdapters returns all 6 adapters', () => {
    expect(getAllAdapters()).toHaveLength(6)
  })

  it('every adapter has meta matching its protocol config', () => {
    for (const [id, adapter] of Object.entries(ADAPTERS)) {
      expect(adapter.meta.id).toBe(id)
      expect(adapter.meta.name).toBeTruthy()
      expect(adapter.meta.riskLevel).toBeTruthy()
    }
  })
})

describe('Adapter interface compliance', () => {
  for (const [id, adapter] of Object.entries(ADAPTERS)) {
    describe(id, () => {
      it('has all required methods', () => {
        expect(typeof adapter.getApprovalTx).toBe('function')
        expect(typeof adapter.buildStakeTx).toBe('function')
        expect(typeof adapter.buildUnstakeTx).toBe('function')
        expect(typeof adapter.getPositions).toBe('function')
      })
    })
  }
})

describe('Aave V3 adapter', () => {
  const adapter = ADAPTERS['aave-v3']

  it('builds approval tx for USDC', async () => {
    const tx = await adapter.getApprovalTx('USDC', '100', TEST_USER)
    expect(tx).not.toBeNull()
    expect(tx!.to).toBe(TOKENS.USDC.address)
    // approve(address,uint256) selector = 0x095ea7b3
    expect(tx!.data.startsWith('0x095ea7b3')).toBe(true)
  })

  it('returns null approval for ETH', async () => {
    const tx = await adapter.getApprovalTx('ETH', '1', TEST_USER)
    expect(tx).toBeNull()
  })

  it('builds stake tx targeting Aave Pool', async () => {
    const tx = await adapter.buildStakeTx('USDC', '100', TEST_USER)
    expect(tx.to).toBe('0xA238Dd80C259a72e81d7e4664a9801593F98d1c5')
    // supply(address,uint256,address,uint16) selector = 0x617ba037
    expect(tx.data.startsWith('0x617ba037')).toBe(true)
    expect(tx.data.length).toBeGreaterThan(10)
  })

  it('builds unstake tx targeting Aave Pool', async () => {
    const tx = await adapter.buildUnstakeTx('USDC', '100', TEST_USER)
    expect(tx.to).toBe('0xA238Dd80C259a72e81d7e4664a9801593F98d1c5')
    // withdraw(address,uint256,address) selector = 0x69328dec
    expect(tx.data.startsWith('0x69328dec')).toBe(true)
  })

  it('encodes correct USDC amount (6 decimals)', async () => {
    const tx = await adapter.buildStakeTx('USDC', '100', TEST_USER)
    // 100 USDC = 100_000_000 (6 decimals) = 0x5F5E100
    // The amount is encoded in the tx data after the function selector + first address param
    const iface = new ethers.Interface([
      'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    ])
    const decoded = iface.decodeFunctionData('supply', tx.data)
    expect(decoded[1]).toBe(ethers.parseUnits('100', 6))
  })

  it('encodes correct WETH amount (18 decimals)', async () => {
    const tx = await adapter.buildStakeTx('WETH', '1.5', TEST_USER)
    const iface = new ethers.Interface([
      'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    ])
    const decoded = iface.decodeFunctionData('supply', tx.data)
    expect(decoded[1]).toBe(ethers.parseUnits('1.5', 18))
  })
})

describe('Compound V3 adapter', () => {
  const adapter = ADAPTERS['compound-v3']

  it('builds approval tx targeting Comet contract', async () => {
    const tx = await adapter.getApprovalTx('USDC', '100', TEST_USER)
    expect(tx).not.toBeNull()
    expect(tx!.to).toBe(TOKENS.USDC.address)
  })

  it('returns null approval for unsupported token', async () => {
    const tx = await adapter.getApprovalTx('cbETH', '1', TEST_USER)
    expect(tx).toBeNull()
  })

  it('builds stake tx targeting Comet USDC', async () => {
    const tx = await adapter.buildStakeTx('USDC', '100', TEST_USER)
    expect(tx.to).toBe('0xb125E6687d4313864e53df431d5425969c15Eb2F')
    // supply(address,uint256) selector = 0xf2b9fdb8
    expect(tx.data.startsWith('0xf2b9fdb8')).toBe(true)
  })

  it('builds stake tx targeting Comet WETH', async () => {
    const tx = await adapter.buildStakeTx('WETH', '1', TEST_USER)
    expect(tx.to).toBe('0x46e6b214b524310239732D51387075E0e70970bf')
  })

  it('throws for unsupported token', async () => {
    await expect(adapter.buildStakeTx('cbETH', '1', TEST_USER)).rejects.toThrow('does not support')
  })
})

describe('Moonwell adapter', () => {
  const adapter = ADAPTERS['moonwell']

  it('builds approval tx for USDC', async () => {
    const tx = await adapter.getApprovalTx('USDC', '100', TEST_USER)
    expect(tx).not.toBeNull()
    expect(tx!.to).toBe(TOKENS.USDC.address)
  })

  it('builds stake tx using mint()', async () => {
    const tx = await adapter.buildStakeTx('USDC', '100', TEST_USER)
    expect(tx.to).toBe('0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22')
    // mint(uint256) selector = 0xa0712d68
    expect(tx.data.startsWith('0xa0712d68')).toBe(true)
  })

  it('builds unstake tx using redeemUnderlying()', async () => {
    const tx = await adapter.buildUnstakeTx('USDC', '100', TEST_USER)
    // redeemUnderlying(uint256) selector = 0x852a12e3
    expect(tx.data.startsWith('0x852a12e3')).toBe(true)
  })

  it('throws for unsupported token', async () => {
    await expect(adapter.buildStakeTx('USDT', '100', TEST_USER)).rejects.toThrow('does not support')
  })
})

describe('Morpho adapter', () => {
  const adapter = ADAPTERS['morpho']

  it('builds approval tx for USDC targeting vault', async () => {
    const tx = await adapter.getApprovalTx('USDC', '100', TEST_USER)
    expect(tx).not.toBeNull()
    expect(tx!.to).toBe(TOKENS.USDC.address)
  })

  it('builds stake tx using vault deposit()', async () => {
    const tx = await adapter.buildStakeTx('USDC', '100', TEST_USER)
    expect(tx.to).toBe('0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca')
    // deposit(uint256,address) selector = 0x6e553f65
    expect(tx.data.startsWith('0x6e553f65')).toBe(true)
  })

  it('builds unstake tx using vault withdraw()', async () => {
    const tx = await adapter.buildUnstakeTx('USDC', '100', TEST_USER)
    // withdraw(uint256,address,address) selector = 0xb460af94
    expect(tx.data.startsWith('0xb460af94')).toBe(true)
  })

  it('throws for unsupported token', async () => {
    await expect(adapter.buildStakeTx('cbETH', '1', TEST_USER)).rejects.toThrow('not available')
  })
})

describe('Extra Finance adapter', () => {
  const adapter = ADAPTERS['extra-finance']

  it('builds approval tx targeting lending pool', async () => {
    const tx = await adapter.getApprovalTx('USDC', '100', TEST_USER)
    expect(tx).not.toBeNull()
    expect(tx!.to).toBe(TOKENS.USDC.address)
  })

  it('builds stake tx using deposit(reserveId, amount, onBehalfOf)', async () => {
    const tx = await adapter.buildStakeTx('USDC', '100', TEST_USER)
    expect(tx.to).toBe('0xBB505c54D71E9e599cB8435b4F0cEEc05fC71cbD')
    expect(tx.data.length).toBeGreaterThan(10)
  })

  it('throws for unsupported token', async () => {
    await expect(adapter.buildStakeTx('cbETH', '1', TEST_USER)).rejects.toThrow('does not support')
  })
})

describe('Aerodrome adapter', () => {
  const adapter = ADAPTERS['aerodrome']

  it('builds approval tx targeting router', async () => {
    const tx = await adapter.getApprovalTx('USDC', '100', TEST_USER)
    expect(tx).not.toBeNull()
    expect(tx!.to).toBe(TOKENS.USDC.address)
  })

  it('builds stake tx targeting gauge', async () => {
    const tx = await adapter.buildStakeTx('USDC', '1', TEST_USER)
    expect(tx.to).toBe('0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025')
    // deposit(uint256) selector = 0xb6b55f25
    expect(tx.data.startsWith('0xb6b55f25')).toBe(true)
  })

  it('builds unstake tx targeting gauge', async () => {
    const tx = await adapter.buildUnstakeTx('USDC', '1', TEST_USER)
    // withdraw(uint256) selector = 0x2e1a7d4d
    expect(tx.data.startsWith('0x2e1a7d4d')).toBe(true)
  })
})

describe('Cross-adapter consistency', () => {
  it('all adapters return null approval for ETH', async () => {
    for (const [id, adapter] of Object.entries(ADAPTERS)) {
      const tx = await adapter.getApprovalTx('ETH', '1', TEST_USER)
      expect(tx).toBeNull()
    }
  })

  it('all approval txs use approve() function selector', async () => {
    for (const [id, adapter] of Object.entries(ADAPTERS)) {
      const firstToken = adapter.meta.supportedTokens[0]
      if (firstToken === 'ETH') continue
      const tx = await adapter.getApprovalTx(firstToken, '1', TEST_USER)
      if (tx) {
        // approve(address,uint256) = 0x095ea7b3
        expect(tx.data.startsWith('0x095ea7b3')).toBe(true)
      }
    }
  })

  it('all stake txs return valid hex data', async () => {
    for (const [id, adapter] of Object.entries(ADAPTERS)) {
      const firstToken = adapter.meta.supportedTokens[0]
      const tx = await adapter.buildStakeTx(firstToken, '1', TEST_USER)
      expect(tx.to).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(tx.data).toMatch(/^0x[0-9a-fA-F]+$/)
    }
  })

  it('all unstake txs return valid hex data', async () => {
    for (const [id, adapter] of Object.entries(ADAPTERS)) {
      const firstToken = adapter.meta.supportedTokens[0]
      const tx = await adapter.buildUnstakeTx(firstToken, '1', TEST_USER)
      expect(tx.to).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(tx.data).toMatch(/^0x[0-9a-fA-F]+$/)
    }
  })
})
