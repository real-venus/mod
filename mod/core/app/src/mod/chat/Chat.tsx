'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useChatState } from './hooks/useChatState'
import { useConfigState } from './hooks/useConfigState'
import { useChatEffects } from './hooks/useChatEffects'
import { Message } from './types'
import { ChatMessages } from './components/ChatMessages'
import { TransactionsPanel } from './transactions/TransactionsPanel'
import { ControlPanel } from './components/ControlPanel'

export default function Chat() {
  const chatState = useChatState()
  const configState = useConfigState()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [outputMode, setOutputMode] = useState<'chat' | 'transactions'>('transactions')
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>('vertical')
  const transactionsPanelRef = useRef<{ handleSync: () => void } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [splitPosition, setSplitPosition] = useState(50)

  useChatEffects(chatState)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatState.messages, chatState.streamingContent])

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
      const cancelMessage: Message = {
        role: 'assistant',
        content: 'Transaction cancelled by user',
        timestamp: Date.now(),
      }
      chatState.setMessages(prev => [...prev, cancelMessage])
    }
  }

  const handleRefresh = async () => {
    chatState.setMessages([])
    if (!chatState.client) return
    try {
      const mods = await chatState.client.call('mods', {})
      const sortedMods = Array.isArray(mods) ? mods.sort((a, b) => a.name.localeCompare(b.name)) : []
      chatState.setModules(sortedMods)
    } catch (err) {
      console.error('Failed to refresh modules:', err)
    }
  }

  const handleResetParams = () => {
    chatState.setParams(chatState.defaultParams)
  }

  const handleParamChange = (key: string, value: string) => {
    chatState.setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (chatState.isLoading || !chatState.selectedModule || !chatState.selectedFunction) return

    chatState.setMessages(prev => [...prev, {
      role: 'user',
      content: chatState.input.trim() || 'Using default parameters',
      timestamp: Date.now(),
      module: chatState.selectedModule,
      function: chatState.selectedFunction,
      params: chatState.params
    }])
    chatState.setInput('')
    chatState.setIsLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    try {
      if (!chatState.client) throw new Error('Client not initialized')
      let callParams = { ...chatState.params }
      if (chatState.input.trim() && chatState.selectedInputParam) {
        callParams[chatState.selectedInputParam] = chatState.input.trim()
      }
      const result = await chatState.client.call('call', {
        fn: `${chatState.selectedModule}/${chatState.selectedFunction}`,
        params: callParams,
        wait: chatState.wait
      }, 0, {}, chatState.timeout * 1000)

      if (!controller.signal.aborted) {
        chatState.setMessages(prev => [...prev, {
          role: 'assistant',
          content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          timestamp: Date.now()
        }])
      }
      
      // Immediately update transactions after successful call
      if (transactionsPanelRef.current) {
        transactionsPanelRef.current.handleSync()
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        chatState.setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
          timestamp: Date.now()
        }])
      }
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }

  const inputParamOptions = chatState.selectedFunction && chatState.schema && chatState.schema[chatState.selectedFunction]?.input
    ? Object.keys(chatState.schema[chatState.selectedFunction].input).filter(k => k !== 'self' && k !== 'cls')
    : []

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const container = document.getElementById('split-container')
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    
    if (splitOrientation === 'vertical') {
      const newPos = ((e.clientX - rect.left) / rect.width) * 100
      setSplitPosition(Math.max(20, Math.min(80, newPos)))
    } else {
      const newPos = ((e.clientY - rect.top) / rect.height) * 100
      setSplitPosition(Math.max(20, Math.min(80, newPos)))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, splitOrientation])

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: "IBM Plex Mono, Courier New, monospace" }}>
      
      {/* Split orientation toggle button - moved to bottom left */}
      <button
        onClick={() => setSplitOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
        className="fixed bottom-4 left-4 z-50 px-4 py-2 bg-blue-500/20 text-blue-400 border-2 border-blue-500/40 hover:bg-blue-500/30 rounded-lg transition-all font-bold"
        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
        title={`Switch to ${splitOrientation === 'vertical' ? 'Horizontal' : 'Vertical'} Split`}
      >
        {splitOrientation === 'vertical' ? '⚌ vertical' : '⚏ horizontal'}
      </button>

      <div id="split-container" className={`flex ${splitOrientation === 'vertical' ? 'flex-row' : 'flex-col'} w-full h-full gap-0 p-2 relative`}>
        {/* Left/Top Panel: Inputs (ModFn Selector, Chat Input, Params) */}
        <div 
          className={`flex flex-col overflow-hidden rounded-lg bg-black/95`}
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: `${splitPosition}%`
          }}
        >
          <ControlPanel
            selectedModule={chatState.selectedModule}
            setSelectedModule={chatState.setSelectedModule}
            selectedFunction={chatState.selectedFunction}
            setSelectedFunction={chatState.setSelectedFunction}
            modules={chatState.modules}
            functions={chatState.functions}
            schema={chatState.schema}
            params={chatState.params}
            handleParamChange={handleParamChange}
            handleResetParams={handleResetParams}
            handleRefresh={handleRefresh}
            configOrientation={configState.configOrientation}
            setConfigOrientation={configState.setConfigOrientation}
            messages={chatState.messages}
            messagesEndRef={messagesEndRef}
            input={chatState.input}
            setInput={chatState.setInput}
            selectedInputParam={chatState.selectedInputParam}
            setSelectedInputParam={chatState.setSelectedInputParam}
            wait={chatState.wait}
            setWait={chatState.setWait}
            isLoading={chatState.isLoading}
            inputParamOptions={inputParamOptions}
            handleSubmit={handleSubmit}
            onCancel={handleCancel}
            isCollapsed={configState.isConfigCollapsed}
            setIsCollapsed={configState.setIsConfigCollapsed}
            transactionsPanelRef={transactionsPanelRef}
          />
        </div>

        {/* Draggable Divider */}
        <div
          className={`${splitOrientation === 'vertical' ? 'w-3 cursor-col-resize hover:bg-white/70' : 'h-3 cursor-row-resize hover:bg-white/70'} bg-white/40 transition-colors z-10 flex items-center justify-center`}
          onMouseDown={handleMouseDown}
        >
          <div className={`${splitOrientation === 'vertical' ? 'w-1.5 h-12' : 'h-1.5 w-12'} bg-white/80 rounded-full`} />
        </div>

        {/* Right/Bottom Panel: Transactions */}
        <div 
          className="flex flex-col overflow-hidden"
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: `${100 - splitPosition}%`
          }}
        >
          <div className="h-full overflow-y-auto p-3">
            <TransactionsPanel ref={transactionsPanelRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
