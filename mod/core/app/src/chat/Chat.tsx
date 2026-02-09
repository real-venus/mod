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
  const [splitOrientation, setSplitOrientation] = useState<'vertical' | 'horizontal'>('vertical')
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
    <div className="flex h-full bg-neutral-950">
      {/* Minimal control bar */}
      <div className="fixed bottom-3 left-3 z-50 flex gap-1.5">
        <button
          onClick={() => setSplitOrientation('vertical')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            splitOrientation === 'vertical' ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          |
        </button>
        <button
          onClick={() => setSplitOrientation('horizontal')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            splitOrientation === 'horizontal' ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          —
        </button>
        <button
          onClick={() => setSwapPanels(!swapPanels)}
          className="px-3 py-1.5 text-xs font-medium rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-all"
        >
          ⇄
        </button>
        <button
          onClick={() => setIsTransactionsCollapsed(!isTransactionsCollapsed)}
          className="px-3 py-1.5 text-xs font-medium rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-all"
        >
          {isTransactionsCollapsed ? '◉' : '○'}
        </button>
      </div>

      {/* Split panel container */}
      <div
        ref={containerRef}
        className={`flex ${splitOrientation === 'vertical' ? 'flex-row' : 'flex-col'} w-full h-full gap-0 p-1.5`}
      >
        {/* Left/Top panel */}
        <div
          className="overflow-hidden rounded border border-neutral-800 bg-neutral-900/50 transition-all"
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
            className={`bg-neutral-700 hover:bg-neutral-500 cursor-${splitOrientation === 'vertical' ? 'col' : 'row'}-resize transition-colors ${isDragging ? 'bg-neutral-400' : ''}`}
            style={{
              [splitOrientation === 'vertical' ? 'width' : 'height']: `${DIVIDER_SIZE}px`,
              [splitOrientation === 'vertical' ? 'height' : 'width']: '100%'
            }}
            onMouseDown={() => setIsDragging(true)}
          />
        )}

        {/* Right/Bottom panel */}
        <div
          className="overflow-hidden flex flex-col rounded border border-neutral-800 transition-all"
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
