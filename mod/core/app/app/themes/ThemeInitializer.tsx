"use client"

import { useEffect } from 'react'
import { themes, defaultTheme, getTheme, applyTheme } from './themeConfig'

/**
 * Global theme initializer that mounts once and loads the saved theme.
 * This is the PRIMARY theme system. It manages named themes (classic, light,
 * glass, etc.) and syncs the light/dark class on <html> accordingly.
 */
export function ThemeInitializer() {
  useEffect(() => {
    // Load saved named theme from localStorage
    const savedTheme = localStorage.getItem('app_theme') || defaultTheme
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

    // Apply the saved theme (this also sets light/dark class on <html>)
    applyTheme(allThemes[savedTheme] || getTheme(savedTheme))
  }, []) // Only run once on mount

  return null // This component doesn't render anything
}
