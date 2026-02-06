"use client";

import { useState, useEffect } from 'react'
import { ConfigState } from '../types'

export function useConfigState() {
  const [dividerPosition, setDividerPosition] = useState(500)
  const [isDragging, setIsDragging] = useState(false)
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false)
  const [configOrientation, setConfigOrientation] = useState<'vertical' | 'horizontal' | 'left' | 'top'>('vertical')

  useEffect(() => {
    const saved = localStorage.getItem('chat_divider_position')
    if (saved) setDividerPosition(parseInt(saved))
  }, [])

  return {
    dividerPosition, setDividerPosition,
    isDragging, setIsDragging,
    isConfigCollapsed, setIsConfigCollapsed,
    configOrientation, setConfigOrientation
  }
}
