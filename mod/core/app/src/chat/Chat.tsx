"use client";

import { useRef, useState, useCallback, useMemo } from 'react'
import { useChatState } from './hooks/useChatState'
import { useModules } from './hooks/useModules'
import { useFetchedSchemas } from './hooks/useFetchedSchemas'
import { ModuleSelector } from './components/ModuleSelector'
import { TabBar } from './components/TabBar'
import { ChatTab } from './components/tabs/ChatTab'
import { ParamsTab } from './components/tabs/ParamsTab'
import { CodeTab } from './components/tabs/CodeTab'
import { TxsTab } from './components/tabs/TxsTab'
import type { TabType, TransactionsPanelRef, ModuleSchema } from './types'

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

  // Check if function has code
  const functionHasCode = useMemo(() => {
    if (!chatState.selectedFunction || !combinedSchema) return false
    return !!combinedSchema[chatState.selectedFunction]?.content
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
          },
          0,
          {},
          chatState.timeout * 1000
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
    <div className="relative flex h-full w-full bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 overflow-hidden">
      <div className="w-full h-full p-6">
        <div className="w-full h-full max-w-7xl mx-auto rounded-2xl border-2 border-neutral-800/50 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-full flex flex-col p-4 gap-4 bg-black/95 backdrop-blur-xl">

            {/* Module Selector - Top */}
            <div className="flex-shrink-0">
              <ModuleSelector
                selectedModules={chatState.selectedModules}
                setSelectedModules={chatState.setSelectedModules}
                allModules={chatState.allModules}
              />
            </div>

            {/* Tab Bar with Send/Cancel */}
            <TabBar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isLoading={chatState.isLoading}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              canSubmit={canSubmit}
              pendingCount={0}
              hasCode={functionHasCode}
            />

            {/* Tab Content */}
            <div className="flex-1 min-h-0">
              {activeTab === 'chat' && (
                <ChatTab
                  selectedModules={chatState.selectedModules}
                  selectedFunction={chatState.selectedFunction}
                  setSelectedFunction={chatState.setSelectedFunction}
                  input={chatState.input}
                  setInput={chatState.setInput}
                  selectedInputParam={chatState.selectedInputParam}
                  setSelectedInputParam={chatState.setSelectedInputParam}
                  inputParamOptions={inputParamOptions}
                  isLoading={chatState.isLoading}
                  onSubmit={handleSubmit}
                  fetchedSchemas={fetchedSchemas}
                />
              )}

              {activeTab === 'params' && (
                <ParamsTab
                  selectedModules={chatState.selectedModules}
                  selectedFunction={chatState.selectedFunction}
                  setSelectedFunction={chatState.setSelectedFunction}
                  schema={combinedSchema}
                  params={chatState.params}
                  handleParamChange={handleParamChange}
                  handleResetParams={handleResetParams}
                  fetchedSchemas={fetchedSchemas}
                />
              )}

              {activeTab === 'code' && (
                <CodeTab
                  selectedFunction={chatState.selectedFunction}
                  schema={combinedSchema}
                />
              )}

              {activeTab === 'txs' && <TxsTab ref={transactionsPanelRef} />}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
