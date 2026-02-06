"use client";

import { useState, useRef, useEffect, ReactNode } from 'react'

interface DraggableSplitPanelProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
}

export function DraggableSplitPanel({ leftPanel, rightPanel }: DraggableSplitPanelProps) {
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>('vertical')
  const [dividerPosition, setDividerPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      
      const container = containerRef.current.getBoundingClientRect()
      
      if (splitOrientation === 'vertical') {
        const newPosition = ((e.clientX - container.left) / container.width) * 100
        setDividerPosition(Math.min(Math.max(newPosition, 10), 90))
      } else {
        const newPosition = ((e.clientY - container.top) / container.height) * 100
        setDividerPosition(Math.min(Math.max(newPosition, 10), 90))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, splitOrientation])

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      <div 
        ref={containerRef}
        className={`flex ${splitOrientation === 'vertical' ? 'flex-row' : 'flex-col'} w-full h-full gap-0 p-2 relative`}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex gap-2">
          <button
            onClick={() => setSplitOrientation('vertical')}
            className={`px-4 py-2 ${splitOrientation === 'vertical' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all font-bold`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            title="Vertical Split"
          >
            ⚌ vertical
          </button>
          <button
            onClick={() => setSplitOrientation('horizontal')}
            className={`px-4 py-2 ${splitOrientation === 'horizontal' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all font-bold`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            title="Horizontal Split"
          >
            ⚏ horizontal
          </button>
        </div>

        <div 
          className="overflow-hidden border-2 border-orange-500/40 rounded-lg bg-black/40"
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: `${dividerPosition}%`
          }}
        >
          {leftPanel}
        </div>

        <div
          className={`bg-orange-500/40 hover:bg-orange-500/60 cursor-${splitOrientation === 'vertical' ? 'col' : 'row'}-resize transition-colors z-10 ${isDragging ? 'bg-orange-500/80' : ''}`}
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: '4px',
            [splitOrientation === 'vertical' ? 'height' : 'width']: '100%'
          }}
          onMouseDown={() => setIsDragging(true)}
        />

        <div 
          className="overflow-hidden flex flex-col"
          style={{
            [splitOrientation === 'vertical' ? 'width' : 'height']: `${100 - dividerPosition}%`
          }}
        >
          {rightPanel}
        </div>
      </div>
    </div>
  )
}
