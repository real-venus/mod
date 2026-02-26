"use client"

import { useState } from 'react'
import { ethers } from 'ethers'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { GlowCard } from './GlowCard'
import { ACCENT, inputClass, inputStyle, selectClass, btnClass } from './shared'
import { shorten } from '@/utils'
import {
  proposeSafeTransaction,
  encodeAddOwnerWithThreshold,
  encodeRemoveOwner,
  encodeChangeThreshold,
  type SafeInfo,
} from '@/network/safe'
import { toast } from 'react-toastify'

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
      <GlowCard color={ACCENT}>
        <p className="text-center py-4" style={{ color: 'var(--text-tertiary)' }}>Load a Safe first</p>
      </GlowCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Current owners */}
      <GlowCard color={ACCENT} delay={0.1}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">
          Current Owners ({safeInfo.owners.length})
        </h2>
        <div className="space-y-2">
          {safeInfo.owners.map((owner, i) => {
            const isMe = owner.toLowerCase() === walletAddress.toLowerCase()
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : ''
                }`}
                style={!isMe ? { backgroundColor: 'var(--bg-input)' } : undefined}
              >
                {isMe && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                <span className="font-mono text-sm flex-1 break-all" style={{ color: 'var(--text-primary)' }}>{owner}</span>
                <CopyButton text={owner} size="sm" />
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Threshold: {safeInfo.threshold}/{safeInfo.owners.length}
        </div>
      </GlowCard>

      {/* Add Owner */}
      <GlowCard color="#10b981" delay={0.15}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500/70 mb-3 flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Add Owner
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>New Owner Address</label>
            <input type="text" value={newOwnerAddr} onChange={(e) => setNewOwnerAddr(e.target.value)} placeholder="0x..." className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>New Threshold (default: current)</label>
            <input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} placeholder={String(safeInfo.threshold)} className={inputClass} style={inputStyle} />
          </div>
          <button
            onClick={handleAddOwner}
            disabled={ownerLoading !== null || !isOwner}
            className={`${btnClass} w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30`}
          >
            {ownerLoading === 'Add Owner' ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Propose Add Owner'}
          </button>
        </div>
      </GlowCard>

      {/* Remove Owner */}
      <GlowCard color="#ef4444" delay={0.2}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-red-500/70 mb-3 flex items-center gap-2">
          <MinusIcon className="w-4 h-4" /> Remove Owner
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>Owner to Remove</label>
            <select value={removeOwnerAddr} onChange={(e) => setRemoveOwnerAddr(e.target.value)} className={selectClass} style={inputStyle}>
              <option value="">Select owner...</option>
              {safeInfo.owners.map((o, i) => (
                <option key={i} value={o}>
                  {shorten(o)} {o.toLowerCase() === walletAddress.toLowerCase() ? '(you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>New Threshold (default: {Math.max(safeInfo.threshold - 1, 1)})</label>
            <input type="number" value={removeThreshold} onChange={(e) => setRemoveThreshold(e.target.value)} placeholder={String(Math.max(safeInfo.threshold - 1, 1))} className={inputClass} style={inputStyle} />
          </div>
          <button
            onClick={handleRemoveOwner}
            disabled={ownerLoading !== null || !isOwner}
            className={`${btnClass} w-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30`}
          >
            {ownerLoading === 'Remove Owner' ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Propose Remove Owner'}
          </button>
        </div>
      </GlowCard>

      {/* Change Threshold */}
      <GlowCard color="#3b82f6" delay={0.25}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-500/70 mb-3 flex items-center gap-2">
          <ShieldCheckIcon className="w-4 h-4" /> Change Threshold
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>New Threshold (current: {safeInfo.threshold})</label>
            <input type="number" value={changeThresholdVal} onChange={(e) => setChangeThresholdVal(e.target.value)} placeholder={String(safeInfo.threshold)} min={1} max={safeInfo.owners.length} className={inputClass} style={inputStyle} />
          </div>
          <button
            onClick={handleChangeThreshold}
            disabled={ownerLoading !== null || !isOwner}
            className={`${btnClass} w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30`}
          >
            {ownerLoading === 'Change Threshold' ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Propose Change Threshold'}
          </button>
        </div>
      </GlowCard>

      {!isOwner && (
        <div className="flex items-center gap-2 justify-center text-sm text-amber-500/50">
          <ExclamationTriangleIcon className="w-4 h-4" />
          You must be a Safe signer to propose owner changes
        </div>
      )}
    </div>
  )
}
