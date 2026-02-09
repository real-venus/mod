'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'
type EffectiveTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  effectiveTheme: EffectiveTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark')
  const [mounted, setMounted] = useState(false)

  // Get system theme preference
  const getSystemTheme = (): EffectiveTheme => {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // Determine effective theme based on user preference and system
  const resolveEffectiveTheme = (userTheme: Theme): EffectiveTheme => {
    if (userTheme === 'system') {
      return getSystemTheme()
    }
    return userTheme
  }

  // Apply theme to document
  const applyTheme = (effective: EffectiveTheme) => {
    const root = document.documentElement

    // Remove existing theme
    root.removeAttribute('data-theme')
    root.classList.remove('light', 'dark')

    // Apply new theme
    root.setAttribute('data-theme', effective)
    root.classList.add(effective)

    setEffectiveTheme(effective)
  }

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true)

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const initialTheme = savedTheme || 'system'

    setThemeState(initialTheme)
    applyTheme(resolveEffectiveTheme(initialTheme))
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(getSystemTheme())
      }
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [theme, mounted])

  // Update theme
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(resolveEffectiveTheme(newTheme))
  }

  const value: ThemeContextType = {
    theme,
    effectiveTheme,
    setTheme,
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
