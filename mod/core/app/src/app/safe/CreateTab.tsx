"use client"

import { useState } from 'react'
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { GlowCard } from './GlowCard'
import { ACCENT, inputClass, btnClass } from './shared'
import { createSafe } from '@/network/safe'

export function CreateTab({
  walletAddress,
  onSafeCreated,
}: {
  walletAddress: string
  onSafeCreated: (address: string) => void
}) {
  const [factoryAddress, setFactoryAddress] = useState('')
  const [singletonAddress, setSingletonAddress] = useState('')
  const [owners, setOwners] = useState<string[]>([walletAddress || ''])
  const [threshold, setThreshold] = useState(1)
  const [creating, setCreating] = useState(false)

  const addOwner = () => {
    setOwners([...owners, ''])
  }

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
    <div className="space-y-4">
      <GlowCard color={ACCENT} delay={0.1}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">Deploy Contracts</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">SafeProxyFactory Address</label>
            <input
              type="text"
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              placeholder="0x..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1 block">Safe Singleton Address</label>
            <input
              type="text"
              value={singletonAddress}
              onChange={(e) => setSingletonAddress(e.target.value)}
              placeholder="0x..."
              className={inputClass}
            />
          </div>
        </div>
      </GlowCard>

      <GlowCard color={ACCENT} delay={0.15}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70">Owners</h2>
          <button
            onClick={addOwner}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-all"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {owners.map((owner, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white/30 w-5 text-center shrink-0">{idx + 1}</span>
              <input
                type="text"
                value={owner}
                onChange={(e) => updateOwner(idx, e.target.value)}
                placeholder="0x..."
                className={`${inputClass} flex-1`}
              />
              {owners.length > 1 && (
                <button
                  onClick={() => removeOwner(idx)}
                  className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </GlowCard>

      <GlowCard color={ACCENT} delay={0.2}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-3">Threshold</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={owners.length}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, Math.min(owners.length, parseInt(e.target.value) || 1)))}
            className={`${inputClass} w-20 text-center`}
          />
          <span className="text-white/40 text-sm">of {owners.length} owner{owners.length !== 1 ? 's' : ''} required to confirm</span>
        </div>
      </GlowCard>

      <button
        onClick={handleCreate}
        disabled={creating}
        className={`${btnClass} w-full py-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 flex items-center justify-center gap-2`}
      >
        {creating ? (
          <>
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            Deploying Safe...
          </>
        ) : (
          <>
            <PlusIcon className="w-4 h-4" />
            Create Safe
          </>
        )}
      </button>
    </div>
  )
}
