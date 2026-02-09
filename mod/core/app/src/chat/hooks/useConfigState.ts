"use client";

import { useState, useEffect } from 'react'
import type { ConfigState } from '../types'
import {
  DEFAULT_DIVIDER_POSITION,
  DEFAULT_CONFIG_ORIENTATION,
  STORAGE_KEY_DIVIDER_POSITION
} from '../constants'

/**
 * Custom hook to manage configuration state
 * Handles panel layout, divider position, and collapse state
 * Persists divider position to localStorage
 *
 * @returns ConfigState object with all state and setters
 */
export function useConfigState(): ConfigState {
  const [dividerPosition, setDividerPosition] = useState<number>(DEFAULT_DIVIDER_POSITION)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false)
  const [configOrientation, setConfigOrientation] = useState<ConfigState['configOrientation']>(DEFAULT_CONFIG_ORIENTATION)

  /**
   * Effect: Load saved divider position from localStorage on mount
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DIVIDER_POSITION)
      if (saved) {
        const position = parseInt(saved, 10)
        if (!isNaN(position)) {
          setDividerPosition(position)
        }
      }
    } catch (error) {
      console.error('Failed to load divider position from localStorage:', error)
    }
  }, [])

  /**
   * Effect: Save divider position to localStorage when it changes
   */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DIVIDER_POSITION, dividerPosition.toString())
    } catch (error) {
      console.error('Failed to save divider position to localStorage:', error)
    }
  }, [dividerPosition])

  return {
    dividerPosition,
    setDividerPosition,
    isDragging,
    setIsDragging,
    isConfigCollapsed,
    setIsConfigCollapsed,
    configOrientation,
    setConfigOrientation
  }
}
