"use client";

import { useState } from 'react'
import { userContext } from '@/context'
import type { ChatState, Module, Message } from '../types'
import { DEFAULT_TIMEOUT, DEFAULT_WAIT } from '../constants'

/**
 * Custom hook to manage chat state
 * NOW USING MODULE OBJECTS instead of just names
 */
export function useChatState(): ChatState {
  const { client } = userContext()

  // Messages
  const [messages, setMessages] = useState<Message[]>([])

  // Input
  const [input, setInput] = useState<string>('')

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Module selection - NOW USING OBJECTS - Default to model.openrouter/forward
  const [selectedModules, setSelectedModules] = useState<Module[]>([{ name: 'model.openrouter', key: 'model.openrouter' }])
  const [selectedFunction, setSelectedFunction] = useState<string>('forward')

  // All available modules
  const [allModules, setAllModules] = useState<Module[]>([])

  // Parameters
  const [params, setParams] = useState<Record<string, any>>({})
  const [defaultParams, setDefaultParams] = useState<Record<string, any>>({})

  // Settings
  const [chatTimeout, setChatTimeout] = useState<number>(DEFAULT_TIMEOUT)
  const [wait, setWait] = useState<boolean>(DEFAULT_WAIT)

  // Input parameter selection
  const [selectedInputParam, setSelectedInputParam] = useState<string>('')

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

    // Module selection
    selectedModules,
    setSelectedModules,
    selectedFunction,
    setSelectedFunction,

    // Module data
    allModules,
    setAllModules,

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

    // Client
    client
  }
}
