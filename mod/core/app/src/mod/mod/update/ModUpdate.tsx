'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { ModuleType } from '@/mod/types'
import { Clock, GitBranch, Hash, RotateCcw, ArrowUpDown, RefreshCw, Zap, CheckCircle, AlertCircle, Save } from 'lucide-react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { text2color } from '@/mod/utils'

interface ModUpdateProps {
  mod: ModuleType
}

interface Version {
  cid: string
  comment: string | null
  updated: string
}

export const ModUpdate: React.FC<ModUpdateProps> = ({ mod }) => {
  const { network, user, client } = userContext()
  const [modName, setModName] = useState(mod.name || '')
  const [modData, setModData] = useState(mod.cid || '')
  const [modUrl, setModUrl] = useState(mod.url || '')
  const [take, setTake] = useState(String(mod.take || 0))
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [balance, setBalance] = useState<string>('0')
  const [versions, setVersions] = useState<Version[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [sortAsc, setSortAsc] = useState(false)

  const modColor = text2color(mod.name || mod.key)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const address = user?.key || ''
    const mode = localStorage.getItem('wallet_mode')
    if (mode === 'subwallet' && address) {
      setWalletAddress(address)
      fetchBalance(address)
    }
  }, [user])

  useEffect(() => {
    setModName(mod.name || '')
    setModData(mod.cid || '')
    setModUrl(mod.url || '')
    setTake(String(mod.take || 0))
  }, [mod])

  useEffect(() => {
    const fetchVersions = async () => {
      if (!client || !mod.key) return
      setLoadingVersions(true)
      try {
        const vers = await client.call('versions', { key: mod.key, mod: mod.name })
        setVersions(Array.isArray(vers) ? vers : [])
      } catch (err: any) {
        console.error('Failed to load versions:', err)
      } finally {
        setLoadingVersions(false)
      }
    }
    fetchVersions()
  }, [client, mod.key])

  const fetchBalance = async (address: string) => {
    try {
      const formatedBalance: string = (await network.balance(address)).toFixed(6)
      setBalance(formatedBalance)
    } catch (err) {
      console.error('Balance fetch error:', err)
    }
  }

  const executeUpdate = async () => {
    if (!modName || !modData || !modUrl) return setError('Please fill in all required fields')
    if (!walletAddress) return setError('No wallet connected')

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const result = await network.update(
        walletAddress,
        modName,
        modData,
        modUrl,
        parseInt(take)
      )

      setResponse({
        ...result,
        name: modName,
        data: modData,
        url: modUrl,
        take: parseInt(take),
      })
      await fetchBalance(walletAddress)
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.includes('1010'))
        msg = 'Insufficient balance for fees.'
      else if (msg.toLowerCase().includes('cancel'))
        msg = 'Transaction cancelled by user.'
      else if (msg.includes('timeout'))
        msg = 'Transaction timeout. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetVersion = async (cid: string, versionNum: number) => {
    if (!client || !mod.key) return
    try {
      await client.call('set_version', { key: mod.key, mod: mod.name, cid })
      setModData(cid)
    } catch (err: any) {
      alert(`Failed to set version: ${err?.message || 'Unknown error'}`)
    }
  }

  const sortedVersions = [...versions].sort((a, b) => {
    const timeA = new Date(a.updated).getTime()
    const timeB = new Date(b.updated).getTime()
    return sortAsc ? timeA - timeB : timeB - timeA
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div
        className={`p-4 rounded-xl border-2 ${
          walletAddress
            ? 'bg-gradient-to-br from-emerald-500/10 border-emerald-500/40'
            : 'bg-gradient-to-br from-red-500/10 border-red-500/40'
        }`}
      >
        {walletAddress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono font-bold">
                <CheckCircle size={18} />
                <span>WALLET CONNECTED</span>
              </div>
              <div className="text-emerald-300 text-base font-mono font-bold">
                {balance} <span className="text-emerald-500">MOD</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400 text-sm font-mono font-bold">
            <AlertCircle size={18} />
            <span>NO WALLET CONNECTED</span>
          </div>
        )}
      </div>

      <div className="space-y-5 p-6 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border-2 border-blue-500/30 shadow-2xl">
        <div className="flex items-center gap-3 pb-4 border-b-2 border-blue-500/30">
          <RefreshCw size={24} className="text-blue-400" />
          <h3 className="text-2xl font-black text-blue-400 font-mono uppercase tracking-wide">Update Module</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-blue-400 font-mono uppercase font-bold tracking-wide">
              Module Name
            </label>
            <input
              type="text"
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              disabled={isLoading}
              placeholder="my-module"
              className="w-full bg-black/60 border-2 border-blue-500/40 rounded-lg px-4 py-3 text-blue-300 font-mono text-base placeholder-blue-600/50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-blue-400 font-mono uppercase font-bold tracking-wide">
              Take (%)
            </label>
            <input
              type="number"
              value={take}
              onChange={(e) => setTake(e.target.value)}
              disabled={isLoading}
              min="0"
              max="100"
              placeholder="0"
              className="w-full bg-black/60 border-2 border-blue-500/40 rounded-lg px-4 py-3 text-blue-300 font-mono text-base placeholder-blue-600/50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-blue-400 font-mono uppercase font-bold tracking-wide">
              Data (CID)
            </label>
            <input
              type="text"
              value={modData}
              onChange={(e) => setModData(e.target.value)}
              disabled={isLoading}
              placeholder="QmXxx..."
              className="w-full bg-black/60 border-2 border-blue-500/40 rounded-lg px-4 py-3 text-blue-300 font-mono text-base placeholder-blue-600/50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-blue-400 font-mono uppercase font-bold tracking-wide">
              URL
            </label>
            <input
              type="text"
              value={modUrl}
              onChange={(e) => setModUrl(e.target.value)}
              disabled={isLoading}
              placeholder="https://..."
              className="w-full bg-black/60 border-2 border-blue-500/40 rounded-lg px-4 py-3 text-blue-300 font-mono text-base placeholder-blue-600/50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition-all"
            />
          </div>
        </div>

        <button
          onClick={executeUpdate}
          disabled={!modName || !modData || !modUrl || isLoading || !walletAddress}
          className="w-full py-4 border-2 border-blue-500/60 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 hover:bg-blue-500/30 hover:border-blue-500 hover:scale-[1.02] transition-all duration-300 rounded-xl font-mono uppercase font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-lg"
        >
          {isLoading ? (
            <>
              <Zap size={20} className="animate-spin" />
              <span>PROCESSING...</span>
            </>
          ) : (
            <>
              <Save size={20} />
              <span>UPDATE MODULE</span>
            </>
          )}
        </button>
      </div>

      <div className="rounded-xl border-2 font-mono" style={{ backgroundColor: `${modColor}15`, borderColor: modColor }}>
        <div className="flex items-center justify-between p-3 border-b-2" style={{ borderColor: modColor }}>
          <h3 className="text-xl font-black" style={{ color: modColor, letterSpacing: '0.02em' }}>Versions</h3>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all flex items-center gap-2 text-xs font-semibold border"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: modColor, borderColor: `${modColor}40` }}
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
        {loadingVersions ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: modColor }} />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-center py-8 text-base" style={{ color: `${modColor}80` }}>No versions found</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2 p-3" style={{ scrollbarWidth: 'thin' }}>
            {sortedVersions.map((ver, idx) => {
              const originalIdx = versions.length - versions.indexOf(ver)
              return (
                <div
                  key={versions.indexOf(ver)}
                  className="p-3 rounded-lg border-2 hover:bg-opacity-90 transition-all"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: `${modColor}40` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-black/40 border rounded px-2 py-1" style={{ borderColor: `${modColor}40` }}>
                          <GitBranch className="w-4 h-4 flex-shrink-0" style={{ color: modColor }} />
                          <span className="font-black text-sm" style={{ color: modColor }}>v{originalIdx}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-black/40 border border-blue-500/30 rounded px-2 py-1">
                          <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#3b82f6' }} />
                          <span className="text-xs text-blue-400 font-mono">{ver.updated}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-black/40 border border-green-500/30 rounded px-2 py-1">
                        <Hash className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                        <code className="text-xs font-mono" style={{ color: '#10b981' }}>
                          {ver.cid.slice(0, 12)}...{ver.cid.slice(-8)}
                        </code>
                        <CopyButton text={ver.cid} size="sm" />
                      </div>
                      {ver.comment && (
                        <p className="text-xs truncate" style={{ color: `${modColor}80` }}>{ver.comment}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSetVersion(ver.cid, originalIdx)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 flex-shrink-0 border"
                      style={{ backgroundColor: '#10b981', color: '#fff', borderColor: '#10b981' }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Set
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {(response || error) && (
        <div
          className={`space-y-4 p-6 rounded-xl border-2 shadow-2xl ${
            error
              ? 'from-red-500/10 border-red-500/40 bg-gradient-to-br'
              : 'from-emerald-500/10 border-emerald-500/40 bg-gradient-to-br'
          }`}
        >
          <div className="flex items-center gap-3 text-base font-mono uppercase font-bold">
            {error ? (
              <>
                <AlertCircle size={20} className="text-red-500" />
                <span className="text-red-500">ERROR</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} className="text-emerald-500" />
                <span className="text-emerald-500">SUCCESS</span>
              </>
            )}
          </div>

          {error ? (
            <div className="text-red-400 font-mono text-base bg-black/60 p-4 rounded-lg border-2 border-red-500/30 whitespace-pre-wrap font-bold">
              {error}
            </div>
          ) : (
            <pre className="text-emerald-400 font-mono text-sm overflow-x-auto bg-black/60 p-4 rounded-lg border-2 border-emerald-500/30">
{JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default ModUpdate
