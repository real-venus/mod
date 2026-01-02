'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useChatState } from '@/bloc/chat/hooks/useChatState'
import { useConfigState } from '@/bloc/chat/hooks/useConfigState'
import { useChatEffects } from '@/bloc/chat/hooks/useChatEffects'
import { Message } from '@/bloc/chat/types'
import { ChatMessages } from '@/bloc/chat/components/ChatMessages'
import { TransactionsPanel } from '@/bloc/chat/components/TransactionsPanel'
import { ControlPanel } from '@/bloc/chat/components/ControlPanel'
import { useControlPanelContext } from '@/bloc/context/ControlPanelContext'
import { usePathname } from 'next/navigation'

export default function GlobalControlPanel() {
  const chatState = useChatState()
  const configState = useConfigState()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [outputMode, setOutputMode] = useState<'chat' | 'transactions'>('transactions')
  const transactionsPanelRef = useRef<{ handleSync: () => void } | null>(null)
  const { isControlPanelCollapsed, setIsControlPanelCollapsed } = useControlPanelContext()
  const pathname = usePathname()

  useChatEffects(chatState)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatState.messages, chatState.streamingContent])


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!configState.isDragging) return
      if (configState.configOrientation === 'vertical') {
        const newPos = window.innerWidth - e.clientX
        if (newPos > 200 && newPos < window.innerWidth - 200) {
          configState.setDividerPosition(newPos)
        }
      } else if (configState.configOrientation === 'horizontal') {
        const newPos = window.innerHeight - e.clientY
        if (newPos > 200 && newPos < window.innerHeight - 200) {
          configState.setDividerPosition(newPos)
        }
      } else if (configState.configOrientation === 'left') {
        const newPos = e.clientX
        if (newPos > 200 && newPos < window.innerWidth - 200) {
          configState.setDividerPosition(newPos)
        }
      } else if (configState.configOrientation === 'top') {
        const newPos = e.clientY
        if (newPos > 200 && newPos < window.innerHeight - 200) {
          configState.setDividerPosition(newPos)
        }
      }
    }

    const handleMouseUp = () => {
      if (configState.isDragging) {
        configState.setIsDragging(false)
        localStorage.setItem('chat_divider_position', configState.dividerPosition.toString())
      }
    }

    if (configState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [configState.isDragging, configState.dividerPosition, configState.configOrientation])

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
      const cancelMessage: Message = {
        role: 'assistant',
        content: 'Transaction cancelled by user',
        timestamp: Date.now(),
      }
      chatState.setMessages(prev => [...prev, cancelMessage])
    }
  }

  const handleRefresh = async () => {
    chatState.setMessages([])
    if (!chatState.client) return
    try {
      const mods = await chatState.client.call('mods', {})
      const sortedMods = Array.isArray(mods) ? mods.sort((a, b) => a.name.localeCompare(b.name)) : []
      chatState.setModules(sortedMods)
    } catch (err) {
      console.error('Failed to refresh modules:', err)
    }
  }

  const handleResetParams = () => {
    chatState.setParams(chatState.defaultParams)
  }

  const handleParamChange = (key: string, value: string) => {
    chatState.setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (chatState.isLoading || !chatState.selectedModule || !chatState.selectedFunction) return

    chatState.setMessages(prev => [...prev, {
      role: 'user',
      content: chatState.input.trim() || 'Using default parameters',
      timestamp: Date.now(),
      module: chatState.selectedModule,
      function: chatState.selectedFunction,
      params: chatState.params
    }])
    chatState.setInput('')
    chatState.setIsLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    try {
      if (!chatState.client) throw new Error('Client not initialized')
      let callParams = { ...chatState.params }
      if (chatState.input.trim() && chatState.selectedInputParam) {
        callParams[chatState.selectedInputParam] = chatState.input.trim()
      }
      const result = await chatState.client.call('call', {
        fn: `${chatState.selectedModule}/${chatState.selectedFunction}`,
        params: callParams,
        wait: chatState.wait
      }, 0, {}, chatState.timeout * 1000)

      if (!controller.signal.aborted) {
        chatState.setMessages(prev => [...prev, {
          role: 'assistant',
          content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          timestamp: Date.now()
        }])
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        chatState.setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
          timestamp: Date.now()
        }])
      }
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }

  const inputParamOptions = chatState.selectedFunction && chatState.schema && chatState.schema[chatState.selectedFunction]?.input
    ? Object.keys(chatState.schema[chatState.selectedFunction].input).filter(k => k !== 'self' && k !== 'cls')
    : []

  const getMarginStyle = () => {
    if (configState.isConfigCollapsed) return {}
    switch(configState.configOrientation) {
      case 'vertical': return { marginRight: `${configState.dividerPosition}px` }
      case 'horizontal': return { marginBottom: `${configState.dividerPosition}px` }
      case 'left': return { marginLeft: `${configState.dividerPosition}px` }
      case 'top': return { marginTop: `${configState.dividerPosition}px` }
    }
  }

  const isChatPage = pathname === '/chat'

  if (!isChatPage) return null

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: "IBM Plex Mono, Courier New, monospace" }}>

      <ControlPanel
        selectedModule={chatState.selectedModule}
        setSelectedModule={chatState.setSelectedModule}
        selectedFunction={chatState.selectedFunction}
        setSelectedFunction={chatState.setSelectedFunction}
        modules={chatState.modules}
        functions={chatState.functions}
        schema={chatState.schema}
        params={chatState.params}
        handleParamChange={handleParamChange}
        handleResetParams={handleResetParams}
        handleRefresh={handleRefresh}
        configOrientation={configState.configOrientation}
        setConfigOrientation={configState.setConfigOrientation}
        messages={chatState.messages}
        messagesEndRef={messagesEndRef}
        input={chatState.input}
        setInput={chatState.setInput}
        selectedInputParam={chatState.selectedInputParam}
        setSelectedInputParam={chatState.setSelectedInputParam}
        wait={chatState.wait}
        setWait={chatState.setWait}
        isLoading={chatState.isLoading}
        inputParamOptions={inputParamOptions}
        handleSubmit={handleSubmit}
        onCancel={handleCancel}
        isCollapsed={configState.isConfigCollapsed}
        setIsCollapsed={configState.setIsConfigCollapsed}
      />
    </div>
  )
}
