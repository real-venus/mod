'use client'

import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { ChatInput } from './ChatInput'
import { TransactionsPanel } from './TransactionsPanel'
import { SchemaParamsPanel } from './SchemaParamsPanel'
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
  const [activeTab, setActiveTab] = useState<'chat' | 'params'>('chat')
  const [isParamsExpanded, setIsParamsExpanded] = useState(false)

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
        <ModuleFunctionSelector
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          modules={modules}
          functions={functions}
          onEnterPress={handleModFnEnterPress}
        />
        
        {/* Chat Input at Top */}
        <div className="px-3 pt-3">
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


        {/* Send Button Below Parameters */}
        <div className="px-3 pb-3">
          <form onSubmit={handleSubmit}>
            {isLoading ? (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 rounded-lg transition-all font-bold text-lg w-full"
                style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              >
                cancel
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-3 bg-orange-500/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-500/30 rounded-lg transition-all font-bold text-lg w-full"
                style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                disabled={!selectedModule || !selectedFunction}
              >
                send
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
