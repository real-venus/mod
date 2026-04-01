"use client"

import { useState } from 'react'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { TerminalCard } from './GlowCard'
import { getSafeDeployment } from './shared'
import { createSafe } from '@/network/safe'

const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"

const inputStyle: React.CSSProperties = {
  fontFamily: TERM_FONT,
  fontSize: '14px',
  color: 'var(--text-primary)',
  background: 'var(--bg-input)',
  border: '2px solid var(--border-color)',
  padding: '8px 12px',
  width: '100%',
  outline: 'none',
  boxShadow: '2px 2px 0px 0px rgba(255,255,255,0.04)',
}

export function CreateTab({
  walletAddress,
  onSafeCreated,
}: {
  walletAddress: string
  onSafeCreated: (address: string) => void
}) {
  const deployment = getSafeDeployment()
  const [factoryAddress, setFactoryAddress] = useState(deployment.factory)
  const [singletonAddress, setSingletonAddress] = useState(deployment.singleton)
  const [owners, setOwners] = useState<string[]>([walletAddress || ''])
  const [threshold, setThreshold] = useState(1)
  const [creating, setCreating] = useState(false)

  const addOwner = () => setOwners([...owners, ''])

  const removeOwner = (idx: number) => {
    if (owners.length <= 1) return
    const next = owners.filter((_, i) => i !== idx)
    setOwners(next)
    if (threshold > next.length) setThreshold(next.length)
  }

  const updateOwner = (idx: number, value: string) => {
    const next = [...owners]
    next[idx] = value
    setOwners(next)
  }

  const handleCreate = async () => {
    if (!factoryAddress || !ethers.isAddress(factoryAddress)) {
      toast.error('Enter a valid SafeProxyFactory address')
      return
    }
    if (!singletonAddress || !ethers.isAddress(singletonAddress)) {
      toast.error('Enter a valid Safe singleton address')
      return
    }

    const validOwners = owners.map(o => o.trim()).filter(o => o)
    for (const o of validOwners) {
      if (!ethers.isAddress(o)) {
        toast.error(`Invalid owner address: ${o}`)
        return
      }
    }
    if (validOwners.length === 0) {
      toast.error('Add at least one owner')
      return
    }
    const uniqueOwners = [...new Set(validOwners.map(o => ethers.getAddress(o)))]
    if (uniqueOwners.length !== validOwners.length) {
      toast.error('Duplicate owner addresses')
      return
    }

    setCreating(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const newSafe = await createSafe(factoryAddress, singletonAddress, uniqueOwners, threshold, signer)
      toast.success(`Safe created: ${newSafe.slice(0, 10)}...`)
      onSafeCreated(newSafe)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to create Safe')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Deploy contracts */}
      <TerminalCard label="DEPLOY CONTRACTS">
        <div className="space-y-4">
          <div>
            <label style={{
              display: 'block',
              fontFamily: TERM_FONT,
              fontSize: '12px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: '6px',
            }}>SafeProxyFactory Address</label>
            <input
              type="text"
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              placeholder="0x..."
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontFamily: TERM_FONT,
              fontSize: '12px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: '6px',
            }}>Safe Singleton Address</label>
            <input
              type="text"
              value={singletonAddress}
              onChange={(e) => setSingletonAddress(e.target.value)}
              placeholder="0x..."
              style={inputStyle}
            />
          </div>
          {deployment.factory && (
            <div style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.5 }}>
              pre-filled from testnet deployment
            </div>
          )}
        </div>
      </TerminalCard>

      {/* Owners */}
      <TerminalCard label="OWNERS">
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {owners.length} signer{owners.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={addOwner}
            className="transition-all"
            style={{
              fontFamily: TERM_FONT,
              fontSize: '13px',
              padding: '4px 12px',
              border: '2px solid var(--accent-primary, #10b981)',
              color: 'var(--accent-primary, #10b981)',
              background: 'transparent',
              boxShadow: '2px 2px 0px 0px var(--accent-primary, #10b981)',
              cursor: 'pointer',
            }}
          >
            + ADD
          </button>
        </div>
        <div className="space-y-3">
          {owners.map((owner, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span style={{ fontFamily: TERM_FONT, fontSize: '14px', color: 'var(--text-tertiary)', width: '24px', textAlign: 'right' }}>{idx + 1}</span>
              <input
                type="text"
                value={owner}
                onChange={(e) => updateOwner(idx, e.target.value)}
                placeholder="0x..."
                style={{ ...inputStyle, flex: 1 }}
              />
              {owners.length > 1 && (
                <button
                  onClick={() => removeOwner(idx)}
                  className="transition-colors"
                  style={{
                    fontFamily: TERM_FONT,
                    fontSize: '14px',
                    color: 'var(--accent-error, #ef4444)',
                    opacity: 0.5,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Threshold */}
      <TerminalCard label="THRESHOLD">
        <div className="flex items-center gap-4">
          <input
            type="number"
            min={1}
            max={owners.length}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, Math.min(owners.length, parseInt(e.target.value) || 1)))}
            style={{ ...inputStyle, width: '80px', textAlign: 'center' }}
          />
          <span style={{ fontFamily: TERM_FONT, fontSize: '14px', color: 'var(--text-tertiary)' }}>
            of {owners.length} owner{owners.length !== 1 ? 's' : ''} required to confirm
          </span>
        </div>
      </TerminalCard>

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full transition-all"
        style={{
          fontFamily: TERM_FONT,
          fontSize: '16px',
          letterSpacing: '0.08em',
          padding: '14px 20px',
          border: '2px solid var(--accent-primary, #10b981)',
          color: 'var(--accent-primary, #10b981)',
          background: 'rgba(16, 185, 129, 0.06)',
          boxShadow: '4px 4px 0px 0px var(--accent-primary, #10b981)',
          cursor: creating ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.4 : 1,
          textShadow: '0 0 8px var(--accent-primary, #10b981)',
        }}
      >
        {creating ? 'DEPLOYING...' : '+ Create Safe'}
      </button>
    </div>
  )
}
