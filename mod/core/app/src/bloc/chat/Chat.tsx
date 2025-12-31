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
      function: chatState.selectedFunction
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

      <div className="flex-1 overflow-y-auto" style={getMarginStyle()}>
        <ChatMessages messages={chatState.messages} messagesEndRef={messagesEndRef} />
      </div>

      {!configState.isConfigCollapsed && configState.configOrientation === 'vertical' && (
        <div className="fixed top-0 bottom-0 right-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ width: `${configState.dividerPosition}px`, marginTop: '64px' }}>
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
          />
        </div>
      )}

      {!configState.isConfigCollapsed && configState.configOrientation === 'horizontal' && (
        <div className="fixed left-0 right-0 bottom-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ height: `${configState.dividerPosition}px`, marginLeft: '80px' }}>
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
          />
        </div>
      )}

      {!configState.isConfigCollapsed && configState.configOrientation === 'left' && (
        <div className="fixed top-0 bottom-0 left-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ width: `${configState.dividerPosition}px`, marginTop: '64px' }}>
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
          />
        </div>
      )}

      {!configState.isConfigCollapsed && configState.configOrientation === 'top' && (
        <div className="fixed left-0 right-0 top-0 bg-gradient-to-br from-black/90 to-gray-900/70 backdrop-blur-sm overflow-y-auto" style={{ height: `${configState.dividerPosition}px`, marginLeft: '80px', marginTop: '64px' }}>
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
          />
        </div>
      )}

      {configState.isConfigCollapsed && (
        <button
          onClick={() => configState.setIsConfigCollapsed(false)}
          className="fixed bottom-24 right-4 px-6 py-3 bg-gradient-to-r from-green-500/20 to-green-600/10 text-green-400 border-2 border-green-500/40 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-lg z-50"
          style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
        >
          ▶ expand config
        </button>
      )}
    </div>
  )
}
