'use client'

import { ChatInput } from './ChatInput'
import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { SchemaParamsPanel } from './SchemaParamsPanel'
import { ConfigOrientationControls } from './ConfigOrientationControls'
import { ChatOutputPanel } from './ChatOutputPanel'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface ChatControlPanelProps {
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

export function ChatControlPanel({
  selectedModule, setSelectedModule, selectedFunction, setSelectedFunction,
  modules, functions, schema, params, handleParamChange, handleResetParams,
  handleRefresh, configOrientation, setConfigOrientation,
  messages, messagesEndRef, input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, inputParamOptions, handleSubmit, onCancel,
  isCollapsed, setIsCollapsed
}: ChatControlPanelProps) {

  if (isCollapsed && setIsCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed top-1/2 right-0 -translate-y-1/2 p-4 bg-gradient-to-l from-orange-500/30 to-orange-600/20 text-orange-400 border-2 border-orange-500/50 hover:from-orange-500/40 hover:to-orange-600/30 hover:border-orange-500/70 rounded-l-xl transition-all duration-200 shadow-lg z-50 hover:scale-110 active:scale-95"
        title="Expand Chat Control Panel"
      >
        <ChevronLeftIcon className="w-8 h-8" />
      </button>
    )
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-96 bg-black/95 backdrop-blur-md border-l-4 border-orange-500/60 shadow-2xl shadow-orange-500/20 z-40 flex flex-col overflow-hidden">
      {setIsCollapsed && (
      <button
        onClick={() => setIsCollapsed(true)}
        className="absolute top-4 left-4 p-3 bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border-2 border-orange-500/40 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-500/60 rounded-lg transition-all duration-200 shadow-lg z-50 hover:scale-110 active:scale-95"
        title="Collapse Chat Control Panel"
      >
        <ChevronRightIcon className="w-6 h-6" />
      </button>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-8 mt-16 space-y-6">
        <div className="border-b-2 border-orange-500/40 pb-4">
          <h2 className="text-2xl font-bold text-orange-400 tracking-wide">CHAT CONTROL</h2>
        </div>

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
          />
        </div>

        <div className="border-t-2 border-orange-500/30 pt-4">
          <SchemaParamsPanel
            selectedFunction={selectedFunction}
            schema={schema}
            params={params}
            handleParamChange={handleParamChange}
            handleResetParams={handleResetParams}
          />
        </div>

        <div className="border-t-2 border-orange-500/30 pt-4">
          <ChatOutputPanel
            messages={messages}
            isLoading={isLoading}
          />
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
