'use client'

import { useState, useEffect } from 'react'

interface ModuleInfo {
  name: string
  description: string
  status: 'online' | 'offline' | 'loading'
  result: any
}

export default function ModulePage({ params }: { params: { mod: string } }) {
  const { mod } = params
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo>({
    name: mod,
    description: '',
    status: 'loading',
    result: null,
  })
  const [inputA, setInputA] = useState('1')
  const [inputB, setInputB] = useState('2')
  const [output, setOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch module info from the Python backend
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/${mod}/info`)
        if (res.ok) {
          const data = await res.json()
          setModuleInfo(prev => ({ ...prev, ...data, status: 'online' }))
        } else {
          setModuleInfo(prev => ({
            ...prev,
            description: 'Uniswap GraphQL scraper',
            status: 'offline',
          }))
        }
      } catch {
        setModuleInfo(prev => ({
          ...prev,
          description: 'Uniswap GraphQL scraper',
          status: 'offline',
        }))
      }
    }
    fetchInfo()
  }, [mod])

  const handleRun = async () => {
    setLoading(true)
    setOutput(null)
    try {
      const res = await fetch(`/api/${mod}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: Number(inputA), b: Number(inputB) }),
      })
      const data = await res.json()
      setOutput(JSON.stringify(data, null, 2))
    } catch (err: any) {
      setOutput(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`w-3 h-3 rounded-full ${
                moduleInfo.status === 'online'
                  ? 'bg-green-400'
                  : moduleInfo.status === 'offline'
                  ? 'bg-red-400'
                  : 'bg-yellow-400 animate-pulse'
              }`}
            />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
              {mod}
            </h1>
          </div>
          <p className="text-gray-400 text-sm ml-6">
            {moduleInfo.description || 'Loading module info...'}
          </p>
        </div>

        {/* Module Card */}
        <div
          className="rounded-lg p-6 mb-6"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
          }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--accent)' }}>
            forward(a, b)
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">a</label>
              <input
                type="number"
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                className="w-full px-3 py-2 rounded border bg-black text-white"
                style={{ borderColor: 'var(--card-border)' }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">b</label>
              <input
                type="number"
                value={inputB}
                onChange={(e) => setInputB(e.target.value)}
                className="w-full px-3 py-2 rounded border bg-black text-white"
                style={{ borderColor: 'var(--card-border)' }}
              />
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={loading}
            className="px-6 py-2 rounded font-bold transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: '#000',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--accent-dim)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'var(--accent)')
            }
          >
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>

        {/* Output */}
        {output !== null && (
          <div
            className="rounded-lg p-6"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
            }}
          >
            <h3 className="text-sm text-gray-400 mb-2">Output</h3>
            <pre className="text-sm overflow-auto" style={{ color: 'var(--accent)' }}>
              {output}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-600">
          <p>
            module: <span style={{ color: 'var(--accent)' }}>{mod}</span> | port: 8860
          </p>
        </div>
      </div>
    </main>
  )
}
