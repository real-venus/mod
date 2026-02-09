"use client";

import { useEffect, useCallback, RefObject } from 'react'
import { MIN_DIVIDER_POSITION, MAX_DIVIDER_POSITION } from '../constants'

interface UseDividerDragParams {
  isDragging: boolean
  setDividerPosition: (position: number) => void
  splitOrientation: 'vertical' | 'horizontal'
  containerRef: RefObject<HTMLDivElement>
}

/**
 * Custom hook to handle divider dragging logic
 * Manages mouse events for resizing split panels
 *
 * @param params - Dragging parameters
 */
export function useDividerDrag({
  isDragging,
  setDividerPosition,
  splitOrientation,
  containerRef
}: UseDividerDragParams): void {
  /**
   * Handles mouse move during drag
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const container = containerRef.current.getBoundingClientRect()

      if (splitOrientation === 'vertical') {
        const newPosition = ((e.clientX - container.left) / container.width) * 100
        setDividerPosition(Math.min(Math.max(newPosition, MIN_DIVIDER_POSITION), MAX_DIVIDER_POSITION))
      } else {
        const newPosition = ((e.clientY - container.top) / container.height) * 100
        setDividerPosition(Math.min(Math.max(newPosition, MIN_DIVIDER_POSITION), MAX_DIVIDER_POSITION))
      }
    },
    [isDragging, splitOrientation, containerRef, setDividerPosition]
  )

  /**
   * Effect: Set up and clean up event listeners for dragging
   */
  useEffect(() => {
    if (!isDragging) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', () => {
      // Mouse up is handled in the parent component
    })

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isDragging, handleMouseMove])
}
