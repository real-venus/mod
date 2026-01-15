'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import { motion } from 'framer-motion'

// Dynamic ABI loading from IPFS
const loadAbiFromIpfs = async (client: any, cid: string) => {
  try {
    const abiData = await client.call('get', { cid })
    return abiData
  } catch (err) {
    console.error('Error fetching ABI from IPFS:', err)
    throw new Error('Failed to fetch ABI from IPFS')
  }
}

// Contract metadata structure
interface ContractMetadata {
  abi: any
  name: string
  color?: string
  emoji?: string
  address?: string
  abiCid?: string
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

export default function ContractsPage() {
  const { client } = userContext()
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [functionParams, setFunctionParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<Record<string, ContractMetadata>>({})
  const [loadingAbi, setLoadingAbi] = useState<string | null>(null)

  const network = 'testnet'
  const chainConfig = modConfig.chain?.[network]

  // Initialize contracts metadata WITHOUT loading ABIs
  useEffect(() => {
    if (!chainConfig?.contracts) return

    const contractsMetadata: Record<string, ContractMetadata> = {}
    
    for (const [contractName, contractInfo] of Object.entries(chainConfig.contracts)) {
      const info = contractInfo as any
      contractsMetadata[contractName] = {
        abi: null,
        name: contractName,
        color: getContractColor(contractName),
        emoji: getContractEmoji(contractName),
        address: info.address,
        abiCid: info.abi
      }
    }
    
    setContracts(contractsMetadata)
  }, [chainConfig])

  // Load ABI only when contract is selected
  useEffect(() => {
    const loadContractAbi = async () => {
      if (!selectedContract || !client || typeof window === 'undefined') return
      
      const contract = contracts[selectedContract]
      if (!contract || contract.abi) return // Already loaded
      
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
      if (!contract || !contract.abi) {
        throw new Error('Contract ABI not loaded')
      }

      if (!contract.address) {
        throw new Error('Contract address not found')
      }

      const functionAbi = contract.abi.find(
        (item: any) => item.type === 'function' && item.name === selectedFunction
      )

      if (!functionAbi) {
        throw new Error('Function not found in ABI')
      }

      const params = functionAbi.inputs.map((input: any) => functionParams[input.name] || '')
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
    } catch (err: any) {
      console.error('Contract execution error:', err)
      setError(err.message || 'Failed to execute contract function')
    } finally {
      setLoading(false)
    }
  }

  const selectedFunctionData = getContractFunctions().find(f => f.name === selectedFunction)
  const selectedContractData = selectedContract ? contracts[selectedContract] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950/20 to-black text-white p-4 md:p-8" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-6xl font-black mb-3 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            🚀 CONTRACT DROPBOX 🚀
          </h1>
          <p className="text-sm md:text-xl text-gray-400 font-mono">ibm terminal × future bubble vibes</p>
        </motion.div>

        {/* Compact Contract Grid */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <label className="block text-xl md:text-2xl font-black mb-3 text-cyan-400">📜 contracts</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(contracts).map(([key, contract]) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedContract(key)
                  setSelectedFunction('')
                  setFunctionParams({})
                  setResult(null)
                  setError(null)
                }}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selectedContract === key ? 'shadow-xl' : 'hover:border-gray-600'
                }`}
                style={{
                  background: selectedContract === key 
                    ? `linear-gradient(135deg, ${contract.color}40, ${contract.color}20)`
                    : 'rgba(15,23,42,0.6)',
                  borderColor: selectedContract === key ? contract.color : 'rgba(71,85,105,0.3)'
                }}
              >
                <div className="text-3xl mb-1">{contract.emoji}</div>
                <div className="text-sm font-bold" style={{ color: contract.color }}>
                  {contract.name}
                </div>
                {loadingAbi === key && (
                  <div className="text-xs text-yellow-400 mt-1">⏳</div>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Compact Contract Info */}
        {selectedContract && selectedContractData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border-2 border-cyan-500/30"
          >
            <h3 className="text-lg font-bold mb-2 text-cyan-300">📋 info</h3>
            <div className="space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400">addr:</span>
                <span className="font-mono text-xs">{selectedContractData.address?.slice(0, 10)}...{selectedContractData.address?.slice(-8)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400">status:</span>
                <span className="font-mono text-xs">
                  {selectedContractData.abi ? '✅ loaded' : '⏳ loading'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Compact Function Selection */}
        {selectedContract && selectedContractData?.abi && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border-2 border-purple-500/30"
          >
            <label className="block text-lg font-bold mb-2 text-purple-300">⚡ function</label>
            <select
              value={selectedFunction}
              onChange={(e) => {
                setSelectedFunction(e.target.value)
                setFunctionParams({})
                setResult(null)
                setError(null)
              }}
              className="w-full bg-black/60 border-2 border-purple-500/50 rounded-xl px-4 py-2 text-white text-sm font-bold focus:border-purple-400 focus:outline-none"
            >
              <option value="">select...</option>
              {getContractFunctions().map(func => (
                <option key={func.name} value={func.name}>
                  {func.name} ({func.stateMutability})
                </option>
              ))}
            </select>
          </motion.div>
        )}

        {/* Compact Parameters */}
        {selectedFunctionData && selectedFunctionData.inputs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border-2 border-pink-500/30"
          >
            <h3 className="text-lg font-bold mb-2 text-pink-300">🎯 params</h3>
            <div className="space-y-2">
              {selectedFunctionData.inputs.map((input: any) => (
                <div key={input.name}>
                  <label className="block text-sm font-bold mb-1 text-pink-200">
                    {input.name} <span className="text-gray-400 text-xs">({input.type})</span>
                  </label>
                  <input
                    type="text"
                    value={functionParams[input.name] || ''}
                    onChange={(e) => setFunctionParams({
                      ...functionParams,
                      [input.name]: e.target.value
                    })}
                    className="w-full bg-black/60 border-2 border-pink-500/50 rounded-xl px-3 py-2 text-white text-sm focus:border-pink-400 focus:outline-none"
                    placeholder={`${input.type}`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Compact Execute Button */}
        {selectedFunction && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleExecute}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500/40 to-emerald-600/40 text-white text-lg font-black py-3 rounded-2xl hover:from-green-600/50 hover:to-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-green-500/20 border-2 border-green-400/50"
          >
            {loading ? '⏳ exec...' : '🚀 execute'}
          </motion.button>
        )}

        {/* Compact Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-900/40 backdrop-blur-xl border-2 border-red-500/50 rounded-2xl p-3 shadow-xl shadow-red-500/20"
          >
            <p className="text-red-300 text-sm font-bold">❌ {error}</p>
          </motion.div>
        )}

        {/* Compact Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-900/40 backdrop-blur-xl border-2 border-green-500/50 rounded-2xl p-4 shadow-xl shadow-green-500/20"
          >
            <h3 className="text-xl font-black mb-2 text-green-300">✅ result</h3>
            <pre className="text-xs overflow-auto bg-black/60 p-3 rounded-xl border-2 border-green-500/30 text-green-200 font-mono max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          </motion.div>
        )}
      </div>
    </div>
  )
}
