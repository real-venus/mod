'use client'

import { useState, useEffect, useRef } from 'react'

interface ResizableDividerProps {
  orientation: 'horizontal' | 'vertical'
  initialPosition?: number
  minPosition?: number
  maxPosition?: number
  onPositionChange?: (position: number) => void
}

export function ResizableDivider({
  orientation,
  initialPosition = 400,
  minPosition = 200,
  maxPosition,
  onPositionChange
}: ResizableDividerProps) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dividerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      let newPosition: number
      if (orientation === 'vertical') {
        newPosition = e.clientX
      } else {
        newPosition = e.clientY
      }

      const max = maxPosition || (orientation === 'vertical' ? window.innerWidth : window.innerHeight) - minPosition
      
      if (newPosition >= minPosition && newPosition <= max) {
        setPosition(newPosition)
        onPositionChange?.(newPosition)
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        localStorage.setItem(`divider_${orientation}`, position.toString())
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, orientation, position, minPosition, maxPosition, onPositionChange])

  useEffect(() => {
    const saved = localStorage.getItem(`divider_${orientation}`)
    if (saved) {
      const savedPos = parseInt(saved, 10)
      if (!isNaN(savedPos)) {
        setPosition(savedPos)
        onPositionChange?.(savedPos)
      }
    }
  }, [orientation, onPositionChange])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleMouseDown}
      className={`
        ${orientation === 'vertical' ? 'w-1 cursor-col-resize hover:w-2' : 'h-1 cursor-row-resize hover:h-2'}
        bg-gradient-to-r from-green-500/30 via-green-400/50 to-green-500/30
        hover:from-green-500/60 hover:via-green-400/80 hover:to-green-500/60
        transition-all duration-200 ease-in-out
        ${isDragging ? 'bg-green-400/90 shadow-lg shadow-green-500/50' : ''}
        relative z-50
        group
      `}
      style={{
        [orientation === 'vertical' ? 'left' : 'top']: `${position}px`,
        position: 'absolute',
        [orientation === 'vertical' ? 'top' : 'left']: 0,
        [orientation === 'vertical' ? 'bottom' : 'right']: 0,
      }}
    >
      <div className={`
        absolute ${orientation === 'vertical' ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'}
        ${orientation === 'vertical' ? 'w-6 h-12' : 'w-12 h-6'}
        bg-green-500/20 border-2 border-green-400/40 rounded-lg
        opacity-0 group-hover:opacity-100 transition-opacity
        flex items-center justify-center
        pointer-events-none
      `}>
        <div className={`${orientation === 'vertical' ? 'flex-col' : 'flex-row'} flex gap-0.5`}>
          <div className="w-0.5 h-0.5 bg-green-400 rounded-full" />
          <div className="w-0.5 h-0.5 bg-green-400 rounded-full" />
          <div className="w-0.5 h-0.5 bg-green-400 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function useResizableDivider(orientation: 'horizontal' | 'vertical', initialPosition = 400) {
  const [position, setPosition] = useState(initialPosition)

  useEffect(() => {
    const saved = localStorage.getItem(`divider_${orientation}`)
    if (saved) {
      const savedPos = parseInt(saved, 10)
      if (!isNaN(savedPos)) setPosition(savedPos)
    }
  }, [orientation])

  return { position, setPosition }
}