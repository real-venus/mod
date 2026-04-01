"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { themes, getTheme, applyTheme, type Theme } from './themeConfig'
import { SwatchIcon, CheckIcon } from '@heroicons/react/24/outline'

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<string>('classic')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('app_theme') || 'classic'
    setCurrentTheme(savedTheme)
    applyTheme(getTheme(savedTheme))
  }, [])

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId)
    localStorage.setItem('app_theme', themeId)
    applyTheme(getTheme(themeId))
    setIsOpen(false)
  }

  const theme = getTheme(currentTheme)

  return (
    <div className="relative">
      {/* Theme button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 border-2 transition-all hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-input)',
          borderColor: 'var(--border-color)',
          borderRadius: '0px',
          fontFamily: 'var(--font-digital)',
        }}
        title="Select theme"
      >
        <SwatchIcon className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
        <span className="flex-1 text-left text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {theme.name}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Theme dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 right-0 mb-2 border-2 overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              borderRadius: '0px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {Object.values(themes).map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:opacity-80"
                  style={{
                    backgroundColor: currentTheme === t.id ? 'var(--bg-input)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  {/* Color preview */}
                  <div className="flex gap-1">
                    <div
                      className="w-4 h-4 border"
                      style={{
                        backgroundColor: t.colors.text.primary,
                        borderColor: t.colors.border,
                      }}
                    />
                    <div
                      className="w-4 h-4 border"
                      style={{
                        backgroundColor: t.colors.accent.primary,
                        borderColor: t.colors.border,
                      }}
                    />
                    <div
                      className="w-4 h-4 border"
                      style={{
                        backgroundColor: t.colors.background,
                        borderColor: t.colors.border,
                      }}
                    />
                  </div>

                  <span
                    className="flex-1 text-left text-sm font-bold uppercase tracking-wider"
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-digital)',
                    }}
                  >
                    {t.name}
                  </span>

                  {/* Effects badges */}
                  <div className="flex gap-1">
                    {t.effects.glow && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold border"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-digital)',
                        }}
                      >
                        GLOW
                      </span>
                    )}
                    {t.effects.scanlines && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold border"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-digital)',
                        }}
                      >
                        SCAN
                      </span>
                    )}
                  </div>

                  {currentTheme === t.id && (
                    <CheckIcon className="w-5 h-5" style={{ color: 'var(--accent-success)' }} />
                  )}
                </button>
              ))}
            </div>

            {/* Custom theme hint */}
            <div
              className="px-4 py-2 text-xs text-center border-t"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-digital)',
              }}
            >
              MORE THEMES COMING SOON
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
