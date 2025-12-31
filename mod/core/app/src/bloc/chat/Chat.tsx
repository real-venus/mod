'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useUserContext } from '@/bloc/context'
import { ChevronDownIcon, ChevronUpIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  module?: string
  function?: string
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const { client } = useUserContext()
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedModule, setSelectedModule] = useState('store')
  const [selectedFunction, setSelectedFunction] = useState('ls')
  const [modules, setModules] = useState<any[]>([])
  const [functions, setFunctions] = useState<string[]>([])
  const [schema, setSchema] = useState<any>(null)
  const [params, setParams] = useState<Record<string, any>>({})
  const [timeout, setTimeout] = useState<number>(30)
  const [wait, setWait] = useState<boolean>(true)
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false)
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true)
  const [selectedInputParam, setSelectedInputParam] = useState<string>('')
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchModules = async () => {
      if (!client) return
      try {
        const mods = await client.call('mods', {})
        setModules(Array.isArray(mods) ? mods : [])
      } catch (err) {
        console.error('Failed to fetch modules:', err)
      }
    }
    fetchModules()
  }, [client])

  useEffect(() => {
    if (!selectedModule || !client) {
      setFunctions([])
      return
    }
    const mod = modules.find(m => m.name === selectedModule)
    if (mod?.schema) {
      if (typeof mod.schema === 'string'){
        let promise = client.call('get', { cid: mod.schema })
        promise.then((schema) => {
          const fnNames = Object.keys(schema).filter((fn: string) => fn !== 'self' && fn !== 'cls')
          setFunctions(fnNames)
          setSchema(schema)
          console.log('Fetched module schema from CID:', schema)
        }).catch((err) => {
          console.error('Failed to fetch module schema:', err)
        })    
      }
      console.log('Module schema:', mod.schema)
    }
  }, [selectedModule, modules, client])

  useEffect(() => {
    if (selectedFunction && schema && schema[selectedFunction]) {
      const functionSchema = schema[selectedFunction]
      const defaultParams: Record<string, any> = {}
      const inputKeys = Object.keys(functionSchema.input || {}).filter(k => k !== 'self' && k !== 'cls')
      
      if (functionSchema.input) {
        Object.entries(functionSchema.input).forEach(([key, value]: [string, any]) => {
          if (value.value !== '_empty' && value.value !== undefined) {
            defaultParams[key] = value.value
          }
        })
      }
      setParams(defaultParams)
      
      if (inputKeys.length > 0) {
        setSelectedInputParam(inputKeys[0])
      } else {
        setSelectedInputParam('')
      }
    }
  }, [selectedFunction, schema])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const handleRefresh = () => {
    setMessages([])
    setStreamingContent('')
    setSelectedModule('')
    setSelectedFunction('')
    setParams({})
    setSelectedInputParam('')
  }

  const handleCancel = () => {
    setIsLoading(false)
    setStreamingContent('')
  }

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !selectedModule || !selectedFunction) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      module: selectedModule,
      function: selectedFunction
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingContent('')

    try {
      if (!client) {
        throw new Error('Client not initialized')
      }

      let callParams = { ...params }
      if (input.trim() && selectedInputParam) {
        callParams[selectedInputParam] = input.trim()
      }

      console.log('Calling function with params:', callParams)
      const result = await client.call('call', {
        fn: `${selectedModule}/${selectedFunction}`,
        params: callParams,
        wait: wait
      }, 0, {}, timeout * 1000)

      const assistantMessage: Message = {
        role: 'assistant',
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const inputParamOptions = selectedFunction && schema && schema[selectedFunction]?.input 
    ? Object.keys(schema[selectedFunction].input).filter(k => k !== 'self' && k !== 'cls')
    : []

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: "IBM Plex Mono, Courier New, monospace" }}>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>Select module and function to start</p>
              <p className="text-sm" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>Choose your module and function from the configuration below</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`relative max-w-[80%] rounded-3xl p-5 shadow-2xl ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/40 text-green-50'
                  : 'bg-gradient-to-br from-gray-800/60 to-gray-900/40 border-2 border-gray-700/50 text-gray-100'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setOpenDropdown(openDropdown === index ? null : index)}
                  className="p-1 hover:bg-white/10 rounded-full transition-all"
                >
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>
                {openDropdown === index && (
                  <div className="absolute right-0 mt-2 w-48 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-green-500/40 rounded-2xl shadow-xl z-10 overflow-hidden">
                    <button className="w-full px-4 py-2 text-left hover:bg-green-500/20 transition-all text-sm" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>Copy</button>
                    <button className="w-full px-4 py-2 text-left hover:bg-green-500/20 transition-all text-sm" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>Edit</button>
                    <button className="w-full px-4 py-2 text-left hover:bg-red-500/20 transition-all text-sm text-red-400" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>Delete</button>
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold mb-2 opacity-80 pr-8">
                {message.role === 'user' ? 'You' : `${message.module || 'Module'} > ${message.function || 'Function'}`}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
              <div className="text-xs opacity-60 mt-3">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t-2 border-green-500/30 bg-gradient-to-br from-black/80 to-gray-900/60 backdrop-blur-sm">
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
              className="px-6 py-3 bg-gradient-to-r from-green-500/20 to-green-600/10 text-green-400 border-2 border-green-500/40 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/60 rounded-full transition-all duration-200 font-bold shadow-lg"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '0.75rem' }}
            >
              {isConfigCollapsed ? '▲ expand config' : '▼ collapse config'}
            </button>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-gradient-to-r from-purple-500/20 to-purple-600/10 text-purple-400 border-2 border-purple-500/40 hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-500/60 rounded-full transition-all duration-200 font-bold shadow-lg"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '0.75rem' }}
            >
              🔄 refresh
            </button>
          </div>

          {!isConfigCollapsed && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>module</label>
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 transition-all shadow-lg"
                    style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                  >
                    <option value="">Select Module</option>
                    {modules.map(mod => (
                      <option key={mod.name} value={mod.name}>{mod.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>function</label>
                  <select
                    value={selectedFunction}
                    onChange={(e) => setSelectedFunction(e.target.value)}
                    disabled={!selectedModule}
                    className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg"
                    style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                  >
                    <option value="">Select Function</option>
                    {functions.map(fn => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!isConfigCollapsed && selectedFunction && schema && schema[selectedFunction] && (
            <div className="border-t border-gray-700/50 pt-4 mt-4">
              <button
                onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 text-cyan-400 border-2 border-cyan-500/40 hover:from-cyan-500/30 hover:to-cyan-600/20 hover:border-cyan-500/60 rounded-full transition-all duration-200 font-bold shadow-lg mb-3"
                style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '0.7rem' }}
              >
                {isParamsCollapsed ? '▼ show params' : '▲ hide params'}
              </button>
              {!isParamsCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(schema[selectedFunction].input)
                    .filter(([key]) => key !== 'self' && key !== 'cls')
                    .map(([key, value]: [string, any]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-green-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
                          {key} <span className="text-gray-500 text-xs">({value.type})</span>
                        </label>
                        <input
                          type="text"
                          value={params[key] ?? ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                          className="bg-gray-900/80 border-2 border-green-500/60 text-green-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                          style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 5px rgba(34, 197, 94, 0.3)' }}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-3 mt-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedInputParam ? `Enter ${selectedInputParam}...` : "Type your message or leave empty to use default params..."}
              disabled={isLoading || !selectedModule || !selectedFunction}
              className="flex-1 bg-gray-900/80 border-2 border-gray-700/60 text-white px-5 py-4 rounded-3xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            />
            <select
              value={selectedInputParam}
              onChange={(e) => setSelectedInputParam(e.target.value)}
              disabled={inputParamOptions.length === 0}
              className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {inputParamOptions.length === 0 ? (
                <option value="">No params</option>
              ) : (
                inputParamOptions.map(param => (
                  <option key={param} value={param}>{param}</option>
                ))
              )}
            </select>
            <button
              onClick={() => setWait(!wait)}
              type="button"
              className={`px-6 py-4 rounded-3xl font-semibold text-sm transition-all whitespace-nowrap ${
                wait
                  ? 'bg-green-500/20 text-green-400 border-2 border-green-500/40'
                  : 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/40'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {wait ? '⏳ Wait' : '🚀 Async'}
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedModule || !selectedFunction}
              className="px-8 py-4 bg-gradient-to-r from-green-500/30 to-green-600/20 text-green-400 border-2 border-green-500/40 hover:from-green-500/40 hover:to-green-600/30 hover:border-green-500/60 rounded-3xl transition-all duration-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-8 py-4 bg-gradient-to-r from-red-500/30 to-red-600/20 text-red-400 border-2 border-red-500/40 hover:from-red-500/40 hover:to-red-600/30 hover:border-red-500/60 rounded-3xl transition-all duration-200 font-bold shadow-xl"
                style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
