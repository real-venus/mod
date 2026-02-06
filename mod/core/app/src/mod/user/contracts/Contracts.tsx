'use client'

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/mod/context'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import { motion, AnimatePresence } from 'framer-motion'
import { CopyButton } from '@/mod/ui/CopyButton'
import RegistryABI from '@/mod/contracts/abi/registry/Registry.sol/Registry.json'

const loadAbiFromIpfs = async (client: any, cid: string) => {
  try {
    const abiData = await client.call('get', { cid })
    return abiData
  } catch (err) {
    console.error('Error fetching ABI from IPFS:', err)
    throw new Error('Failed to fetch ABI from IPFS')
  }
}

interface ContractMetadata {
  abi: any
  name: string
  color?: string
  emoji?: string
  address?: string
  abiCid?: string
}

interface UserMod {
  modId: string
  name: string
  data: string
  owner: string
}

const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return obj.toString()
  if (Array.isArray(obj)) return obj.map(serializeBigInt)
  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key])
    }
    return serialized
  }
  return obj
}

export default function ContractsInterface() {
  const { client, user } = userContext()
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [functionParams, setFunctionParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<Record<string, ContractMetadata>>({})
  const [loadingAbi, setLoadingAbi] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showContractDropdown, setShowContractDropdown] = useState(false)
  const [showNetworkInfo, setShowNetworkInfo] = useState(true)
  const [showContractInfo, setShowContractInfo] = useState(true)
  const [userMods, setUserMods] = useState<UserMod[]>([])
  const [loadingMods, setLoadingMods] = useState(false)
  const [selectedModId, setSelectedModId] = useState<string>('')
  const [editingModData, setEditingModData] = useState<string>('')
  
  const contractDropdownRef = useRef<HTMLDivElement>(null)

  const network = 'testnet'
  const chainConfig = modConfig.chain?.[network]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contractDropdownRef.current && !contractDropdownRef.current.contains(event.target as Node)) {
        setShowContractDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!chainConfig?.contracts) return
    const contractsMetadata: Record<string, ContractMetadata> = {}
    for (const [contractName, contractInfo] of Object.entries(chainConfig.contracts)) {
      const info = contractInfo as any
      contractsMetadata[contractName] = {
        abi: contractName === 'Registry' ? RegistryABI.abi : null,
        name: contractName,
        color: getContractColor(contractName),
        emoji: getContractEmoji(contractName),
        address: info.address,
        abiCid: info.abi
      }
    }
    setContracts(contractsMetadata)
  }, [chainConfig])

  useEffect(() => {
    const loadContractAbi = async () => {
      if (!selectedContract || !client || typeof window === 'undefined') return
      const contract = contracts[selectedContract]
      if (!contract || contract.abi) return
      if (!contract.abiCid) {
        setError('No ABI CID found for this contract')
        return
      }
      setLoadingAbi(selectedContract)
      setError(null)
      try {
        const abiData = await loadAbiFromIpfs(client, contract.abiCid)
        setContracts(prev => ({
          ...prev,
          [selectedContract]: {
            ...prev[selectedContract],
            abi: abiData
          }
        }))
      } catch (err) {
        console.error(`Failed to load ABI for ${selectedContract}:`, err)
        setError(`Failed to load ABI for ${selectedContract}`)
      } finally {
        setLoadingAbi(null)
      }
    }
    loadContractAbi()
  }, [selectedContract, client])

  const fetchUserMods = async () => {
    if (!user?.key || !selectedContract || selectedContract !== 'Registry') return
    const contract = contracts['Registry']
    if (!contract?.abi || !contract?.address) return
    
    setLoadingMods(true)
    try {
      if (!window.ethereum) throw new Error('MetaMask not detected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const registryContract = new ethers.Contract(contract.address, contract.abi, provider)
      const modIds = await registryContract.getUserMods(user.key)
      
      const modsData: UserMod[] = []
      for (const modId of modIds) {
        const [owner, data] = await registryContract.getMod(modId)
        modsData.push({
          modId: modId.toString(),
          name: `Mod #${modId.toString()}`,
          data: data,
          owner: owner
        })
      }
      setUserMods(modsData)
    } catch (err: any) {
      console.error('Failed to fetch user mods:', err)
      setError(err.message || 'Failed to fetch user mods')
    } finally {
      setLoadingMods(false)
    }
  }

  useEffect(() => {
    if (selectedContract === 'Registry' && user?.key) {
      fetchUserMods()
    }
  }, [selectedContract, user?.key])

  const handleUpdateMod = async () => {
    if (!selectedModId || !editingModData || !user?.key) return
    
    setLoading(true)
    setError(null)
    try {
      const contract = contracts['Registry']
      if (!contract?.abi || !contract?.address) throw new Error('Registry contract not loaded')
      
      if (!window.ethereum) throw new Error('MetaMask not detected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const registryContract = new ethers.Contract(contract.address, contract.abi, signer)
      
      const tx = await registryContract.updateMod(selectedModId, editingModData)
      const receipt = await tx.wait()
      
      setResult({ success: true, txHash: receipt.hash, modId: selectedModId })
      await fetchUserMods()
      setSelectedModId('')
      setEditingModData('')
    } catch (err: any) {
      console.error('Update mod error:', err)
      setError(err.message || 'Failed to update mod')
    } finally {
      setLoading(false)
    }
  }

  const getContractColor = (name: string): string => {
    const colors: Record<string, string> = {
      BlocTime: '#00ff88',
      Market: '#ff0088',
      Registry: '#0088ff',
      TokenGate: '#ff8800',
      NativeToken: '#8800ff',
      USDC: '#2775ca',
      USDT: '#26a17b',
      ManualPriceOracle: '#ffaa00'
    }
    return colors[name] || '#ffffff'
  }

  const getContractEmoji = (name: string): string => {
    const emojis: Record<string, string> = {
      BlocTime: '⏰',
      Market: '🏪',
      Registry: '📋',
      TokenGate: '🚪',
      NativeToken: '💎',
      USDC: '💵',
      USDT: '💴',
      ManualPriceOracle: '🔮'
    }
    return emojis[name] || '📄'
  }

  const getContractFunctions = () => {
    if (!selectedContract || !contracts[selectedContract]) return []
    const contract = contracts[selectedContract]
    if (!contract || !contract.abi) return []
    return contract.abi
      .filter((item: any) => item.type === 'function')
      .map((item: any) => ({
        name: item.name,
        inputs: item.inputs || [],
        outputs: item.outputs || [],
        stateMutability: item.stateMutability
      }))
  }

  const handleExecute = async () => {
    if (!selectedContract || !selectedFunction || !client) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const contract = contracts[selectedContract]
      if (!contract || !contract.abi) throw new Error('Contract ABI not loaded')
      if (!contract.address) throw new Error('Contract address not found')
      const functionAbi = contract.abi.find(
        (item: any) => item.type === 'function' && item.name === selectedFunction
      )
      if (!functionAbi) throw new Error('Function not found in ABI')
      
      const params = functionAbi.inputs.map((input: any) => {
        if (functionParams[input.name] !== undefined && functionParams[input.name] !== '') {
          return functionParams[input.name]
        }
        if (input.type === 'address' && user?.key) {
          return user.key
        }
        return ''
      })
      
      if (!window.ethereum) throw new Error('MetaMask not detected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractInstance = new ethers.Contract(contract.address, contract.abi, signer)
      let txResult
      if (functionAbi.stateMutability === 'view' || functionAbi.stateMutability === 'pure') {
        txResult = await contractInstance[selectedFunction](...params)
      } else {
        const tx = await contractInstance[selectedFunction](...params)
        const receipt = await tx.wait()
        txResult = receipt
      }
      setResult(serializeBigInt(txResult))
      if (selectedContract === 'Registry') {
        await fetchUserMods()
      }
    } catch (err: any) {
      console.error('Contract execution error:', err)
      setError(err.message || 'Failed to execute contract function')
    } finally {
      setLoading(false)
    }
  }

  const selectedFunctionData = getContractFunctions().find((f: any) => f.name === selectedFunction)
  const selectedContractData = selectedContract ? contracts[selectedContract] : null
  const filteredContracts = Object.entries(contracts).filter(([key, contract]) =>
    contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contract.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black text-white p-4" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-5xl mx-auto space-y-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
          <h1 className="text-4xl font-black mb-3 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            🚀 CONTRACTS 🚀
          </h1>
          <p className="text-sm text-gray-400 font-mono">minimal • steve approved</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-lg border border-green-500/30">
          <button
            onClick={() => setShowNetworkInfo(!showNetworkInfo)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🌐</span>
              <h3 className="text-base font-bold text-green-300">NETWORK</h3>
            </div>
            <span className="text-green-300 text-sm">{showNetworkInfo ? '▼' : '▶'}</span>
          </button>
          {showNetworkInfo && (
            <div className="px-3 pb-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-semibold text-xs">NET:</span>
                <span className="font-mono text-xs text-green-400">{network.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-semibold text-xs">USER:</span>
                <span className="font-mono text-xs truncate max-w-[300px]">{user?.key || 'Not connected'}</span>
                {user?.key && <CopyButton text={user.key} size="sm" />}
              </div>
            </div>
          )}
        </motion.div>

        {selectedContract && selectedContractData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-lg border border-cyan-500/30">
            <button
              onClick={() => setShowContractInfo(!showContractInfo)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">📋</span>
                <h3 className="text-base font-bold text-cyan-300">CONTRACT</h3>
              </div>
              <span className="text-cyan-300 text-sm">{showContractInfo ? '▼' : '▶'}</span>
            </button>
            {showContractInfo && (
              <div className="px-3 pb-3 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-semibold text-xs">ADDR:</span>
                  <span className="font-mono text-xs truncate max-w-[300px]">{selectedContractData.address}</span>
                  <CopyButton text={selectedContractData.address || ''} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-semibold text-xs">ABI:</span>
                  <span className="font-mono text-xs truncate max-w-[300px]">{selectedContractData.abiCid}</span>
                  <CopyButton text={selectedContractData.abiCid || ''} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-semibold text-xs">STATUS:</span>
                  <span className="font-mono text-xs">
                    {selectedContractData.abi ? '✅ loaded' : '⏳ loading'}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {selectedContract === 'Registry' && userMods.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-lg border border-purple-500/30 p-4">
            <h3 className="text-xl font-bold text-purple-300 mb-4">📝 YOUR MODS</h3>
            <div className="space-y-3">
              {userMods.map((mod) => (
                <div key={mod.modId} className="bg-black/60 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-purple-300">{mod.name}</span>
                    <button
                      onClick={() => {
                        setSelectedModId(mod.modId)
                        setEditingModData(mod.data)
                      }}
                      className="px-3 py-1 bg-purple-500/30 hover:bg-purple-500/50 rounded-lg text-sm font-bold transition-all"
                    >
                      ✏️ EDIT
                    </button>
                  </div>
                  <div className="text-sm text-gray-400 font-mono">
                    <div>ID: {mod.modId}</div>
                    <div>DATA: {mod.data}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {selectedModId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-lg border border-orange-500/30 p-4">
            <h3 className="text-xl font-bold text-orange-300 mb-4">✏️ EDIT MOD #{selectedModId}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-base font-bold mb-2 text-orange-200">MOD DATA</label>
                <textarea
                  value={editingModData}
                  onChange={(e) => setEditingModData(e.target.value)}
                  className="w-full bg-black/60 border border-orange-500/50 rounded-lg px-4 py-3 text-white text-base focus:border-orange-400 focus:outline-none min-h-[100px]"
                  placeholder="Enter new mod data..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleUpdateMod}
                  disabled={loading || !editingModData}
                  className="flex-1 bg-gradient-to-r from-orange-500/40 to-red-600/40 text-white text-lg font-black py-3 rounded-lg hover:from-orange-600/50 hover:to-red-700/50 disabled:opacity-50 border border-orange-400/50"
                >
                  {loading ? '⏳ updating...' : '💾 UPDATE MOD'}
                </button>
                <button
                  onClick={() => {
                    setSelectedModId('')
                    setEditingModData('')
                  }}
                  className="px-6 bg-gray-700/40 text-white text-lg font-black py-3 rounded-lg hover:bg-gray-600/50 border border-gray-500/50"
                >
                  ❌ CANCEL
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-lg border border-blue-500/30 p-3">
          <h3 className="text-base font-bold text-blue-300 mb-2">👤 USER</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={user?.key || ''}
              readOnly
              className="flex-1 bg-black/60 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm font-mono"
              placeholder="Connect wallet"
            />
            {user?.key && <CopyButton text={user.key} size="sm" />}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative" ref={contractDropdownRef}>
            <input
              type="text"
              placeholder="🔍 search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowContractDropdown(true)}
              className="w-full bg-black/80 border border-cyan-500/50 rounded-lg px-4 py-4 text-white text-base font-bold focus:border-cyan-400 focus:outline-none transition-all"
            />
            {showContractDropdown && filteredContracts.length > 0 && (
              <div className="absolute w-full mt-1 bg-gray-900 border-2 border-cyan-400/60 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
                {filteredContracts.map(([key, contract]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedContract(key)
                      setSelectedFunction('')
                      setFunctionParams({})
                      setResult(null)
                      setError(null)
                      setSearchTerm(contract.name)
                      setShowContractDropdown(false)
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-white/20 text-white transition-all border-l-4"
                    style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      borderLeftColor: contract.color,
                      fontSize: '1.1rem'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{contract.emoji}</span>
                      <div className="flex-1">
                        <div className="font-bold text-lg" style={{ color: contract.color }}>{contract.name}</div>
                        <div className="text-sm text-gray-500 font-mono">
                          {contract.address?.slice(0, 10)}...{contract.address?.slice(-8)}
                        </div>
                      </div>
                      {loadingAbi === key && <span className="text-yellow-400 text-xl">⏳</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedContract && selectedContractData?.abi && (
            <div className="flex-1">
              <select
                value={selectedFunction}
                onChange={(e) => {
                  setSelectedFunction(e.target.value)
                  setFunctionParams({})
                  setResult(null)
                  setError(null)
                }}
                className="w-full bg-black/80 border border-purple-500/50 rounded-lg px-4 py-4 text-white text-base font-bold focus:border-purple-400 focus:outline-none transition-all"
              >
                <option value="">⚡ select function...</option>
                {getContractFunctions().map((func: any) => (
                  <option key={func.name} value={func.name}>
                    {func.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedContract && selectedFunctionData && selectedFunctionData.inputs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-lg p-5 border border-pink-500/30"
            >
              <h3 className="text-xl font-bold mb-4 text-pink-300">🎯 parameters</h3>
              <div className="grid grid-cols-2 gap-4">
                {selectedFunctionData.inputs.map((input: any, index: number) => (
                  <div key={input.name}>
                    <label className="block text-base font-bold mb-2 text-pink-200">
                      {input.name} <span className="text-gray-500">({input.type})</span>
                      {input.type === 'address' && index === 0 && user?.key && (
                        <span className="text-xs text-green-400 ml-2">✓ defaults to your address</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={functionParams[input.name] || ''}
                      onChange={(e) => setFunctionParams({ ...functionParams, [input.name]: e.target.value })}
                      className="w-full bg-black/60 border border-pink-500/50 rounded-lg px-4 py-3 text-white text-base focus:border-pink-400 focus:outline-none"
                      placeholder={input.type === 'address' && index === 0 && user?.key ? user.key : input.type}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedFunction && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleExecute}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500/40 to-emerald-600/40 text-white text-lg font-black py-4 rounded-lg hover:from-green-600/50 hover:to-emerald-700/50 disabled:opacity-50 border border-green-400/50"
          >
            {loading ? '⏳ executing...' : '🚀 execute'}
          </motion.button>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-900/40 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-300 text-base font-bold">❌ {error}</p>
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-900/40 border border-green-500/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black text-green-300">✅ result</h3>
              <CopyButton text={JSON.stringify(result, null, 2)} size="md" />
            </div>
            <pre className="text-sm overflow-auto bg-black/60 p-3 rounded-lg border border-green-500/30 text-green-200 font-mono max-h-48">
              {JSON.stringify(result, null, 2)}
            </pre>
          </motion.div>
        )}
      </div>
    </div>
  )
}
