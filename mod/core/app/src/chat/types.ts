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

// Chat State Types
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

  // Module Selection - NOW USING OBJECTS
  selectedModules: Module[]
  setSelectedModules: (modules: Module[]) => void
  selectedFunction: string
  setSelectedFunction: (fn: string) => void

  // Module Data
  allModules: Module[]
  setAllModules: (modules: Module[]) => void

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

  // Client
  client: Client | null
}

// Tab Types
export type TabType = 'chat' | 'params' | 'code' | 'txs'

// UI State
export interface UIState {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

// Transactions Panel
export interface TransactionsPanelRef {
  handleSync: () => void
}
