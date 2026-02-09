"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useChatState } from './hooks/useChatState'
import { useConfigState } from './hooks/useConfigState'
import { useChatEffects } from './hooks/useChatEffects'
import { useDividerDrag } from './hooks/useDividerDrag'
import { TransactionsPanel } from './transactions/TransactionsPanel'
import { ControlPanel } from './components/ControlPanel'
import { sortModules } from './utils'
import { DEFAULT_DIVIDER_POSITION, DIVIDER_SIZE } from './constants'
import type { ControlPanelProps, TransactionsPanelRef } from './types'

export default function Chat() {
  const chatState = useChatState()
  const configState = useConfigState()

  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [splitOrientation, setSplitOrientation] = useState<'vertical' | 'horizontal'>('horizontal')
  const [dividerPosition, setDividerPosition] = useState<number>(DEFAULT_DIVIDER_POSITION)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isTransactionsCollapsed, setIsTransactionsCollapsed] = useState<boolean>(false)
  const [swapPanels, setSwapPanels] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const transactionsPanelRef = useRef<TransactionsPanelRef>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useChatEffects(chatState)
  useDividerDrag({ isDragging, setDividerPosition, splitOrientation, containerRef })

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    if (isDragging) document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isDragging])

  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }, [abortController, chatState])

  const handleRefresh = useCallback(async () => {
    chatState.setMessages([])
    if (!chatState.client) return
    try {
      const mods = await chatState.client.call('mods', {})
      chatState.setModules(Array.isArray(mods) ? sortModules(mods) : [])
    } catch (err) {
      console.error('Failed to refresh modules:', err)
    }
  }, [chatState])

  const handleResetParams = useCallback(() => {
    chatState.setParams(chatState.defaultParams)
  }, [chatState])

  const handleParamChange = useCallback((key: string, value: string) => {
    chatState.setParams(prev => ({ ...prev, [key]: value }))
  }, [chatState])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
      await chatState.client.call('call', {
        fn: `${chatState.selectedModule}/${chatState.selectedFunction}`,
        params: callParams,
        wait: chatState.wait,
        token: chatState.client.token,
      }, 0, {}, chatState.timeout * 1000)
      transactionsPanelRef.current?.handleSync()
    } catch (error) {
      console.error('Error calling function:', error)
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
      chatState.setInput('')
    }
  }, [chatState])

  const inputParamOptions = useMemo(() => {
    if (!chatState.selectedFunction || !chatState.schema?.[chatState.selectedFunction]?.input) return []
    return Object.keys(chatState.schema[chatState.selectedFunction].input).filter(k => k !== 'self' && k !== 'cls')
  }, [chatState.selectedFunction, chatState.schema])

  const controlPanelProps: ControlPanelProps = useMemo(() => ({
    selectedModule: chatState.selectedModule,
    setSelectedModule: chatState.setSelectedModule,
    selectedFunction: chatState.selectedFunction,
    setSelectedFunction: chatState.setSelectedFunction,
    modules: chatState.modules,
    functions: chatState.functions,
    schema: chatState.schema,
    params: chatState.params,
    handleParamChange,
    handleResetParams,
    handleRefresh,
    configOrientation: configState.configOrientation,
    setConfigOrientation: configState.setConfigOrientation,
    messages: chatState.messages,
    messagesEndRef,
    input: chatState.input,
    setInput: chatState.setInput,
    selectedInputParam: chatState.selectedInputParam,
    setSelectedInputParam: chatState.setSelectedInputParam,
    wait: chatState.wait,
    setWait: chatState.setWait,
    isLoading: chatState.isLoading,
    inputParamOptions,
    handleSubmit,
    onCancel: handleCancel,
    isCollapsed: configState.isConfigCollapsed,
    setIsCollapsed: configState.setIsConfigCollapsed,
    transactionsPanelRef
  }), [chatState, configState, handleParamChange, handleResetParams, handleRefresh, inputParamOptions, handleSubmit, handleCancel])

  const leftPanel = swapPanels ? <ControlPanel {...controlPanelProps} /> : <TransactionsPanel ref={transactionsPanelRef} />
  const rightPanel = swapPanels ? <TransactionsPanel ref={transactionsPanelRef} /> : <ControlPanel {...controlPanelProps} />

  return (
    <div className="relative flex h-full bg-neutral-950 overflow-hidden">
      {/* Minimal control bar - better positioned */}
      <div className="fixed bottom-4 left-4 z-50 flex gap-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-700 rounded-lg p-1.5 shadow-xl">
        <button
          onClick={() => setSplitOrientation('vertical')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            splitOrientation === 'vertical'
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
          title="Vertical split"
        >
          |
        </button>
        <button
          onClick={() => setSplitOrientation('horizontal')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            splitOrientation === 'horizontal'
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
          title="Horizontal split"
        >
          —
        </button>
        <div className="w-px bg-neutral-700 mx-0.5" />
        <button
          onClick={() => setSwapPanels(!swapPanels)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-all"
          title="Swap panels"
        >
          ⇄
        </button>
        <button
          onClick={() => setIsTransactionsCollapsed(!isTransactionsCollapsed)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            isTransactionsCollapsed
              ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
          title={isTransactionsCollapsed ? 'Show transactions' : 'Hide transactions'}
        >
          {isTransactionsCollapsed ? '◉' : '○'}
        </button>
      </div>

      {/* Split panel container */}
      <div
        ref={containerRef}
        className={`flex ${splitOrientation === 'vertical' ? 'flex-row' : 'flex-col'} w-full h-full gap-0 p-2`}
      >
        {/* Left/Top panel */}
        <div
          className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm transition-all"
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: isTransactionsCollapsed ? '0px' : `${dividerPosition}%`,
            display: isTransactionsCollapsed ? 'none' : 'block'
          }}
        >
          {leftPanel}
        </div>

        {/* Divider */}
        {!isTransactionsCollapsed && (
          <div
            className={`relative group bg-neutral-800 hover:bg-cyan-500/50 cursor-${splitOrientation === 'vertical' ? 'col' : 'row'}-resize transition-colors ${isDragging ? 'bg-cyan-500' : ''}`}
            style={{
              [splitOrientation === 'vertical' ? 'width' : 'height']: `${DIVIDER_SIZE}px`,
              [splitOrientation === 'vertical' ? 'height' : 'width']: '100%'
            }}
            onMouseDown={() => setIsDragging(true)}
          >
            {/* Visual indicator */}
            <div className={`absolute ${splitOrientation === 'vertical' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex-col h-8 w-1' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex-row w-8 h-1'} flex gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity`}>
              <div className="bg-neutral-500 rounded-full" style={{ [splitOrientation === 'vertical' ? 'height' : 'width']: '2px', [splitOrientation === 'vertical' ? 'width' : 'height']: '100%' }} />
              <div className="bg-neutral-500 rounded-full" style={{ [splitOrientation === 'vertical' ? 'height' : 'width']: '2px', [splitOrientation === 'vertical' ? 'width' : 'height']: '100%' }} />
              <div className="bg-neutral-500 rounded-full" style={{ [splitOrientation === 'vertical' ? 'height' : 'width']: '2px', [splitOrientation === 'vertical' ? 'width' : 'height']: '100%' }} />
            </div>
          </div>
        )}

        {/* Right/Bottom panel */}
        <div
          className="overflow-hidden flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm transition-all"
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
