"use client";

import { useRef, useState, useMemo, useCallback } from 'react'
import { useChatState } from './hooks/useChatState'
import { useConfigState } from './hooks/useConfigState'
import { useChatEffects } from './hooks/useChatEffects'
import { ControlPanel } from './components/ControlPanel'
import { sortModules } from './utils'
import type { ControlPanelProps, TransactionsPanelRef } from './types'

export default function Chat() {
  const chatState = useChatState()
  const configState = useConfigState()

  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const transactionsPanelRef = useRef<TransactionsPanelRef>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useChatEffects(chatState)

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

  return (
    <div className="relative flex h-full w-full bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 overflow-hidden">
      <div className="w-full h-full p-6">
        <div className="w-full h-full max-w-7xl mx-auto rounded-2xl border-2 border-neutral-800/50 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <ControlPanel {...controlPanelProps} />
        </div>
      </div>
    </div>
  )
}
