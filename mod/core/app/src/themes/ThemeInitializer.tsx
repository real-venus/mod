"use client"

import { useEffect } from 'react'
import { themes, getTheme, applyTheme } from './themeConfig'

/**
 * Global theme initializer that mounts once and loads the saved theme.
 * This component should be placed outside any conditionally rendered areas
 * to prevent theme resets when components mount/unmount.
 */
export function ThemeInitializer() {
  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('app_theme') || 'classic'
    const savedCustomThemes = localStorage.getItem('custom_themes')

    let allThemes = { ...themes }

    // Load custom themes if they exist
    if (savedCustomThemes) {
      try {
        const parsed = JSON.parse(savedCustomThemes)
        allThemes = { ...themes, ...parsed }
      } catch (e) {
        console.error('Failed to parse custom themes:', e)
      }
    }

    // Apply the saved theme
    applyTheme(allThemes[savedTheme] || getTheme(savedTheme))
  }, []) // Only run once on mount

  return null // This component doesn't render anything
}
