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

  // Initialize theme on mount - just read state, don't apply DOM changes
  // The named theme system (ThemeInitializer + themeConfig.applyTheme) handles DOM
  useEffect(() => {
    setMounted(true)

    // Read the light/dark preference (may have been set by ThemeInitializer)
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const initialTheme = savedTheme || 'system'

    setThemeState(initialTheme)
    setEffectiveTheme(resolveEffectiveTheme(initialTheme))
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'system') {
        setEffectiveTheme(getSystemTheme())
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, mounted])

  // Update theme - just update React state, the named theme system handles DOM
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    setEffectiveTheme(resolveEffectiveTheme(newTheme))
  }

  const value: ThemeContextType = {
    theme,
    effectiveTheme,
    setTheme,
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
