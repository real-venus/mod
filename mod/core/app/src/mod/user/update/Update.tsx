'use client'
import React, { useState, useEffect } from 'react'
import {
  RefreshCw,
  Zap,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react'
import { userContext } from '@/mod/context/UserContext'
import { ModuleType } from '@/mod/types'

export const Update: React.FC = (defaultMod : string = '') => {
  const { network, user, client } = userContext()
  const [onchainMods, setOnchainMods] = useState<ModuleType[]>([])
  const [allMods, setAllMods] = useState<ModuleType[]>([])
  const [selectedMod, setSelectedMod] = useState<string>(defaultMod)
  const [modName, setModName] = useState('')
  const [modId, setModId] = useState<string | null>(null)
  const [modData, setModData] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [balance, setBalance] = useState<string>('0')
  const [updateType, setUpdateType] = useState<'local' | 'onchain'>('onchain')

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
    const fetchMods = async () => {
      if (!client) return
      try {
        const response = await client.call('mods', {})
        setAllMods(response)
        const onchain = response.filter((mod: ModuleType) => mod.net != 'local')
        setOnchainMods(onchain)
      } catch (err) {
        console.error('Failed to fetch modules:', err)
      }
    }
    fetchMods()
  }, [client])

  const populateFields = (mod: ModuleType) => {
    setModName(mod.name || '')
    setModData(mod.cid || '')
    setModId(String(mod.id || 0))
  }

  const handleModSelect = (modName: string) => {
    setSelectedMod(modName)
    
    const targetMods = updateType === 'onchain' ? onchainMods : allMods
    const mod = targetMods.find(m => m.name === modName)
    if (mod) populateFields(mod)
  }

  const fetchBalance = async (address: string) => {
    try {
      const formatedBalance: string = (await network.balance(address)).toFixed(6)
      setBalance(formatedBalance)
    } catch (err) {
      console.error('Balance fetch error:', err)
    }
  }

  const executeUpdateLocal = async () => {
    if (!modName || !modData) return setError('Please fill in all required fields')
    if (!client) return setError('Client not initialized')

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const updatePayload = {
        name: modName,
        cid: modData,
      }

      const result = await client.call('update_mod', { mod: updatePayload })
      setResponse(result)
    } catch (err: any) {
      let msg = err?.message || String(err)
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const executeUpdateOnchain = async () => {
    if (!modName || !modData) return setError('Please fill in all required fields')
    if (!walletAddress) return setError('No wallet connected')

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const result = await network.update(
        walletAddress,
        modName,
        modData,
        parseInt(modId || '0')

      )

      setResponse({
        ...result,
        name: modName,
        data: modData,
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

  const handleUpdate = () => {
    if (updateType === 'local') {
      executeUpdateLocal()
    } else {
      executeUpdateOnchain()
    }
  }

  const availableMods = updateType === 'onchain' ? onchainMods : allMods

  return (
    <div className="space-y-6 animate-fadeIn">


      <div className="space-y-5 p-6 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border-2 border-blue-500/30 shadow-2xl">

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setUpdateType('local')
              setSelectedMod('')
              setModName('')
              setModData('')
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border ${
              updateType === 'local'
                ? 'bg-blue-500/30 text-blue-300 border-blue-500'
                : 'bg-black/60 text-blue-500/60 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50'
            }`}
          >
            API
          </button>
          <button
            onClick={() => {
              setUpdateType('onchain')
              setSelectedMod('')
              setModName('')
              setModData('')
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border ${
              updateType === 'onchain'
                ? 'bg-blue-500/30 text-blue-300 border-blue-500'
                : 'bg-black/60 text-blue-500/60 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50'
            }`}
          >
            {network?.url ? network.url.split('//')[1]?.split('.')[0]?.toUpperCase() || 'CHAIN' : 'CHAIN'}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-blue-400 font-mono uppercase font-bold tracking-wide">
            Select Module to Update
          </label>
          <select
            value={selectedMod}
            onChange={(e) => handleModSelect(e.target.value)}
            className="w-full bg-black/60 border-2 border-blue-500/40 rounded-lg px-4 py-3 text-blue-300 font-mono text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
          >
            {availableMods.map((mod) => (
              <option key={mod.name} value={mod.name}>
                {mod.name}
              </option>
            ))}
          </select>
          {availableMods.length === 0 && (
            <p className="text-blue-400/60 text-sm font-mono mt-2">
              No {updateType} modules found. Please register a module first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
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
        </div>

        <button
          onClick={handleUpdate}
          disabled={!selectedMod || !modName || !modData || isLoading || (updateType === 'onchain' && !walletAddress)}
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
              <span>UPDATE {updateType === 'onchain' ? 'ONCHAIN' : 'LOCALLY'}</span>
            </>
          )}
        </button>
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

export default Update