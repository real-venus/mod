'use client'

import { ChatInput } from './ChatInput'
import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { ConfigOrientationControls } from './ConfigOrientationControls'
import { TransactionsPanel } from './TransactionsPanel'
import { useState, useEffect, useRef } from 'react'

interface ConfigPanelProps {
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
  isCollapsed?: boolean
  setIsCollapsed?: (value: boolean) => void
}

export function ControlPanel({
  selectedModule, setSelectedModule, selectedFunction, setSelectedFunction,
  modules, functions, schema, params, handleParamChange, handleResetParams,
  handleRefresh, configOrientation, setConfigOrientation,
  messages, messagesEndRef, input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, inputParamOptions, handleSubmit, onCancel,
  isCollapsed, setIsCollapsed
}: ConfigPanelProps) {
  const [isTransactionsCollapsed, setIsTransactionsCollapsed] = useState(true)
  const transactionsPanelRef = useRef<{ handleSync: () => void } | null>(null)

  return (
    <div className="w-full h-full bg-black/95 backdrop-blur-md flex flex-col overflow-hidden">

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <ModuleFunctionSelector
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          modules={modules}
          functions={functions}
        />

        <div className="border-t-2 border-orange-500/30 pt-4">
          <ChatInput
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

        <div className="border-t-2 border-orange-500/30 pt-4">
          <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setIsTransactionsCollapsed(!isTransactionsCollapsed)}>
            <h3 className="text-orange-400 text-lg font-bold">TRANSACTIONS</h3>
            <span className="text-orange-400 text-xl">{isTransactionsCollapsed ? '▼' : '▲'}</span>
          </div>
          {!isTransactionsCollapsed && (
            <div className="max-h-96 overflow-y-auto">
              <TransactionsPanel ref={transactionsPanelRef} />
            </div>
          )}
        </div>

        <div className="border-t-2 border-orange-500/30 pt-4">
          <ConfigOrientationControls
            configOrientation={configOrientation}
            setConfigOrientation={setConfigOrientation}
          />
        </div>
      </div>
    </div>
  )
}
