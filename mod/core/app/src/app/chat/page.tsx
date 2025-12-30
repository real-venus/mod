'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useUserContext } from '@/bloc/context'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  module?: string
  function?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const { client } = useUserContext()
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedFunction, setSelectedFunction] = useState('')
  const [modules, setModules] = useState<any[]>([])
  const [functions, setFunctions] = useState<string[]>([])
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
      // if the mod.schema is a string its a cid
      if (typeof mod.schema === 'string'){
        let promise = client.call('get', { cid: mod.schema })
        promise.then((schema) => {
          const fnNames = Object.keys(schema).filter((fn: string) => fn !== 'self' && fn !== 'cls')
          setFunctions(fnNames)
          console.log('Fetched module schema from CID:', schema)
        }).catch((err) => {
          console.error('Failed to fetch module schema:', err)
        })    

      }
      console.log('Module schema:', mod.schema)
    }
  }, [selectedModule, modules, client])

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
      
      const result = await client.call('call', {
        fn: `${selectedModule}/${selectedFunction}`,
        params: { args: [userMessage.content] , kwargs: {} },
      })

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
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="border-b border-green-500/30 p-4 bg-black/50 flex justify-between items-center">
        <div className="flex gap-4 items-center flex-1">
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value)
              setSelectedFunction('')
            }}
            className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50"
          >
            <option value="">Select Module</option>
            {modules.map(mod => (
              <option key={mod.name} value={mod.name}>{mod.name}</option>
            ))}
          </select>
          <select
            value={selectedFunction}
            onChange={(e) => setSelectedFunction(e.target.value)}
            disabled={!selectedModule}
            className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50"
          >
            <option value="">Select Function</option>
            {functions.map(fn => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 rounded-lg transition-colors font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Select module and function to start</p>
              <p className="text-sm">Choose your module and function from the dropdowns above</p>
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
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-green-500/20 border border-green-500/30 text-green-100'
                  : 'bg-gray-800/50 border border-gray-700 text-gray-100'
              }`}
            >
              <div className="text-sm font-semibold mb-1 opacity-70">
                {message.role === 'user' ? 'You' : `${message.module || 'Module'} > ${message.function || 'Function'}`}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs opacity-50 mt-2">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-green-500/30 p-4 bg-black/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading || !selectedModule || !selectedFunction}
            className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !selectedModule || !selectedFunction}
            className="px-6 py-3 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
