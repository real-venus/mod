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
  params?: Record<string, any>
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
  const [defaultParams, setDefaultParams] = useState<Record<string, any>>({})
  const [timeout, setTimeout] = useState<number>(30)
  const [wait, setWait] = useState<boolean>(true)
  const [dividerPosition, setDividerPosition] = useState(500)
  const [isDragging, setIsDragging] = useState(false)
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false)
  const [configOrientation, setConfigOrientation] = useState<'vertical' | 'horizontal'>('vertical')
  const [selectedInputParam, setSelectedInputParam] = useState<string>('')
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('chat_divider_position')
    if (saved) setDividerPosition(parseInt(saved))
  }, [])

  useEffect(() => {
    const fetchModules = async () => {
      if (!client) return
      try {
        const mods = await client.call('mods', {})
        const sortedMods = Array.isArray(mods) ? mods.sort((a, b) => a.name.localeCompare(b.name)) : []
        setModules(sortedMods)
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
          const fnNames = Object.keys(schema).filter((fn: string) => fn !== 'self' && fn !== 'cls').sort()
          setFunctions(fnNames)
          setSchema(schema)
        }).catch((err) => {
          console.error('Failed to fetch module schema:', err)
        })    
      }
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
      setDefaultParams(defaultParams)
      setParams(defaultParams)
      
      if (inputKeys.length > 0) {
        setSelectedInputParam(inputKeys[0])
      } else {
        setSelectedInputParam('')
      }
    }
  }, [selectedFunction, schema])

  useEffect(() => {
    if (input && selectedInputParam) {
      setParams(prev => ({ ...prev, [selectedInputParam]: input }))
    }
  }, [input, selectedInputParam])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const handleMouseDown = () => setIsDragging(true)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      if (configOrientation === 'vertical') {
        const newPos = window.innerWidth - e.clientX
        if (newPos > 200 && newPos < window.innerWidth - 200) {
          setDividerPosition(newPos)
        }
      } else {
        const newPos = window.innerHeight - e.clientY
        if (newPos > 200 && newPos < window.innerHeight - 200) {
          setDividerPosition(newPos)
        }
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        localStorage.setItem('chat_divider_position', dividerPosition.toString())
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dividerPosition, configOrientation])

  const handleRefresh = async () => {
    setMessages([])
    if (!client) return
    try {
      const mods = await client.call('mods', {})
      const sortedMods = Array.isArray(mods) ? mods.sort((a, b) => a.name.localeCompare(b.name)) : []
      setModules(sortedMods)
    } catch (err) {
      console.error('Failed to refresh modules:', err)
    }
  }

  const handleResetParams = () => {
    setParams(defaultParams)
  }

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || !selectedModule || !selectedFunction) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || 'Using default parameters',
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
    <div className="flex h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: "IBM Plex Mono, Courier New, monospace" }}>
      <div className={`flex-1 flex flex-col ${configOrientation === 'vertical' ? '' : 'h-full'}`} style={{ marginRight: isConfigCollapsed || configOrientation === 'horizontal' ? '0px' : `${dividerPosition}px`, marginBottom: isConfigCollapsed || configOrientation === 'vertical' ? '0px' : `${dividerPosition}px` }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">Select module and function to start</p>
                <p className="text-sm">Choose your module and function from the configuration on the right</p>
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
                <div className="text-sm font-semibold mb-2 opacity-80">
                  {message.role === 'user' ? 'You' : `${message.module || 'Module'} > ${message.function || 'Function'}`}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                {message.params && (
                  <div className="text-xs opacity-60 mt-2 pt-2 border-t border-white/10">
                    <div className="font-semibold mb-1">Parameters:</div>
                    <pre className="text-xs bg-black/30 p-2 rounded">{JSON.stringify(message.params, null, 2)}</pre>
                  </div>
                )}
                <div className="text-xs opacity-60 mt-3">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t-2 border-green-500/30 bg-gradient-to-br from-black/80 to-gray-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedInputParam ? `Enter ${selectedInputParam}...` : "Type your message or leave empty to use default params..."}
              disabled={isLoading || !selectedModule || !selectedFunction}
              rows={4}
              className="w-full bg-gray-900/80 border-2 border-gray-700/60 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg resize-none"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            />
            <div className="flex items-center gap-3">
              <select
                value={selectedInputParam}
                onChange={(e) => setSelectedInputParam(e.target.value)}
                disabled={inputParamOptions.length === 0}
                className="flex-1 bg-gray-900/80 border-2 border-gray-700/60 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg"
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
                className={`px-6 py-3 rounded-2xl font-semibold text-sm transition-all whitespace-nowrap ${
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
                className="px-8 py-3 bg-gradient-to-r from-green-500/30 to-green-600/20 text-green-400 border-2 border-green-500/40 hover:from-green-500/40 hover:to-green-600/30 hover:border-green-500/60 rounded-2xl transition-all duration-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {!isConfigCollapsed && configOrientation === 'vertical' && (
        <div
          className="fixed top-0 bottom-0 w-1 bg-green-500/30 hover:bg-green-500/60 cursor-col-resize z-50 transition-colors"
          style={{ right: `${dividerPosition}px` }}
          onMouseDown={handleMouseDown}
        />
      )}

      {!isConfigCollapsed && configOrientation === 'horizontal' && (
        <div
          className="fixed left-0 right-0 h-1 bg-green-500/30 hover:bg-green-500/60 cursor-row-resize z-50 transition-colors"
          style={{ bottom: `${dividerPosition}px`, marginLeft: '80px' }}
          onMouseDown={handleMouseDown}
        />
      )}

      {!isConfigCollapsed && configOrientation === 'vertical' && (
        <div className="fixed top-0 bottom-0 right-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ width: `${dividerPosition}px`, marginTop: '64px' }}>
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-green-400 text-2xl font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>⚙ config</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfigOrientation(configOrientation === 'vertical' ? 'horizontal' : 'vertical')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 border-2 border-blue-500/40 hover:from-blue-500/30 hover:to-blue-600/20 hover:border-blue-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-sm"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                >
                  {configOrientation === 'vertical' ? '⬇ horizontal' : '➡ vertical'}
                </button>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-purple-600/10 text-purple-400 border-2 border-purple-500/40 hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-sm"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                >
                  🔄 refresh
                </button>
              </div>
            </div>
  
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>module</label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 transition-all shadow-lg text-base"
                  style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                >
                  <option value="">Select Module</option>
                  {modules.map(mod => (
                    <option key={mod.name} value={mod.name}>{mod.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-cyan-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>function</label>
                <select
                  value={selectedFunction}
                  onChange={(e) => setSelectedFunction(e.target.value)}
                  disabled={!selectedModule}
                  className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg text-base"
                  style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                >
                  <option value="">Select Function</option>
                  {functions.map(fn => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedFunction && schema && schema[selectedFunction] && (
              <div className="border-t border-gray-700/50 pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-cyan-400 text-lg font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>parameters</h3>
                  <button
                    onClick={handleResetParams}
                    className="px-3 py-1.5 bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border-2 border-orange-500/40 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-sm"
                    style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                  >
                    🔄 reset
                  </button>
                </div>
                <div className="space-y-3">
                  {Object.entries(schema[selectedFunction].input)
                    .filter(([key]) => key !== 'self' && key !== 'cls')
                    .map(([key, value]: [string, any]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
                          {key} <span className="text-gray-500 text-sm">({value.type})</span>
                        </label>
                        <input
                          type="text"
                          value={params[key] ?? ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                          className="bg-gray-900/80 border-2 border-green-500/60 text-green-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-base font-bold"
                          style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isConfigCollapsed && configOrientation === 'horizontal' && (
        <div className="fixed left-0 right-0 bottom-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ height: `${dividerPosition}px`, marginLeft: '80px' }}>
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-green-400 text-2xl font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>⚙ config</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfigOrientation(configOrientation === 'vertical' ? 'horizontal' : 'vertical')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 border-2 border-blue-500/40 hover:from-blue-500/30 hover:to-blue-600/20 hover:border-blue-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-sm"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                >
                  {configOrientation === 'vertical' ? '⬇ horizontal' : '➡ vertical'}
                </button>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-purple-600/10 text-purple-400 border-2 border-purple-500/40 hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-sm"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                >
                  🔄 refresh
                </button>
              </div>
            </div>
  
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>module</label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 transition-all shadow-lg text-base"
                  style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                >
                  <option value="">Select Module</option>
                  {modules.map(mod => (
                    <option key={mod.name} value={mod.name}>{mod.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-cyan-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>function</label>
                <select
                  value={selectedFunction}
                  onChange={(e) => setSelectedFunction(e.target.value)}
                  disabled={!selectedModule}
                  className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg text-base"
                  style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                >
                  <option value="">Select Function</option>
                  {functions.map(fn => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedFunction && schema && schema[selectedFunction] && (
              <div className="border-t border-gray-700/50 pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-cyan-400 text-lg font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>parameters</h3>
                  <button
                    onClick={handleResetParams}
                    className="px-3 py-1.5 bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border-2 border-orange-500/40 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-sm"
                    style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                  >
                    🔄 reset
                  </button>
                </div>
                <div className="space-y-3">
                  {Object.entries(schema[selectedFunction].input)
                    .filter(([key]) => key !== 'self' && key !== 'cls')
                    .map(([key, value]: [string, any]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
                          {key} <span className="text-gray-500 text-sm">({value.type})</span>
                        </label>
                        <input
                          type="text"
                          value={params[key] ?? ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                          className="bg-gray-900/80 border-2 border-green-500/60 text-green-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-base font-bold"
                          style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isConfigCollapsed && (
        <button
          onClick={() => setIsConfigCollapsed(true)}
          className="fixed bottom-24 right-4 px-4 py-2 bg-gradient-to-r from-green-500/20 to-green-600/10 text-green-400 border-2 border-green-500/40 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-sm z-50"
          style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
        >
          ◀ collapse config
        </button>
      )}

      {isConfigCollapsed && (
        <button
          onClick={() => setIsConfigCollapsed(false)}
          className="fixed bottom-24 right-4 px-4 py-2 bg-gradient-to-r from-green-500/20 to-green-600/10 text-green-400 border-2 border-green-500/40 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-sm z-50"
          style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
        >
          ▶ expand config
        </button>
      )}
    </div>
  )
}
