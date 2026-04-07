'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { API_URL } from './config'

type Tab = 'chat' | 'agents' | 'status' | 'logs' | 'config'
type Message = { role: 'user' | 'agent' | 'system'; text: string; ts: number }
type Status = { container?: string; gateway_port?: number; api_port?: number; doctor?: string; agents?: any[] }

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('chat')
  const [connected, setConnected] = useState<boolean | null>(null)

  // chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [activeAgent, setActiveAgent] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // agents state
  const [agents, setAgents] = useState<any[]>([])
  const [newAgent, setNewAgent] = useState({ name: '', model: 'claude', thinking: 'medium' })
  const [agentLoading, setAgentLoading] = useState(false)

  // status state
  const [status, setStatus] = useState<Status | null>(null)

  // logs state
  const [logs, setLogs] = useState('')

  // config state
  const [configData, setConfigData] = useState('')
  const [configKey, setConfigKey] = useState('')
  const [configValue, setConfigValue] = useState('')

  // ── connectivity check ────────────────────────────────────────────
  useEffect(() => {
    api('/status')
      .then(s => { setConnected(true); setStatus(s) })
      .catch(() => setConnected(false))
  }, [])

  // ── auto scroll chat ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── data loaders ──────────────────────────────────────────────────
  const loadAgents = useCallback(async () => {
    try {
      const d = await api('/agents')
      setAgents(d.agents || [])
    } catch { setAgents([]) }
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      const s = await api('/status')
      setStatus(s)
      setConnected(true)
    } catch { setConnected(false) }
  }, [])

  const loadLogs = useCallback(async () => {
    try {
      const d = await api('/logs?lines=200')
      setLogs(d.logs || '')
    } catch (e: any) { setLogs(`Error: ${e.message}`) }
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      const d = await api('/config')
      setConfigData(d.config || JSON.stringify(d, null, 2))
    } catch (e: any) { setConfigData(`Error: ${e.message}`) }
  }, [])

  // load data when tab changes
  useEffect(() => {
    if (tab === 'agents') loadAgents()
    if (tab === 'status') loadStatus()
    if (tab === 'logs') loadLogs()
    if (tab === 'config') loadConfig()
  }, [tab, loadAgents, loadStatus, loadLogs, loadConfig])

  // ── chat ──────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || sending) return
    const msg = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', text: msg, ts: Date.now() }])
    setSending(true)
    try {
      const d = await api('/send', {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          agent: activeAgent || undefined,
        }),
      })
      setMessages(m => [...m, {
        role: d.status === 'ok' ? 'agent' : 'system',
        text: d.response || d.error || 'No response',
        ts: Date.now(),
      }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'system', text: `Error: ${e.message}`, ts: Date.now() }])
    }
    setSending(false)
  }

  // ── create agent ──────────────────────────────────────────────────
  const createAgent = async () => {
    if (!newAgent.name.trim()) return
    setAgentLoading(true)
    try {
      await api('/agent', {
        method: 'POST',
        body: JSON.stringify(newAgent),
      })
      setNewAgent({ name: '', model: 'claude', thinking: 'medium' })
      await loadAgents()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    }
    setAgentLoading(false)
  }

  // ── lifecycle actions ─────────────────────────────────────────────
  const doAction = async (path: string, method = 'POST') => {
    try {
      const d = await api(path, { method })
      await loadStatus()
      return d
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    }
  }

  // ── tabs config ───────────────────────────────────────────────────
  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'agents', label: 'Agents' },
    { id: 'status', label: 'Status' },
    { id: 'logs', label: 'Logs' },
    { id: 'config', label: 'Config' },
  ]

  return (
    <main className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-claw-red">OpenClaw</h1>
          <div className={`w-2 h-2 rounded-full ${connected === true ? 'bg-green-500' : connected === false ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-xs text-gray-500">
            {connected === true ? status?.container || 'connected' : connected === false ? 'offline' : 'checking...'}
          </span>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded text-xs border border-transparent transition ${
                tab === t.id ? 'tab-active' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ─── CHAT TAB ──────────────────────────────────────────── */}
        {tab === 'chat' && (
          <div className="flex-1 flex flex-col">
            {/* agent selector */}
            <div className="px-6 py-2 border-b border-white/5 flex items-center gap-3">
              <span className="text-xs text-gray-500">Agent:</span>
              <input
                value={activeAgent}
                onChange={e => setActiveAgent(e.target.value)}
                placeholder="default"
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-40 outline-none focus:border-claw-red/50"
              />
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-20">
                  <p className="text-4xl mb-4 text-claw-red">{'/>'}_</p>
                  <p className="text-sm">Send a message to an OpenClaw agent</p>
                  <div className="mt-4 flex gap-2 justify-center flex-wrap">
                    {['hello', 'what can you do?', 'list your tools', 'help me code'].map(ex => (
                      <button key={ex} onClick={() => setInput(ex)}
                        className="glass px-3 py-1 rounded-full text-xs hover:bg-white/10 transition">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`max-w-3xl ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                  <div className={`rounded-lg px-4 py-3 ${
                    msg.role === 'user' ? 'bg-claw-red/10 border border-claw-red/20' :
                    msg.role === 'system' ? 'bg-yellow-600/10 border border-yellow-500/20' :
                    'glass'
                  }`}>
                    <div className="text-[10px] text-gray-500 mb-1">
                      {msg.role} {activeAgent && msg.role === 'agent' ? `(${activeAgent})` : ''}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="glass rounded-lg px-4 py-3 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-claw-red rounded-full animate-pulse" />
                    <span className="text-gray-400 text-xs">Agent thinking...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* input */}
            <div className="border-t border-white/10 px-6 py-3">
              <div className="max-w-3xl mx-auto flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Message the agent..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-claw-red/50 transition"
                  disabled={sending}
                />
                <button onClick={send} disabled={sending}
                  className="bg-claw-red hover:bg-red-500 disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-medium transition">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── AGENTS TAB ────────────────────────────────────────── */}
        {tab === 'agents' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* create agent */}
            <div className="glass rounded-lg p-4">
              <h2 className="text-sm font-medium text-claw-orange mb-3">Create Agent</h2>
              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Name</label>
                  <input
                    value={newAgent.name}
                    onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="mybot"
                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-40 outline-none focus:border-claw-orange/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Model</label>
                  <select
                    value={newAgent.model}
                    onChange={e => setNewAgent({ ...newAgent, model: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm outline-none"
                  >
                    {['claude', 'deepseek', 'gpt-4o', 'llama', 'mixtral'].map(m => (
                      <option key={m} value={m} className="bg-gray-900">{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Thinking</label>
                  <select
                    value={newAgent.thinking}
                    onChange={e => setNewAgent({ ...newAgent, thinking: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm outline-none"
                  >
                    {['low', 'medium', 'high'].map(t => (
                      <option key={t} value={t} className="bg-gray-900">{t}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={createAgent}
                  disabled={agentLoading || !newAgent.name.trim()}
                  className="bg-claw-orange hover:bg-orange-500 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition"
                >
                  {agentLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            {/* agents list */}
            <div className="glass rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-claw-orange">Agents</h2>
                <button onClick={loadAgents} className="text-xs text-gray-400 hover:text-white transition">refresh</button>
              </div>
              {agents.length === 0 ? (
                <p className="text-xs text-gray-500">No agents found. Create one or start the container.</p>
              ) : (
                <div className="space-y-2">
                  {agents.map((a: any, i: number) => {
                    const name = typeof a === 'string' ? a : a.name || `agent-${i}`
                    return (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                        <div>
                          <span className="text-sm">{name}</span>
                          {typeof a === 'object' && a.model && (
                            <span className="text-xs text-gray-500 ml-2">{a.model}</span>
                          )}
                        </div>
                        <button
                          onClick={() => { setActiveAgent(name); setTab('chat') }}
                          className="text-xs text-claw-red hover:text-red-400 transition"
                        >
                          chat
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── STATUS TAB ────────────────────────────────────────── */}
        {tab === 'status' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="glass rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-claw-green">System Status</h2>
                <button onClick={loadStatus} className="text-xs text-gray-400 hover:text-white transition">refresh</button>
              </div>
              {status ? (
                <div className="space-y-2 text-sm">
                  <Row label="Container" value={status.container || '?'} ok={status.container === 'running'} />
                  <Row label="Gateway Port" value={String(status.gateway_port || '?')} />
                  <Row label="API Port" value={String(status.api_port || '?')} />
                  {status.doctor && <Row label="Doctor" value={status.doctor} />}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Loading...</p>
              )}
            </div>

            {/* actions */}
            <div className="glass rounded-lg p-4">
              <h2 className="text-sm font-medium text-claw-green mb-3">Actions</h2>
              <div className="flex gap-2 flex-wrap">
                <ActionBtn label="Setup" color="green" onClick={() => doAction('/setup')} />
                <ActionBtn label="Restart" color="blue" onClick={() => doAction('/restart')} />
                <ActionBtn label="Stop" color="red" onClick={() => doAction('/kill')} />
                <ActionBtn label="Gateway Restart" color="purple" onClick={() => doAction('/gateway', 'POST')} />
                <ActionBtn label="Run Test" color="blue" onClick={async () => {
                  const d = await api('/test')
                  alert(JSON.stringify(d, null, 2))
                }} />
              </div>
            </div>
          </div>
        )}

        {/* ─── LOGS TAB ──────────────────────────────────────────── */}
        {tab === 'logs' && (
          <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-claw-purple">Container Logs</h2>
              <button onClick={loadLogs} className="text-xs text-gray-400 hover:text-white transition">refresh</button>
            </div>
            <div className="flex-1 glass rounded-lg p-4 overflow-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">{logs || 'No logs available.'}</pre>
            </div>
          </div>
        )}

        {/* ─── CONFIG TAB ────────────────────────────────────────── */}
        {tab === 'config' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="glass rounded-lg p-4">
              <h2 className="text-sm font-medium text-claw-blue mb-3">Set Config</h2>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Key</label>
                  <input
                    value={configKey}
                    onChange={e => setConfigKey(e.target.value)}
                    placeholder="gateway.port"
                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-48 outline-none focus:border-claw-blue/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Value</label>
                  <input
                    value={configValue}
                    onChange={e => setConfigValue(e.target.value)}
                    placeholder="18789"
                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-48 outline-none focus:border-claw-blue/50"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!configKey) return
                    await api('/config', {
                      method: 'POST',
                      body: JSON.stringify({ key: configKey, value: configValue || undefined }),
                    })
                    setConfigKey('')
                    setConfigValue('')
                    await loadConfig()
                  }}
                  className="bg-claw-blue hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium transition"
                >
                  Set
                </button>
              </div>
            </div>

            <div className="glass rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-claw-blue">Current Config</h2>
                <button onClick={loadConfig} className="text-xs text-gray-400 hover:text-white transition">refresh</button>
              </div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">{configData || 'Loading...'}</pre>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ── small components ──────────────────────────────────────────────────────

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5">
      <span className="text-gray-400">{label}</span>
      <span className={ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : ''}>
        {value}
      </span>
    </div>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    green: 'bg-green-600/20 border-green-500/30 text-green-400 hover:bg-green-600/30',
    blue: 'bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30',
    red: 'bg-red-600/20 border-red-500/30 text-red-400 hover:bg-red-600/30',
    purple: 'bg-purple-600/20 border-purple-500/30 text-purple-400 hover:bg-purple-600/30',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded border text-xs transition ${colors[color] || colors.blue}`}>
      {label}
    </button>
  )
}
