"use client";

import { useRef, useState, useCallback, useMemo } from 'react'
import { useChatState } from './hooks/useChatState'
import { useModules } from './hooks/useModules'
import { useFetchedSchemas } from './hooks/useFetchedSchemas'
import { ModuleSelector } from './components/ModuleSelector'
import { UnifiedControlBar } from './components/UnifiedControlBar'
import { ChatTab } from './components/tabs/ChatTab'
import { ParamsTab } from './components/tabs/ParamsTab'
import { CodeTab } from './components/tabs/CodeTab'
import { TxsTab } from './components/tabs/TxsTab'
import type { TabType, TransactionsPanelRef } from './types'

/**
 * Main Chat component - refactored for cleaner architecture
 * - Module selector at top
 * - Function selector in each tab
 * - Passes Module objects instead of just names
 */
export default function Chat() {
  const chatState = useChatState()
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const transactionsPanelRef = useRef<TransactionsPanelRef>(null)

  // Load and manage modules
  useModules({
    client: chatState.client,
    selectedModules: chatState.selectedModules,
    setAllModules: chatState.setAllModules,
    setSelectedModules: chatState.setSelectedModules,
    setParams: chatState.setParams,
    setDefaultParams: chatState.setDefaultParams,
    selectedFunction: chatState.selectedFunction
  })

  // Fetch schemas and get combined schema
  const { combinedSchema: fetchedCombinedSchema, fetchedSchemas } = useFetchedSchemas({
    selectedModules: chatState.selectedModules,
    client: chatState.client
  })

  const combinedSchema = Object.keys(fetchedCombinedSchema).length > 0 ? fetchedCombinedSchema : null

  // Get input param options for selected function
  const inputParamOptions = useMemo(() => {
    if (!chatState.selectedFunction || !combinedSchema?.[chatState.selectedFunction]?.input) {
      return []
    }
    return Object.keys(combinedSchema[chatState.selectedFunction].input).filter(
      k => k !== 'self' && k !== 'cls'
    )
  }, [chatState.selectedFunction, combinedSchema])


  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }, [abortController, chatState])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      if (chatState.isLoading || chatState.selectedModules.length === 0 || !chatState.selectedFunction) {
        return
      }

      chatState.setIsLoading(true)
      const controller = new AbortController()
      setAbortController(controller)

      try {
        if (!chatState.client) throw new Error('Client not initialized')

        // Build call parameters
        let callParams = { ...chatState.params }
        if (chatState.input.trim() && chatState.selectedInputParam) {
          callParams[chatState.selectedInputParam] = chatState.input.trim()
        }

        // Use first selected module for the call
        const module = chatState.selectedModules[0]
        const fn = `${module.name}/${chatState.selectedFunction}`

        await chatState.client.call(
          'call',
          {
            fn,
            params: callParams,
            wait: chatState.wait,
            token: chatState.client.token
          }
        )

        transactionsPanelRef.current?.handleSync()
      } catch (error) {
        console.error('Error calling function:', error)
      } finally {
        setAbortController(null)
        chatState.setIsLoading(false)
        chatState.setInput('')
      }
    },
    [chatState, transactionsPanelRef]
  )

  const handleParamChange = useCallback(
    (key: string, value: string) => {
      chatState.setParams(prev => ({ ...prev, [key]: value }))
    },
    [chatState]
  )

  const handleResetParams = useCallback(() => {
    chatState.setParams(chatState.defaultParams)
  }, [chatState])

  const canSubmit = chatState.selectedModules.length > 0 && !!chatState.selectedFunction

  return (
    <div className="relative flex h-full w-full bg-black overflow-hidden">
      <div className="w-full h-full p-6">
        <div className="w-full h-full max-w-7xl mx-auto overflow-hidden">
          <div className="h-full flex flex-col p-4 gap-3 bg-black" style={{ fontFamily: 'IBM Plex Mono, Menlo, Monaco, monospace' }}>

            {/* Module Selector - Top */}
            <div className="flex-shrink-0">
              <ModuleSelector
                selectedModules={chatState.selectedModules}
                setSelectedModules={chatState.setSelectedModules}
                allModules={chatState.allModules}
              />
            </div>

            {/* Unified Control Bar - Function selector + Tabs */}
            <UnifiedControlBar
              selectedModules={chatState.selectedModules}
              selectedFunction={chatState.selectedFunction}
              setSelectedFunction={chatState.setSelectedFunction}
              fetchedSchemas={fetchedSchemas}
              isLoading={chatState.isLoading}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              canSubmit={canSubmit}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              pendingCount={0}
            />

            {/* Tab Content */}
            <div className="flex-1 min-h-0">
              {activeTab === 'chat' && (
                <ChatTab
                  messages={chatState.messages}
                  input={chatState.input}
                  setInput={chatState.setInput}
                  isLoading={chatState.isLoading}
                  onSubmit={handleSubmit}
                />
              )}

              {activeTab === 'params' && (
                <ParamsTab
                  params={chatState.params}
                  handleParamChange={handleParamChange}
                  handleResetParams={handleResetParams}
                  schema={combinedSchema}
                  selectedFunction={chatState.selectedFunction}
                />
              )}

              {activeTab === 'code' && (
                <CodeTab
                  selectedModules={chatState.selectedModules}
                  selectedFunction={chatState.selectedFunction}
                />
              )}

              {activeTab === 'outputs' && (
                <TxsTab
                  ref={transactionsPanelRef}
                  selectedModules={chatState.selectedModules}
                />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
