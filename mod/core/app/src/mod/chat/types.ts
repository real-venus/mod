export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  module?: string
  function?: string
  params?: Record<string, any>
  isLoading?: boolean
}

export interface ChatState {
  messages: Message[]
  input: string
  isLoading: boolean
  streamingContent: string
  selectedModule: string
  selectedFunction: string
  modules: any[]
  functions: string[]
  schema: any
  params: Record<string, any>
  defaultParams: Record<string, any>
  timeout: number
  wait: boolean
  selectedInputParam: string
  openDropdown: number | null
}

export interface ConfigState {
  dividerPosition: number
  isDragging: boolean
  isConfigCollapsed: boolean
  configOrientation: 'vertical' | 'horizontal' | 'left' | 'top'
}
