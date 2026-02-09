/**
 * Core types for the chat interface
 */

// API Client Types
export interface Client {
  call: <T = any>(method: string, params: Record<string, any>, ...args: any[]) => Promise<T>
  token?: string
}

// Module Schema Types
export interface SchemaInputParam {
  type: string
  value: string | number | boolean
}

export interface FunctionSchema {
  input: Record<string, SchemaInputParam>
  output?: Record<string, any>
  cost?: number
  content?: string
}

export interface ModuleSchema {
  [functionName: string]: FunctionSchema
}

export interface Module {
  name: string
  key: string
  cid?: string
  schema?: string | ModuleSchema
  owner?: string
  version?: string
}

// Message Types
export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  module?: string
  function?: string
  params?: Record<string, any>
  isLoading?: boolean
}

// Transaction Types
export interface Transaction {
  fn: string
  params: any
  status: 'success' | 'error' | 'pending' | 'finished' | 'complete' | 'failed' | 'cancelled' | 'running'
  time: string
  key: string
  signature: string
  result?: any
  cid?: string
  hash?: string
  delta?: number
  client?: string
  cost?: number
  module?: string
  owner?: string
}

// State Types
export interface ChatState {
  // Messages
  messages: Message[]
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void

  // Input
  input: string
  setInput: (input: string) => void

  // Loading
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  streamingContent: string
  setStreamingContent: (content: string) => void

  // Module Selection
  selectedModule: string
  setSelectedModule: (module: string) => void
  selectedFunction: string
  setSelectedFunction: (fn: string) => void

  // Module Data
  modules: Module[]
  setModules: (modules: Module[]) => void
  functions: string[]
  setFunctions: (functions: string[]) => void
  schema: ModuleSchema | null
  setSchema: (schema: ModuleSchema | null) => void

  // Parameters
  params: Record<string, any>
  setParams: (params: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  defaultParams: Record<string, any>
  setDefaultParams: (params: Record<string, any>) => void

  // Settings
  timeout: number
  setTimeout: (timeout: number) => void
  wait: boolean
  setWait: (wait: boolean) => void

  // Input Parameter Selection
  selectedInputParam: string
  setSelectedInputParam: (param: string) => void

  // UI State
  openDropdown: number | null
  setOpenDropdown: (index: number | null) => void

  // Client
  client: Client | null
}

export interface ConfigState {
  dividerPosition: number
  setDividerPosition: (position: number) => void
  isDragging: boolean
  setIsDragging: (dragging: boolean) => void
  isConfigCollapsed: boolean
  setIsConfigCollapsed: (collapsed: boolean) => void
  configOrientation: 'vertical' | 'horizontal' | 'left' | 'top'
  setConfigOrientation: (orientation: 'vertical' | 'horizontal' | 'left' | 'top') => void
}

// Component Props Types
export interface ControlPanelProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: Module[]
  functions: string[]
  schema: ModuleSchema | null
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  handleRefresh: () => void
  configOrientation: 'vertical' | 'horizontal' | 'left' | 'top'
  setConfigOrientation: (value: 'vertical' | 'horizontal' | 'left' | 'top') => void
  messages: Message[]
  messagesEndRef: React.RefObject<HTMLDivElement>
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
  transactionsPanelRef: React.RefObject<{ handleSync: () => void }>
}

export interface UnifiedInputPanelProps {
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (value: string) => void
  wait: boolean
  setWait: (value: boolean) => void
  isLoading: boolean
  selectedModule: string
  selectedFunction: string
  inputParamOptions: string[]
  handleSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  schema: ModuleSchema | null
  functionHasCode?: boolean
  activeTab?: 'chat' | 'params' | 'code'
  setActiveTab?: (tab: 'chat' | 'params' | 'code') => void
}

export interface SchemaParamsPanelProps {
  selectedFunction: string
  schema: ModuleSchema | null
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  numColumns?: number
}

export interface ModuleFunctionSelectorProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: Module[]
  functions: string[]
  onEnterPress?: () => void
  selectedOwner?: string
  setSelectedOwner?: (value: string) => void
}

export interface TransactionsPanelProps {
  hideTitle?: boolean
  showStats?: boolean
}

export interface TransactionsPanelRef {
  handleSync: () => void
}
