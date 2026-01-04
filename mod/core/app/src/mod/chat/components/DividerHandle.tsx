'use client'

import { useState } from 'react'

interface DividerHandleProps {
  orientation: 'vertical' | 'horizontal'
  onDragStart: () => void
  position: number
}

export function DividerHandle({ orientation, onDragStart, position }: DividerHandleProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onDragStart()
  }

  const isVertical = orientation === 'vertical'

  return (
    <div
      className={`
        ${isVertical ? 'cursor-col-resize w-2 h-full' : 'cursor-row-resize h-2 w-full'}
        ${isHovered ? 'bg-blue-500/60' : 'bg-blue-500/30'}
        hover:bg-blue-500/60
        transition-all
        relative
        group
        z-50
      `}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        ...(isVertical ? {
          right: `${position}px`,
          top: 0,
          transform: 'translateX(50%)'
        } : {
          bottom: `${position}px`,
          left: 0,
          transform: 'translateY(50%)'
        })
      }}
    >
      <div className={`
        absolute
        ${isVertical ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 w-12'}
        bg-blue-400/80
        rounded-full
        group-hover:bg-blue-300
        transition-all
      `} />
    </div>
  )
}
