'use client'

import { useState, useRef, useEffect } from 'react'
import { API_URL } from './config'

type Skill = { description: string; params: Record<string, any> }
type Message = { role: 'user' | 'agent' | 'system'; text: string; steps?: any[] }

export default function Home() {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [skills, setSkills] = useState<Record<string, Skill>>({})
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_URL}/skills`)
      .then(r => r.json())
      .then(d => setSkills(d.schemas || {}))
      .catch(() => setMessages([{ role: 'system', text: 'Server offline. Start with: uvicorn server:app --port 50117' }]))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const run = async () => {
    if (!query.trim() || loading) return
    const q = query.trim()
    setQuery('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      setMessages(m => [...m, {
        role: 'agent',
        text: data.result?.length
          ? `Completed ${data.result.length} step(s)`
          : 'Done',
        steps: data.result,
      }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'system', text: `Error: ${e.message}` }])
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent</h1>
          <p className="text-sm text-gray-400">mod agentic framework</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(skills).map(s => (
            <span key={s} className="glass px-2 py-1 rounded text-xs text-gray-300">{s}</span>
          ))}
        </div>
      </header>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-4xl mb-4">{'>'}_</p>
            <p>Ask the agent anything. It has {Object.keys(skills).length} skills.</p>
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              {['read this file', 'search for TODO', 'run ls -la', 'find all .py files'].map(ex => (
                <button key={ex} onClick={() => setQuery(ex)}
                  className="glass px-3 py-1 rounded-full text-sm hover:bg-white/10 transition">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-3xl ${msg.role === 'user' ? 'ml-auto' : ''}`}>
            <div className={`rounded-lg px-4 py-3 ${
              msg.role === 'user' ? 'bg-blue-600/20 border border-blue-500/30' :
              msg.role === 'system' ? 'bg-red-600/10 border border-red-500/20' :
              'glass'
            }`}>
              <div className="text-xs text-gray-400 mb-1">{msg.role}</div>
              <div className="whitespace-pre-wrap">{msg.text}</div>
              {msg.steps && (
                <div className="mt-2 space-y-1">
                  {msg.steps.map((step: any, j: number) => (
                    <div key={j} className="text-xs glass rounded px-2 py-1">
                      <span className="text-blue-400">{step.tool}</span>
                      {step.result && (
                        <pre className="text-gray-400 mt-1 overflow-x-auto max-h-40">
                          {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}
                        </pre>
                      )}
                      {step.error && <span className="text-red-400 ml-2">{step.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="glass rounded-lg px-4 py-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-gray-400 text-sm">Agent working...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="border-t border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Ask the agent..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-blue-500/50 transition"
            disabled={loading}
          />
          <button onClick={run} disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-lg font-medium transition">
            Run
          </button>
        </div>
      </div>
    </main>
  )
}
