"use client";

import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { UnifiedInputPanel } from './UnifiedInputPanel'
import { useState, useMemo } from 'react'

interface ControlPanelProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: any[]
  functions: string[]
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  handleRefresh: () => void
  configOrientation: 'vertical' | 'horizontal' | 'left' | 'top'
  setConfigOrientation: (value: 'vertical' | 'horizontal' | 'left' | 'top') => void
  messages: any[]
  messagesEndRef: any
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (value: string) => void
  wait: boolean
  setWait: (value: boolean) => void
  isLoading: boolean
  inputParamOptions: string[]
  handleSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
  transactionsPanelRef: any
}

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

  const handleModFnEnterPress = () => {
    if (selectedModule && selectedFunction) {
      const inputElement = document.querySelector('textarea[placeholder="enter your message..."]') as HTMLTextAreaElement
      if (inputElement) {
        inputElement.focus()
      }
    }
  }

  // Check if function has code in schema
  const functionHasCode = useMemo(() => {
    if (!selectedFunction || !schema || !schema[selectedFunction]) return false
    return !!schema[selectedFunction]?.content
  }, [selectedFunction, schema])

  const [activeTab, setActiveTab] = useState<'chat' | 'params' | 'code'>('chat')

  // Auto-switch to code tab if code exists and not already on a tab
  useMemo(() => {
    if (functionHasCode && activeTab === 'chat') {
      // Don't auto-switch, just make it available
    }
  }, [functionHasCode, activeTab])

  return (
    <div className="h-full flex flex-col p-4 bg-black/95 backdrop-blur-xl" style={{ fontSize: '1rem' }}>
      {/* ModuleFunctionSelector and Chat/Params on same line */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
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
      </div>

      <div className="flex-1 overflow-y-auto">
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
        />
      </div>
    </div>
  )
}
