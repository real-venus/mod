"use client";

import { useState } from 'react'
import { userContext } from '@/context'
import type { ChatState, Module, ModuleSchema, Message } from '../types'
import { DEFAULT_TIMEOUT, DEFAULT_WAIT, DEFAULT_MODULE, DEFAULT_FUNCTION } from '../constants'

/**
 * Custom hook to manage chat state
 * Centralizes all state management for the chat interface
 *
 * @returns ChatState object with all state and setters
 */
export function useChatState(): ChatState {
  const { client } = userContext()

  // Messages
  const [messages, setMessages] = useState<Message[]>([])

  // Input
  const [input, setInput] = useState<string>('')

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [streamingContent, setStreamingContent] = useState<string>('')

  // Module selection
  const [selectedModule, setSelectedModule] = useState<string>(DEFAULT_MODULE)
  const [selectedFunction, setSelectedFunction] = useState<string>(DEFAULT_FUNCTION)

  // Module data
  const [modules, setModules] = useState<Module[]>([])
  const [functions, setFunctions] = useState<string[]>([])
  const [schema, setSchema] = useState<ModuleSchema | null>(null)

  // Parameters
  const [params, setParams] = useState<Record<string, any>>({})
  const [defaultParams, setDefaultParams] = useState<Record<string, any>>({})

  // Settings
  const [chatTimeout, setChatTimeout] = useState<number>(DEFAULT_TIMEOUT)
  const [wait, setWait] = useState<boolean>(DEFAULT_WAIT)

  // Input parameter selection
  const [selectedInputParam, setSelectedInputParam] = useState<string>('')

  // UI state
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)

  return {
    // Messages
    messages,
    setMessages,

    // Input
    input,
    setInput,

    // Loading
    isLoading,
    setIsLoading,
    streamingContent,
    setStreamingContent,

    // Module selection
    selectedModule,
    setSelectedModule,
    selectedFunction,
    setSelectedFunction,

    // Module data
    modules,
    setModules,
    functions,
    setFunctions,
    schema,
    setSchema,

    // Parameters
    params,
    setParams,
    defaultParams,
    setDefaultParams,

    // Settings
    timeout: chatTimeout,
    setTimeout: setChatTimeout,
    wait,
    setWait,

    // Input parameter selection
    selectedInputParam,
    setSelectedInputParam,

    // UI state
    openDropdown,
    setOpenDropdown,

    // Client
    client
  }
}
