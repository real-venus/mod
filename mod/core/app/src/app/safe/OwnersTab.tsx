"use client"

import { useState } from 'react'
import { ethers } from 'ethers'
import { CopyButton } from '@/ui/CopyButton'
import { TerminalCard } from './GlowCard'
import { shorten } from '@/utils'
import {
  proposeSafeTransaction,
  encodeAddOwnerWithThreshold,
  encodeRemoveOwner,
  encodeChangeThreshold,
  type SafeInfo,
} from '@/network/safe'
import { toast } from 'react-toastify'

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: TERM_FONT,
  fontSize: '12px',
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
  marginBottom: '6px',
}

export function OwnersTab({
  safeInfo, walletAddress, isOwner, onReloadSafe,
}: {
  safeInfo: SafeInfo | null
  walletAddress: string
  isOwner: boolean
  onReloadSafe: () => void
}) {
  const [newOwnerAddr, setNewOwnerAddr] = useState('')
  const [newThreshold, setNewThreshold] = useState('')
  const [removeOwnerAddr, setRemoveOwnerAddr] = useState('')
  const [removeThreshold, setRemoveThreshold] = useState('')
  const [changeThresholdVal, setChangeThresholdVal] = useState('')
  const [ownerLoading, setOwnerLoading] = useState<string | null>(null)

  async function proposeOwnerChange(label: string, data: string) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    if (!safeInfo) { toast.error('Load Safe first'); return }
    setOwnerLoading(label)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const network = await provider.getNetwork()
      const { safeTxHash } = await proposeSafeTransaction(
        safeInfo.address, safeInfo.address, data, signer, network.chainId
      )
      toast.success(`${label} proposed: ${safeTxHash.slice(0, 10)}...`)
      onReloadSafe()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || `${label} failed`)
    } finally {
      setOwnerLoading(null)
    }
  }

  function handleAddOwner() {
    if (!ethers.isAddress(newOwnerAddr)) { toast.error('Invalid address'); return }
    const thresh = parseInt(newThreshold) || safeInfo!.threshold
    proposeOwnerChange('Add Owner', encodeAddOwnerWithThreshold(newOwnerAddr, thresh))
  }

  function handleRemoveOwner() {
    if (!ethers.isAddress(removeOwnerAddr)) { toast.error('Invalid address'); return }
    if (!safeInfo) return
    const ownerIndex = safeInfo.owners.findIndex(
      (o) => o.toLowerCase() === removeOwnerAddr.toLowerCase()
    )
    if (ownerIndex < 0) { toast.error('Address is not an owner'); return }
    const prevOwner = ownerIndex === 0
      ? '0x0000000000000000000000000000000000000001'
      : safeInfo.owners[ownerIndex - 1]
    const thresh = parseInt(removeThreshold) || Math.max(safeInfo.threshold - 1, 1)
    proposeOwnerChange('Remove Owner', encodeRemoveOwner(prevOwner, removeOwnerAddr, thresh))
  }

  function handleChangeThreshold() {
    const thresh = parseInt(changeThresholdVal)
    if (!thresh || thresh < 1) { toast.error('Invalid threshold'); return }
    if (safeInfo && thresh > safeInfo.owners.length) { toast.error('Threshold > owners'); return }
    proposeOwnerChange('Change Threshold', encodeChangeThreshold(thresh))
  }

  if (!safeInfo) {
    return (
      <div className="py-12 text-center" style={{ fontFamily: TERM_FONT, fontSize: '14px', color: 'var(--text-tertiary)' }}>
        load a safe first
      </div>
    )
  }

  const makeBtnStyle = (color: string, disabled: boolean): React.CSSProperties => ({
    fontFamily: TERM_FONT,
    fontSize: '14px',
    padding: '10px 16px',
    width: '100%',
    border: `2px solid ${color}`,
    color: color,
    background: 'transparent',
    boxShadow: `3px 3px 0px 0px ${color}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  })

  return (
    <div className="space-y-6">
      {/* Current owners */}
      <TerminalCard label={`SIGNERS (${safeInfo.owners.length})`}>
        <div className="space-y-2 mb-4">
          {safeInfo.owners.map((owner, i) => {
            const isMe = owner.toLowerCase() === walletAddress.toLowerCase()
            return (
              <div key={i} className="flex items-center gap-3 group" style={{ fontSize: '14px' }}>
                <span style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)', width: '20px' }}>{i}</span>
                <span
                  className="flex-1 break-all"
                  style={{
                    fontFamily: TERM_FONT,
                    color: isMe ? 'var(--accent-primary, #10b981)' : 'var(--text-primary)',
                    textShadow: isMe ? '0 0 8px var(--accent-primary, #10b981)' : 'none',
                  }}
                >
                  {owner}
                </span>
                <CopyButton text={owner} size="sm" />
              </div>
            )
          })}
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>
          threshold: {safeInfo.threshold}/{safeInfo.owners.length}
        </div>
      </TerminalCard>

      {/* Add Owner */}
      <TerminalCard label="ADD OWNER">
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>new owner address</label>
            <input type="text" value={newOwnerAddr} onChange={(e) => setNewOwnerAddr(e.target.value)} placeholder="0x..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>new threshold (default: {safeInfo.threshold})</label>
            <input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} placeholder={String(safeInfo.threshold)} style={inputStyle} />
          </div>
          <button
            onClick={handleAddOwner}
            disabled={ownerLoading !== null || !isOwner}
            style={makeBtnStyle('var(--accent-primary, #10b981)', ownerLoading !== null || !isOwner)}
          >
            {ownerLoading === 'Add Owner' ? 'signing...' : '> propose add owner'}
          </button>
        </div>
      </TerminalCard>

      {/* Remove Owner */}
      <TerminalCard label="REMOVE OWNER">
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>owner to remove</label>
            <select value={removeOwnerAddr} onChange={(e) => setRemoveOwnerAddr(e.target.value)} style={{ ...inputStyle, backgroundColor: 'transparent' }}>
              <option value="">select owner...</option>
              {safeInfo.owners.map((o, i) => (
                <option key={i} value={o}>
                  {shorten(o)} {o.toLowerCase() === walletAddress.toLowerCase() ? '(you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>new threshold (default: {Math.max(safeInfo.threshold - 1, 1)})</label>
            <input type="number" value={removeThreshold} onChange={(e) => setRemoveThreshold(e.target.value)} placeholder={String(Math.max(safeInfo.threshold - 1, 1))} style={inputStyle} />
          </div>
          <button
            onClick={handleRemoveOwner}
            disabled={ownerLoading !== null || !isOwner}
            style={makeBtnStyle('var(--accent-error, #ef4444)', ownerLoading !== null || !isOwner)}
          >
            {ownerLoading === 'Remove Owner' ? 'signing...' : '> propose remove owner'}
          </button>
        </div>
      </TerminalCard>

      {/* Change Threshold */}
      <TerminalCard label="CHANGE THRESHOLD">
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>new threshold (current: {safeInfo.threshold})</label>
            <input type="number" value={changeThresholdVal} onChange={(e) => setChangeThresholdVal(e.target.value)} placeholder={String(safeInfo.threshold)} min={1} max={safeInfo.owners.length} style={inputStyle} />
          </div>
          <button
            onClick={handleChangeThreshold}
            disabled={ownerLoading !== null || !isOwner}
            style={makeBtnStyle('#6366f1', ownerLoading !== null || !isOwner)}
          >
            {ownerLoading === 'Change Threshold' ? 'signing...' : '> propose change threshold'}
          </button>
        </div>
      </TerminalCard>

      {!isOwner && (
        <div className="text-center" style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>
          must be a signer to propose owner changes
        </div>
      )}
    </div>
  )
}
