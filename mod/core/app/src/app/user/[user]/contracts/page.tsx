'use client'

import { useState } from 'react'
import { userContext } from '@/mod/context'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import { motion } from 'framer-motion'

// Import contract ABIs
import BlocTimeABI from '@/mod/contracts/abi/bloctime/BlocTime.sol/BlocTime.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'
import RegistryABI from '@/mod/contracts/abi/registry/Registry.sol/Registry.json'
import TokenGateABI from '@/mod/contracts/abi/tokengate/TokenGate.sol/TokenGate.json'
import TokenABI from '@/mod/contracts/abi/token/Token.sol/Token.json'
import ManualPriceOracleABI from '@/mod/contracts/abi/oracles/ManualPriceOracle.sol/ManualPriceOracle.json'

const CONTRACTS = {
  BlocTime: { abi: BlocTimeABI.abi, name: 'BlocTime', color: '#00ff88', emoji: '⏰' },
  Market: { abi: MarketABI.abi, name: 'Market', color: '#ff0088', emoji: '🏪' },
  Registry: { abi: RegistryABI.abi, name: 'Registry', color: '#0088ff', emoji: '📋' },
  TokenGate: { abi: TokenGateABI.abi, name: 'TokenGate', color: '#ff8800', emoji: '🚪' },
  NativeToken: { abi: TokenABI.abi, name: 'NativeToken', color: '#8800ff', emoji: '💎' },
  USDC: { abi: TokenABI.abi, name: 'USDC', color: '#2775ca', emoji: '💵' },
  USDT: { abi: TokenABI.abi, name: 'USDT', color: '#26a17b', emoji: '💴' },
  ManualPriceOracle: { abi: ManualPriceOracleABI.abi, name: 'ManualPriceOracle', color: '#ffaa00', emoji: '🔮' }
}

export default function ContractsPage() {
  const { client } = userContext()
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [functionParams, setFunctionParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [network, setNetwork] = useState<'ganache' | 'testnet'>('testnet')
  const [viewCode, setViewCode] = useState(false)

  const getContractAddress = (contractName: string) => {
    if (typeof window === 'undefined') return ''
    return modConfig.contracts?.[network]?.[contractName] || ''
  }

  const getContractFunctions = () => {
    if (!selectedContract) return []
    const contract = CONTRACTS[selectedContract as keyof typeof CONTRACTS]
    if (!contract) return []
    
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
      const contractAddress = getContractAddress(selectedContract)
      if (!contractAddress) {
        throw new Error('Contract address not found')
      }

      const contract = CONTRACTS[selectedContract as keyof typeof CONTRACTS]
      const functionAbi = contract.abi.find(
        (item: any) => item.type === 'function' && item.name === selectedFunction
      )

      if (!functionAbi) {
        throw new Error('Function not found in ABI')
      }

      const params = functionAbi.inputs.map((input: any) => functionParams[input.name] || '')
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const contractInstance = new ethers.Contract(contractAddress, contract.abi, signer)

      let txResult
      if (functionAbi.stateMutability === 'view' || functionAbi.stateMutability === 'pure') {
        txResult = await contractInstance[selectedFunction](...params)
      } else {
        const tx = await contractInstance[selectedFunction](...params)
        const receipt = await tx.wait()
        txResult = receipt
      }

      setResult(txResult)
    } catch (err: any) {
      console.error('Contract execution error:', err)
      setError(err.message || 'Failed to execute contract function')
    } finally {
      setLoading(false)
    }
  }

  const selectedFunctionData = getContractFunctions().find(f => f.name === selectedFunction)
  const contractAddress = selectedContract ? getContractAddress(selectedContract) : ''
  const contractData = selectedContract ? CONTRACTS[selectedContract as keyof typeof CONTRACTS] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950/20 to-black text-white p-8" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-6xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            🚀 CONTRACT INTERFACE 🚀
          </h1>
          <p className="text-xl text-gray-400 font-mono">interact with blockchain contracts like a boss</p>
        </motion.div>

        {/* Network Selection */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/10"
        >
          <label className="block text-2xl font-bold mb-4 text-cyan-300">🌐 network</label>
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setNetwork('testnet')}
              className={`flex-1 px-8 py-4 rounded-2xl text-xl font-bold transition-all ${
                network === 'testnet'
                  ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 text-white shadow-lg shadow-cyan-500/30 border-2 border-cyan-400'
                  : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 border-2 border-slate-600/30'
              }`}
            >
              🌍 testnet
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setNetwork('ganache')}
              className={`flex-1 px-8 py-4 rounded-2xl text-xl font-bold transition-all ${
                network === 'ganache'
                  ? 'bg-gradient-to-r from-cyan-600/40 to-blue-600/40 text-white shadow-lg shadow-cyan-500/30 border-2 border-cyan-400'
                  : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 border-2 border-slate-600/30'
              }`}
            >
              🔧 ganache
            </motion.button>
          </div>
        </motion.div>

        {/* Contract Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <label className="block text-3xl font-black mb-6 text-cyan-400">📜 available contracts</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(CONTRACTS).map(([key, contract]) => {
              const address = getContractAddress(key)
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedContract(key)
                    setSelectedFunction('')
                    setFunctionParams({})
                    setResult(null)
                    setError(null)
                  }}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    selectedContract === key
                      ? 'shadow-2xl'
                      : 'hover:border-gray-600'
                  }`}
                  style={{
                    background: selectedContract === key 
                      ? `linear-gradient(135deg, ${contract.color}40, ${contract.color}20)`
                      : 'rgba(15,23,42,0.6)',
                    borderColor: selectedContract === key ? contract.color : 'rgba(71,85,105,0.3)'
                  }}
                >
                  <div className="text-5xl mb-3">{contract.emoji}</div>
                  <div className="text-xl font-bold" style={{ color: contract.color }}>
                    {contract.name}
                  </div>
                  {address && (
                    <div className="text-xs text-gray-500 mt-2 font-mono truncate">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* Function Selection */}
        {selectedContract && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-3xl p-8 border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10"
          >
            <label className="block text-2xl font-bold mb-4 text-purple-300">⚡ select function</label>
            <select
              value={selectedFunction}
              onChange={(e) => {
                setSelectedFunction(e.target.value)
                setFunctionParams({})
                setResult(null)
                setError(null)
              }}
              className="w-full bg-black/60 border-2 border-purple-500/50 rounded-2xl px-6 py-4 text-white text-xl font-bold focus:border-purple-400 focus:outline-none"
            >
              <option value="">choose a function...</option>
              {getContractFunctions().map(func => (
                <option key={func.name} value={func.name}>
                  {func.name} ({func.stateMutability})
                </option>
              ))}
            </select>
          </motion.div>
        )}

        {/* Function Parameters */}
        {selectedFunctionData && selectedFunctionData.inputs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-900/60 to-slate-800/40 backdrop-blur-xl rounded-3xl p-8 border-2 border-pink-500/30 shadow-2xl shadow-pink-500/10"
          >
            <h3 className="text-2xl font-bold mb-6 text-pink-300">🎯 parameters</h3>
            <div className="space-y-4">
              {selectedFunctionData.inputs.map((input: any) => (
                <div key={input.name}>
                  <label className="block text-lg font-bold mb-2 text-pink-200">
                    {input.name} <span className="text-gray-400">({input.type})</span>
                  </label>
                  <input
                    type="text"
                    value={functionParams[input.name] || ''}
                    onChange={(e) => setFunctionParams({
                      ...functionParams,
                      [input.name]: e.target.value
                    })}
                    className="w-full bg-black/60 border-2 border-pink-500/50 rounded-2xl px-6 py-4 text-white text-lg focus:border-pink-400 focus:outline-none"
                    placeholder={`enter ${input.type}`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Execute Button */}
        {selectedFunction && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExecute}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500/40 to-emerald-600/40 text-white text-2xl font-black py-6 rounded-3xl hover:from-green-600/50 hover:to-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-green-500/20 border-2 border-green-400/50"
          >
            {loading ? '⏳ executing...' : '🚀 execute contract'}
          </motion.button>
        )}

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-900/40 backdrop-blur-xl border-2 border-red-500/50 rounded-3xl p-6 shadow-2xl shadow-red-500/20"
          >
            <p className="text-red-300 text-xl font-bold">❌ {error}</p>
          </motion.div>
        )}

        {/* Result Display */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-900/40 backdrop-blur-xl border-2 border-green-500/50 rounded-3xl p-8 shadow-2xl shadow-green-500/20"
          >
            <h3 className="text-3xl font-black mb-4 text-green-300">✅ result</h3>
            <pre className="text-lg overflow-auto bg-black/60 p-6 rounded-2xl border-2 border-green-500/30 text-green-200 font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </motion.div>
        )}
      </div>
    </div>
  )
}
