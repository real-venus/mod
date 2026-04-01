"use client";

import { useState, useEffect } from 'react'

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    const savedWidth = localStorage.getItem('wallet_sidebar_width')
    if (savedWidth) setSidebarWidth(parseInt(savedWidth))
  }, [])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.max(300, Math.min(800, newWidth)))
    }
    const handleMouseUp = () => {
      setIsResizing(false)
      localStorage.setItem('wallet_sidebar_width', sidebarWidth.toString())
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, sidebarWidth])

  return { sidebarWidth, isResizing, setIsResizing }
}
