"use client";

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'react-toastify'
import {
  CubeTransparentIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  RocketLaunchIcon,
  SignalIcon,
  SignalSlashIcon,
  LinkIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8800'

interface ModInfo {
  name: string
  api_port: number
  app_port: number
  api_url: string
  app_url: string
  alive: boolean
}

interface ContractInfo {
  [key: string]: { address: string; contract: string; abi?: string }
}

interface NetworkDeployment {
  chainId: string
  deployer: string
  url: string
  contract_count: number
  contracts: { [key: string]: string }
}

async function api(path: string, params: Record<string, any> = {}, method = 'GET') {
  const opts: RequestInit = method === 'GET'
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }

  const res = await fetch(`${API_URL}/${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const fmtAddr = (s: string) => s && s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : (s || '--')

const MOD_COLORS: Record<string, string> = {
  token: 'text-emerald-400',
  oracle: 'text-amber-400',
  registry: 'text-cyan-400',
  perms: 'text-violet-400',
  tokengate: 'text-rose-400',
  bloctime: 'text-sky-400',
  treasury: 'text-lime-400',
  market: 'text-orange-400',
  debit: 'text-pink-400',
  safe: 'text-teal-400',
  bridge: 'text-indigo-400',
}

function ChainHubInner() {
  const [mods, setMods] = useState<ModInfo[]>([])
  const [deployments, setDeployments] = useState<Record<string, NetworkDeployment>>({})
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [network, setNetwork] = useState('testnet')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [modsData, statusData] = await Promise.all([
        api('mods').catch(() => ({ mods: [] })),
        api('status').catch(() => ({ deployments: {} })),
      ])
      setMods(modsData.mods || [])
      setDeployments(statusData.deployments || {})
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const iv = setInterval(fetchAll, 10000)
    return () => clearInterval(iv)
  }, [fetchAll])

  const handleDeploy = useCallback(async (modNames?: string[]) => {
    setDeploying(true)
    try {
      const result = await api('deploy', {
        network,
        mods: modNames || null,
      }, 'POST')
      toast.success('Deploy complete')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.message || 'Deploy failed')
    }
    setDeploying(false)
  }, [network, fetchAll])

  const currentDeployment = deployments[network]
  const contractCount = currentDeployment?.contract_count || 0
  const aliveCount = mods.filter(m => m.alive).length

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e5e5e5] font-mono">
      <div className="relative z-10 p-4 md:p-6 max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between border border-white/10 rounded-lg p-4 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <CubeTransparentIcon className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider uppercase">Chain Hub</h1>
              <p className="text-xs text-white/40 uppercase tracking-wider">Modular Contract Ecosystem</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={network}
              onChange={e => setNetwork(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/70 focus:outline-none font-mono"
            >
              <option value="testnet">Testnet (Base Sepolia)</option>
              <option value="ganache">Ganache (Local)</option>
              <option value="mainnet">Mainnet (Base)</option>
            </select>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
          <div className="p-4 text-center border-r border-white/[0.06]">
            <p className="text-lg font-bold text-cyan-400 tabular-nums">{mods.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Modules</p>
          </div>
          <div className="p-4 text-center border-r border-white/[0.06]">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{contractCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Contracts Deployed</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{aliveCount}/{mods.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">APIs Running</p>
          </div>
        </div>

        {/* Deploy Controls */}
        <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RocketLaunchIcon className="w-4 h-4 text-white/40" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Deploy Controls</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeploy()}
                disabled={deploying}
                className="px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500/25 disabled:opacity-30 transition-colors flex items-center gap-2"
              >
                {deploying ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <RocketLaunchIcon className="w-3.5 h-3.5" />}
                Deploy All
              </button>
            </div>
          </div>
          {currentDeployment && (
            <div className="mt-3 text-xs text-white/30">
              <span>Chain: {currentDeployment.chainId}</span>
              <span className="mx-2">|</span>
              <span>Deployer: {fmtAddr(currentDeployment.deployer)}</span>
              <span className="mx-2">|</span>
              <span>RPC: {currentDeployment.url}</span>
            </div>
          )}
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mods.map((mod) => {
            const contracts = currentDeployment?.contracts || {}
            const colorClass = MOD_COLORS[mod.name] || 'text-white/70'
            return (
              <div
                key={mod.name}
                className="border border-white/10 rounded-lg p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                {/* Module Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ServerStackIcon className={`w-4 h-4 ${colorClass}`} />
                    <span className={`text-sm font-bold uppercase tracking-wider ${colorClass}`}>
                      {mod.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {mod.alive ? (
                      <SignalIcon className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <SignalSlashIcon className="w-3.5 h-3.5 text-white/20" />
                    )}
                    <span className={`text-[9px] uppercase tracking-wider ${mod.alive ? 'text-emerald-400/70' : 'text-white/20'}`}>
                      {mod.alive ? 'Live' : 'Off'}
                    </span>
                  </div>
                </div>

                {/* Ports */}
                <div className="flex gap-3 mb-3 text-[10px] text-white/30">
                  <span>API: {mod.api_port}</span>
                  <span>App: {mod.app_port}</span>
                </div>

                {/* Links */}
                <div className="flex gap-2">
                  {mod.alive && (
                    <>
                      <a
                        href={`${mod.api_url}/docs`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-1.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                      >
                        API Docs
                      </a>
                      <a
                        href={mod.app_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-1.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                      >
                        Open App
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => handleDeploy([mod.name])}
                    disabled={deploying}
                    className="flex-1 py-1.5 rounded border border-cyan-500/20 bg-cyan-500/5 text-[9px] font-bold uppercase tracking-wider text-cyan-400/50 hover:bg-cyan-500/15 hover:text-cyan-300 disabled:opacity-30 transition-colors"
                  >
                    Deploy
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contracts Table */}
        {currentDeployment && Object.keys(currentDeployment.contracts).length > 0 && (
          <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Deployed Contracts — {network}
              </span>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {Object.entries(currentDeployment.contracts).map(([name, address]) => (
                <div key={name} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <span className="text-xs font-bold text-white/60">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30 font-mono tabular-nums">{fmtAddr(address)}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(address); toast.success('Copied') }}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                      <LinkIcon className="w-3 h-3 text-white/20" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-white/15 uppercase tracking-wider py-4">
          Chain Hub — Modular Contract Ecosystem
        </div>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(ChainHubInner), { ssr: false })
