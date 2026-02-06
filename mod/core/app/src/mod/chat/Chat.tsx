"use client";

import { useRef, useEffect, useState } from 'react'
import { useChatState } from './hooks/useChatState'
import { useConfigState } from './hooks/useConfigState'
import { useChatEffects } from './hooks/useChatEffects'
import { TransactionsPanel } from './transactions/TransactionsPanel'
import { ControlPanel } from './components/ControlPanel'

export default function Chat() {
  const chatState = useChatState()
  const configState = useConfigState()
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const transactionsPanelRef = useRef<{ handleSync: () => void } | null>(null)
  const [splitOrientation, setSplitOrientation] = useState<'vertical' | 'horizontal'>('vertical')
  const [dividerPosition, setDividerPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [isTransactionsCollapsed, setIsTransactionsCollapsed] = useState(false)
  const [swapPanels, setSwapPanels] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useChatEffects(chatState)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      
      const container = containerRef.current.getBoundingClientRect()
      
      if (splitOrientation === 'vertical') {
        const newPosition = ((e.clientX - container.left) / container.width) * 100
        setDividerPosition(Math.min(Math.max(newPosition, 10), 90))
      } else {
        const newPosition = ((e.clientY - container.top) / container.height) * 100
        setDividerPosition(Math.min(Math.max(newPosition, 10), 90))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, splitOrientation])

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
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

    chatState.setIsLoading(true)
    const controller = new AbortController()
    setAbortController(controller)

    try {
      if (!chatState.client) throw new Error('Client not initialized')
      let callParams = { ...chatState.params }
      if (chatState.input.trim() && chatState.selectedInputParam) {
        callParams[chatState.selectedInputParam] = chatState.input.trim()
      }

      await  chatState.client.call('call', {
        fn: `${chatState.selectedModule}/${chatState.selectedFunction}`,
        params: callParams,
        wait: chatState.wait,
        token: chatState.client.token,
      }, 0, {}, chatState.timeout * 1000)

      if (transactionsPanelRef.current) {
        transactionsPanelRef.current.handleSync()
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
      chatState.setInput('')
    }
  }

  const inputParamOptions = chatState.selectedFunction && chatState.schema && chatState.schema[chatState.selectedFunction]?.input
    ? Object.keys(chatState.schema[chatState.selectedFunction].input).filter(k => k !== 'self' && k !== 'cls')
    : []

  const leftPanel = swapPanels ? (
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
      messagesEndRef={useRef<HTMLDivElement>(null)}
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
  ) : (
    <TransactionsPanel ref={transactionsPanelRef} />
  )

  const rightPanel = swapPanels ? (
    <TransactionsPanel ref={transactionsPanelRef} />
  ) : (
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
      messagesEndRef={useRef<HTMLDivElement>(null)}
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
  )

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: "IBM Plex Mono, Courier New, monospace" }}>
      <div className="fixed bottom-4 left-4 z-50 flex gap-2">
        <button
          onClick={() => setSplitOrientation('vertical')}
          className={`px-4 py-2 ${splitOrientation === 'vertical' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all font-bold`}
          style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          title="Vertical Split"
        >
          ⚌ vertical
        </button>
        <button
          onClick={() => setSplitOrientation('horizontal')}
          className={`px-4 py-2 ${splitOrientation === 'horizontal' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all font-bold`}
          style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          title="Horizontal Split"
        >
          ⚏ horizontal
        </button>
        <button
          onClick={() => setSwapPanels(!swapPanels)}
          className="px-4 py-2 bg-purple-500/20 border-2 border-purple-500/40 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-all font-bold"
          style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          title="Swap Panels"
        >
          ⇄ swap
        </button>
        <button
          onClick={() => setIsTransactionsCollapsed(!isTransactionsCollapsed)}
          className="px-4 py-2 bg-cyan-500/20 border-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 rounded-lg transition-all font-bold"
          style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          title={isTransactionsCollapsed ? 'Expand Transactions' : 'Collapse Transactions'}
        >
          {isTransactionsCollapsed ? '◉ expand' : '● collapse'}
        </button>
      </div>

      <div 
        ref={containerRef}
        className={`flex ${splitOrientation === 'vertical' ? 'flex-row' : 'flex-col'} w-full h-full gap-0 p-2 relative`}
      >
        <div 
          className="overflow-hidden border-2 border-cyan-400/30 rounded-lg bg-black/40 transition-all duration-300"
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: isTransactionsCollapsed ? '0px' : `${dividerPosition}%`,
            display: isTransactionsCollapsed ? 'none' : 'block'
          }}
        >
          {leftPanel}
        </div>

        {!isTransactionsCollapsed && (
          <div
            className={`bg-orange-500/40 hover:bg-orange-500/60 cursor-${splitOrientation === 'vertical' ? 'col' : 'row'}-resize transition-colors z-10 ${isDragging ? 'bg-orange-500/80' : ''}`}
            style={{
              [splitOrientation === 'vertical' ? 'width' : 'height']: '4px',
              [splitOrientation === 'vertical' ? 'height' : 'width']: '100%'
            }}
            onMouseDown={() => setIsDragging(true)}
          />
        )}

        <div 
          className="overflow-hidden flex flex-col border-2 border-orange-500/30 rounded-lg transition-all duration-300"
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: isTransactionsCollapsed ? '100%' : `${100 - dividerPosition}%`
          }}
        >
          {rightPanel}
        </div>
      </div>
    </div>
  )
}
