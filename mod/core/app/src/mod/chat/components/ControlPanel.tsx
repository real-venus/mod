'use client'

import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { UnifiedInputPanel } from './UnifiedInputPanel'
import { TransactionsPanel } from './transactions/TransactionsPanel'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-t-2 border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
        <div className="flex items-start gap-2 px-3 pt-3">
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
        
        {/* Unified Input Panel with Mode Toggle */}
        <div className="px-3 pt-3 pb-3">
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
          />
        </div>
      </div>
    </div>
  )
}
