'use client'

import { useState } from 'react'
import { userContext } from '@/mod/context'
import { ethers } from 'ethers'

// Import contract ABIs
import BlocTimeABI from '@/mod/contracts/abi/bloctime/BlocTime.sol/BlocTime.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'
import RegistryABI from '@/mod/contracts/abi/registry/Registry.sol/Registry.json'
import TokenGateABI from '@/mod/contracts/abi/tokengate/TokenGate.sol/TokenGate.json'
import TreasuryABI from '@/mod/contracts/abi/treasury/Treasury.sol/Treasury.json'
import TokenABI from '@/mod/contracts/abi/token/Token.sol/Token.json'

const CONTRACTS = {
  BlocTime: { abi: BlocTimeABI.abi, name: 'BlocTime' },
  Market: { abi: MarketABI.abi, name: 'Market' },
  Registry: { abi: RegistryABI.abi, name: 'Registry' },
  TokenGate: { abi: TokenGateABI.abi, name: 'TokenGate' },
  Treasury: { abi: TreasuryABI.abi, name: 'Treasury' },
  NativeToken: { abi: TokenABI.abi, name: 'NativeToken' },
  USDC: { abi: TokenABI.abi, name: 'USDC' },
  USDT: { abi: TokenABI.abi, name: 'USDT' }
}

export default function ContractsInterface() {
  const { client } = userContext()
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [functionParams, setFunctionParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get contract addresses from mod.json
  const getContractAddress = (contractName: string) => {
    if (typeof window === 'undefined') return ''
    const network = 'ganache' // or get from context
    const modConfig = require('@/app/mod.json')
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

      // Prepare parameters
      const params = functionAbi.inputs.map((input: any) => functionParams[input.name] || '')

      // Execute contract call
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const contractInstance = new ethers.Contract(contractAddress, contract.abi, signer)

      let txResult
      if (functionAbi.stateMutability === 'view' || functionAbi.stateMutability === 'pure') {
        // Read-only call
        txResult = await contractInstance[selectedFunction](...params)
      } else {
        // Transaction
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-6">Contract Interactions</h1>

        {/* Contract Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Select Contract</label>
          <select
            value={selectedContract}
            onChange={(e) => {
              setSelectedContract(e.target.value)
              setSelectedFunction('')
              setFunctionParams({})
              setResult(null)
              setError(null)
            }}
            className="w-full bg-black border-2 border-white/30 rounded px-4 py-2 text-white"
          >
            <option value="">Choose a contract...</option>
            {Object.keys(CONTRACTS).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Function Selection */}
        {selectedContract && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Select Function</label>
            <select
              value={selectedFunction}
              onChange={(e) => {
                setSelectedFunction(e.target.value)
                setFunctionParams({})
                setResult(null)
                setError(null)
              }}
              className="w-full bg-black border-2 border-white/30 rounded px-4 py-2 text-white"
            >
              <option value="">Choose a function...</option>
              {getContractFunctions().map(func => (
                <option key={func.name} value={func.name}>
                  {func.name} ({func.stateMutability})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Function Parameters */}
        {selectedFunctionData && selectedFunctionData.inputs.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Parameters</h3>
            {selectedFunctionData.inputs.map((input: any) => (
              <div key={input.name} className="space-y-2">
                <label className="block text-sm">
                  {input.name} ({input.type})
                </label>
                <input
                  type="text"
                  value={functionParams[input.name] || ''}
                  onChange={(e) => setFunctionParams({
                    ...functionParams,
                    [input.name]: e.target.value
                  })}
                  className="w-full bg-black border-2 border-white/30 rounded px-4 py-2 text-white"
                  placeholder={`Enter ${input.type}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Execute Button */}
        {selectedFunction && (
          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded hover:bg-white/90 disabled:opacity-50"
          >
            {loading ? 'Executing...' : 'Execute'}
          </button>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border-2 border-red-500 rounded p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="bg-green-500/10 border-2 border-green-500 rounded p-4">
            <h3 className="text-lg font-medium mb-2">Result</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
