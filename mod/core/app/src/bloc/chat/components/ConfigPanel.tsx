'use client'

import { ChatInput } from './ChatInput'
import { ModuleFunctionSelector } from './ModuleFunctionSelector'
import { SchemaParamsPanel } from './SchemaParamsPanel'
import { ConfigOrientationControls } from './ConfigOrientationControls'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

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

export function ConfigPanel({
  selectedModule, setSelectedModule, selectedFunction, setSelectedFunction,
  modules, functions, schema, params, handleParamChange, handleResetParams,
  handleRefresh, configOrientation, setConfigOrientation,
  messages, messagesEndRef, input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, inputParamOptions, handleSubmit, onCancel,
  isCollapsed, setIsCollapsed
}: ConfigPanelProps) {

  if (isCollapsed && setIsCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-24 right-4 p-3 bg-gradient-to-r from-green-500/20 to-green-600/10 text-green-400 border-2 border-green-500/40 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/60 rounded-full transition-all duration-200 shadow-lg z-50"
        title="Expand Config Panel"
      >
        <ChevronRightIcon className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900/95 to-black/90 backdrop-blur-md relative" style={{ paddingTop: '5%' }}>
      {setIsCollapsed && (
      <button
        onClick={() => setIsCollapsed(true)}
        className="fixed bottom-24 right-4 p-3 bg-gradient-to-r from-green-500/20 to-green-600/10 text-green-400 border-2 border-green-500/40 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/60 rounded-full transition-all duration-200 shadow-lg z-50"
        title="Expand Config Panel"
      >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
      )}



      <ModuleFunctionSelector
        selectedModule={selectedModule}
        setSelectedModule={setSelectedModule}
        selectedFunction={selectedFunction}
        setSelectedFunction={setSelectedFunction}
        modules={modules}
        functions={functions}
      />
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


      <SchemaParamsPanel
        selectedFunction={selectedFunction}
        schema={schema}
        params={params}
        handleParamChange={handleParamChange}
        handleResetParams={handleResetParams}
      />

      <ConfigOrientationControls
        configOrientation={configOrientation}
        setConfigOrientation={setConfigOrientation}
      />
    </div>
  )
}
