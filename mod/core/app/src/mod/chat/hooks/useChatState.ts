'use client'

import { useState, useEffect } from 'react'
import { useUserContext } from '@/mod/context'
import { ChatState } from '../types'

export function useChatState() {
  const { client } = useUserContext()
  const [messages, setMessages] = useState<ChatState['messages']>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedModule, setSelectedModule] = useState('api')
  const [selectedFunction, setSelectedFunction] = useState('edit')
  const [modules, setModules] = useState<any[]>([])
  const [functions, setFunctions] = useState<string[]>([])
  const [schema, setSchema] = useState<any>(null)
  const [params, setParams] = useState<Record<string, any>>({})
  const [defaultParams, setDefaultParams] = useState<Record<string, any>>({})
  const [timeout, setTimeout] = useState<number>(30)
  const [wait, setWait] = useState<boolean>(false)
  const [selectedInputParam, setSelectedInputParam] = useState<string>('')
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)

  return {
    messages, setMessages,
    input, setInput,
    isLoading, setIsLoading,
    streamingContent, setStreamingContent,
    selectedModule, setSelectedModule,
    selectedFunction, setSelectedFunction,
    modules, setModules,
    functions, setFunctions,
    schema, setSchema,
    params, setParams,
    defaultParams, setDefaultParams,
    timeout, setTimeout,
    wait, setWait,
    selectedInputParam, setSelectedInputParam,
    openDropdown, setOpenDropdown,
    client
  }
}
