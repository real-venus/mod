"use client";

import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { UnifiedInputPanel } from './UnifiedInputPanel'
import { useState, useMemo } from 'react'
import type { ControlPanelProps } from '../types'
import { focusElement } from '../utils'

export function ControlPanel({
  selectedModule,
  setSelectedModule,
  selectedFunction,
  setSelectedFunction,
  modules,
  functions,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  handleRefresh,
  configOrientation,
  setConfigOrientation,
  messages,
  messagesEndRef,
  input,
  setInput,
  selectedInputParam,
  setSelectedInputParam,
  wait,
  setWait,
  isLoading,
  inputParamOptions,
  handleSubmit,
  onCancel,
  isCollapsed,
  setIsCollapsed,
  transactionsPanelRef
}: ControlPanelProps) {

  /**
   * Focuses the chat input after module/function selection
   */
  const handleModFnEnterPress = () => {
    if (selectedModule && selectedFunction) {
      focusElement('textarea[placeholder="enter your message..."]')
    }
  }

  // Check if function has code in schema
  const functionHasCode = useMemo(() => {
    if (!selectedFunction || !schema || !schema[selectedFunction]) return false
    return !!schema[selectedFunction]?.content
  }, [selectedFunction, schema])

  const [activeTab, setActiveTab] = useState<'chat' | 'params' | 'code' | 'txs'>('chat')

  // Auto-switch to code tab if code exists and not already on a tab
  useMemo(() => {
    if (functionHasCode && activeTab === 'chat') {
      // Don't auto-switch, just make it available
    }
  }, [functionHasCode, activeTab])

  return (
    <div className="h-full flex flex-col p-4 gap-4 bg-black/95 backdrop-blur-xl" style={{ fontSize: '1rem' }}>
      {/* Module/Function Selector */}
      <div className="flex-shrink-0">
        <ModuleFunctionSelector
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          modules={modules}
          functions={functions}
          onEnterPress={handleModFnEnterPress}
        />
      </div>

      {/* Input Panel - takes remaining space */}
      <div className="flex-1 min-h-0">
        <UnifiedInputPanel
          input={input}
          setInput={setInput}
          selectedInputParam={selectedInputParam}
          setSelectedInputParam={setSelectedInputParam}
          wait={wait}
          setWait={setWait}
          isLoading={isLoading}
          selectedModule={selectedModule}
          selectedFunction={selectedFunction}
          inputParamOptions={inputParamOptions}
          handleSubmit={handleSubmit}
          onCancel={onCancel}
          params={params}
          handleParamChange={handleParamChange}
          handleResetParams={handleResetParams}
          schema={schema}
          functionHasCode={functionHasCode}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          transactionsPanelRef={transactionsPanelRef}
        />
      </div>
    </div>
  )
}
