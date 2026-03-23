'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { Registry, ModEntry, getEvmNetworks, getDefaultNetwork, parseDataUri, gatewayUrl } from '@/network/registry'
import { NetworkSelector } from '@/components/NetworkSelector'
import { ModCard } from '@/components/ModCard'
import { RegisterForm } from '@/components/RegisterForm'
import { WalletButton } from '@/components/WalletButton'

export default function Home() {
  const [network, setNetwork] = useState(getDefaultNetwork())
  const [mods, setMods] = useState<ModEntry[]>([])
  const [userMods, setUserMods] = useState<number[]>([])
  const [wallet, setWallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [tab, setTab] = useState<'all' | 'mine'>('all')

  const registry = new Registry(network)

  // ── Load mods ──────────────────────────────────────────────────────────

  const loadMods = useCallback(async () => {
    setLoading(true)
    try {
      const all = await registry.listAll()
      setMods(all)
      if (wallet) {
        const ids = await registry.getUserMods(wallet)
        setUserMods(ids)
      }
    } catch (err: any) {
      console.error('Failed to load mods:', err)
    } finally {
      setLoading(false)
    }
  }, [network, wallet])

  useEffect(() => { loadMods() }, [loadMods])

  // ── Wallet ─────────────────────────────────────────────────────────────

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setWallet(accounts[0])
      toast.success('Wallet connected')
    } catch {
      toast.error('Connection rejected')
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────

  const onRegister = async (name: string, data: string) => {
    try {
      const id = await registry.registerMod(name, data)
      toast.success(`Registered: #${id}`)
      setShowRegister(false)
      loadMods()
    } catch (err: any) {
      toast.error(err.reason || err.message || 'Registration failed')
    }
  }

  const onRemove = async (modId: number) => {
    try {
      await registry.removeMod(modId)
      toast.success(`Removed mod #${modId}`)
      loadMods()
    } catch (err: any) {
      toast.error(err.reason || err.message || 'Remove failed')
    }
  }

  const onUpdate = async (modId: number, data: string) => {
    try {
      await registry.updateMod(modId, data)
      toast.success(`Updated mod #${modId}`)
      loadMods()
    } catch (err: any) {
      toast.error(err.reason || err.message || 'Update failed')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const displayMods = tab === 'mine'
    ? mods.filter(m => userMods.includes(m.id))
    : mods

  return (
    <main className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-accent">Registry</h1>
          <NetworkSelector value={network} onChange={setNetwork} />
        </div>
        <div className="flex items-center gap-3">
          {wallet && (
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="px-4 py-2 bg-accent text-black font-semibold rounded-lg hover:bg-accent-dim"
            >
              {showRegister ? 'Cancel' : '+ Register'}
            </button>
          )}
          <WalletButton wallet={wallet} onConnect={connectWallet} />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Register Form */}
        {showRegister && wallet && (
          <div className="mb-8">
            <RegisterForm onSubmit={onRegister} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-border">
          <button
            onClick={() => setTab('all')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === 'all' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            All Modules ({mods.length})
          </button>
          {wallet && (
            <button
              onClick={() => setTab('mine')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                tab === 'mine' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              My Modules ({userMods.length})
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayMods.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No modules registered yet</p>
            <p className="text-sm mt-2">Connect wallet and register the first one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayMods.map(mod => (
              <ModCard
                key={mod.id}
                mod={mod}
                isOwner={wallet?.toLowerCase() === mod.owner.toLowerCase()}
                onRemove={() => onRemove(mod.id)}
                onUpdate={(data) => onUpdate(mod.id, data)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
