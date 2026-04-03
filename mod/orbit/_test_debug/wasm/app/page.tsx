'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CloudArrowUpIcon, PlayIcon, CubeIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function WasmDeployPage() {
  const [wasmFile, setWasmFile] = useState<File | null>(null)
  const [ipfsCid, setIpfsCid] = useState('')
  const [deployedCid, setDeployedCid] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.wasm')) {
      setWasmFile(file)
      setLoading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/ipfs/upload', { method: 'POST', body: formData })
        const data = await res.json()
        setIpfsCid(data.cid)
      } catch (err) {
        console.error('Upload failed:', err)
      } finally {
        setLoading(false)
      }
    }
  }

  const deployWasm = async () => {
    if (!ipfsCid) return
    setLoading(true)
    try {
      const res = await fetch('/api/wasm/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: ipfsCid })
      })
      const data = await res.json()
      setDeployedCid(data.deployedCid)
    } catch (err) {
      console.error('Deploy failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const runWasm = async () => {
    if (!deployedCid) return
    setLoading(true)
    setOutput('')
    try {
      const res = await fetch('/api/wasm/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: deployedCid })
      })
      const data = await res.json()
      setOutput(data.output || data.error)
    } catch (err) {
      setOutput('Execution failed: ' + err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-16 h-16 flex items-center justify-center bg-purple-500/20 border-2 border-purple-500/60 rounded-xl">
            <CubeIcon className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">WASM Deployer</h1>
            <p className="text-purple-300 text-lg mt-1">Deploy and run WebAssembly modules via IPFS</p>
          </div>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-8 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <CloudArrowUpIcon className="w-8 h-8 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Upload WASM</h2>
          </div>
          <label className="block">
            <input
              type="file"
              accept=".wasm"
              onChange={handleFileUpload}
              className="block w-full text-purple-300 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-2 file:border-purple-500/60 file:bg-purple-500/20 file:text-purple-300 file:font-bold hover:file:bg-purple-500/30 cursor-pointer"
            />
          </label>
          {wasmFile && (
            <div className="mt-4 p-4 bg-black/40 border border-purple-500/40 rounded-lg">
              <p className="text-purple-300">File: <span className="text-white font-mono">{wasmFile.name}</span></p>
              {ipfsCid && (
                <p className="text-green-400 mt-2">IPFS CID: <span className="font-mono">{ipfsCid}</span></p>
              )}
            </div>
          )}
        </motion.div>

        {/* Deploy Section */}
        {ipfsCid && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-xl p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <CubeIcon className="w-8 h-8 text-blue-400" />
              <h2 className="text-2xl font-bold text-white">Deploy</h2>
            </div>
            <button
              onClick={deployWasm}
              disabled={loading}
              className="px-8 py-4 bg-blue-500/40 border-2 border-blue-400/80 rounded-lg text-blue-300 font-bold text-lg hover:bg-blue-500/60 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,150,255,0.4)]"
            >
              {loading ? 'Deploying...' : 'Deploy to Network'}
            </button>
            {deployedCid && (
              <div className="mt-4 p-4 bg-black/40 border border-blue-500/40 rounded-lg">
                <p className="text-green-400">Deployed CID: <span className="font-mono">{deployedCid}</span></p>
              </div>
            )}
          </motion.div>
        )}

        {/* Run Section */}
        {deployedCid && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <PlayIcon className="w-8 h-8 text-green-400" />
              <h2 className="text-2xl font-bold text-white">Execute</h2>
            </div>
            <button
              onClick={runWasm}
              disabled={loading}
              className="px-8 py-4 bg-green-500/40 border-2 border-green-400/80 rounded-lg text-green-300 font-bold text-lg hover:bg-green-500/60 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,255,100,0.4)]"
            >
              {loading ? 'Running...' : 'Run WASM'}
            </button>
          </motion.div>
        )}

        {/* Output Section */}
        {output && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-2 border-orange-500/30 rounded-xl p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <DocumentTextIcon className="w-8 h-8 text-orange-400" />
              <h2 className="text-2xl font-bold text-white">Output</h2>
            </div>
            <pre className="bg-black/60 border border-orange-500/40 rounded-lg p-6 text-orange-300 font-mono text-sm overflow-x-auto">
              {output}
            </pre>
          </motion.div>
        )}
      </div>
    </div>
  )
}
