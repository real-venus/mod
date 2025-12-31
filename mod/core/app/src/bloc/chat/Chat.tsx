'use client'

import { useRef, useEffect, useState } from 'react'
import { useChatState } from './hooks/useChatState'
import { useConfigState } from './hooks/useConfigState'
import { useChatEffects } from './hooks/useChatEffects'
import { ConfigPanel } from './components/ConfigPanel'
import { Message } from './types'
import { ChatMessages } from './components/ChatMessages'

export default function Chat() {
  const chatState = useChatState()
  const configState = useConfigState()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [outputMode, setOutputMode] = useState<'chat' | 'transactions'>('chat')

  useChatEffects(chatState)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatState.messages, chatState.streamingContent])

  const handleMouseDown = () => configState.setIsDragging(true)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!configState.isDragging) return
      if (configState.configOrientation === 'vertical') {
        const newPos = window.innerWidth - e.clientX
        if (newPos > 200 && newPos < window.innerWidth - 200) {
          configState.setDividerPosition(newPos)
        }
      } else if (configState.configOrientation === 'horizontal') {
        const newPos = window.innerHeight - e.clientY
        if (newPos > 200 && newPos < window.innerHeight - 200) {
          configState.setDividerPosition(newPos)
        }
      } else if (configState.configOrientation === 'left') {
        const newPos = e.clientX
        if (newPos > 200 && newPos < window.innerWidth - 200) {
          configState.setDividerPosition(newPos)
        }
      } else if (configState.configOrientation === 'top') {
        const newPos = e.clientY
        if (newPos > 200 && newPos < window.innerHeight - 200) {
          configState.setDividerPosition(newPos)
        }
      }
    }

    const handleMouseUp = () => {
      if (configState.isDragging) {
        configState.setIsDragging(false)
        localStorage.setItem('chat_divider_position', configState.dividerPosition.toString())
      }
    }

    if (configState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [configState.isDragging, configState.dividerPosition, configState.configOrientation])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (chatState.isLoading || !chatState.selectedModule || !chatState.selectedFunction) return

    const userMessage: Message = {
      role: 'user',
      content: chatState.input.trim() || 'Using default parameters',
      timestamp: Date.now(),
      module: chatState.selectedModule,
      function: chatState.selectedFunction,
      params: chatState.params
    }

    chatState.setMessages(prev => [...prev, userMessage])
    chatState.setInput('')
    chatState.setIsLoading(true)
    chatState.setStreamingContent('')

    const controller = new AbortController()
    setAbortController(controller)

    try {
      if (!chatState.client) {
        throw new Error('Client not initialized')
      }

      let callParams = { ...chatState.params }
      if (chatState.input.trim() && chatState.selectedInputParam) {
        callParams[chatState.selectedInputParam] = chatState.input.trim()
      }

      console.log('Calling function with params:', callParams)
      const result = await chatState.client.call('call', {
        fn: `${chatState.selectedModule}/${chatState.selectedFunction}`,
        params: callParams,
        wait: chatState.wait
      }, 0, {}, chatState.timeout * 1000)

      if (controller.signal.aborted) return

      const assistantMessage: Message = {
        role: 'assistant',
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        timestamp: Date.now()
      }

      chatState.setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      }
      chatState.setMessages(prev => [...prev, errorMessage])
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }

  const inputParamOptions = chatState.selectedFunction && chatState.schema && chatState.schema[chatState.selectedFunction]?.input
    ? Object.keys(chatState.schema[chatState.selectedFunction].input).filter(k => k !== 'self' && k !== 'cls')
    : []

  const getMarginStyle = () => {
    if (configState.isConfigCollapsed) return {}
    switch(configState.configOrientation) {
      case 'vertical': return { marginRight: `${configState.dividerPosition}px` }
      case 'horizontal': return { marginBottom: `${configState.dividerPosition}px` }
      case 'left': return { marginLeft: `${configState.dividerPosition}px` }
      case 'top': return { marginTop: `${configState.dividerPosition}px` }
    }
  }

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: "IBM Plex Mono, Courier New, monospace" }}>
      {!configState.isConfigCollapsed && configState.configOrientation === 'vertical' && (
        <div
          className="fixed top-0 bottom-0 w-1 bg-green-500/30 hover:bg-green-500/60 cursor-col-resize z-50 transition-colors"
          style={{ right: `${configState.dividerPosition}px` }}
          onMouseDown={handleMouseDown}
        />
      )}

      {!configState.isConfigCollapsed && configState.configOrientation === 'horizontal' && (
        <div
          className="fixed left-0 right-0 h-1 bg-green-500/30 hover:bg-green-500/60 cursor-row-resize z-50 transition-colors"
          style={{ bottom: `${configState.dividerPosition}px`, marginLeft: '80px' }}
          onMouseDown={handleMouseDown}
        />
      )}

      {!configState.isConfigCollapsed && configState.configOrientation === 'left' && (
        <div
          className="fixed top-0 bottom-0 w-1 bg-green-500/30 hover:bg-green-500/60 cursor-col-resize z-50 transition-colors"
          style={{ left: `${configState.dividerPosition}px` }}
          onMouseDown={handleMouseDown}
        />
      )}

      {!configState.isConfigCollapsed && configState.configOrientation === 'top' && (
        <div
          className="fixed left-0 right-0 h-1 bg-green-500/30 hover:bg-green-500/60 cursor-row-resize z-50 transition-colors"
          style={{ top: `${configState.dividerPosition}px`, marginLeft: '80px' }}
          onMouseDown={handleMouseDown}
        />
      )}

        {/* Output Section - Left Side */}
        <div className="flex-1 overflow-y-auto" style={getMarginStyle()}>
          <div className="p-6">
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setOutputMode('chat')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  outputMode === 'chat'
                    ? 'bg-green-500/30 text-green-400 border-2 border-green-500/60'
                    : 'bg-gray-800/30 text-gray-400 border-2 border-gray-700/40 hover:border-gray-600/60'
                }`}
                style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              >
                💬 chat
              </button>
              <button
                onClick={() => setOutputMode('transactions')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  outputMode === 'transactions'
                    ? 'bg-purple-500/30 text-purple-400 border-2 border-purple-500/60'
                    : 'bg-gray-800/30 text-gray-400 border-2 border-gray-700/40 hover:border-gray-600/60'
                }`}
                style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              >
                📊 transactions
              </button>
            </div>
            {outputMode === 'chat' ? (
              <ChatMessages messages={chatState.messages} messagesEndRef={messagesEndRef} />
            ) : (
              <div className="space-y-2">
                {chatState.messages
                  .filter(msg => msg.role === 'assistant')
                  .reverse()
                  .map((msg, idx) => {
                    const userMsg = chatState.messages.find(m => m.role === 'user' && m.timestamp < msg.timestamp && m.module && m.function)
                    return (
                      <div key={idx} className="border border-gray-700/40 rounded-lg bg-black/30 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-green-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                              {userMsg?.module || 'mod'}
                            </span>
                            <span className="text-xs text-gray-500">/</span>
                            <span className="text-xs font-bold text-cyan-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                              {userMsg?.function || 'fn'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="text-xs bg-black/50 p-2 rounded border border-gray-700/30 overflow-x-auto">
                          <code className="text-gray-300">{msg.content}</code>
                        </pre>
                      </div>
                    )
                  })}
                {chatState.messages.filter(m => m.role === 'assistant').length === 0 && (
                  <div className="text-gray-500 text-xs text-center py-4">No transactions yet</div>
                )}
              </div>
            )}
          </div>
        </div>

          {!configState.isConfigCollapsed && configState.configOrientation === 'vertical' && (
            <div className="fixed top-0 bottom-0 right-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ width: `${configState.dividerPosition}px`, marginTop: '80px', zIndex: 40 }}>
          <ConfigPanel
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
          />
        </div>
      )}

          {!configState.isConfigCollapsed && configState.configOrientation === 'horizontal' && (
            <div className="fixed left-0 right-0 bottom-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ height: `${configState.dividerPosition}px`, marginLeft: '80px', zIndex: 40 }}>
          <ConfigPanel
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
          />
        </div>
      )}

          {!configState.isConfigCollapsed && configState.configOrientation === 'left' && (
            <div className="fixed top-0 bottom-0 left-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ width: `${configState.dividerPosition}px`, marginTop: '80px', zIndex: 40 }}>
          <ConfigPanel
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
          />
        </div>
      )}

          {!configState.isConfigCollapsed && configState.configOrientation === 'top' && (
            <div className="fixed left-0 right-0 top-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ height: `${configState.dividerPosition}px`, marginLeft: '80px', marginTop: '80px', zIndex: 40 }}>
          <ConfigPanel
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
          />
        </div>
      )}

      {configState.isConfigCollapsed && (
        <ConfigPanel
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
        />
      )}
    </div>
  )
}
