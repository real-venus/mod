"use client"

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { themes, getTheme, applyTheme, type Theme } from './themeConfig'
import {
  SwatchIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

interface CustomThemeColors {
  background: string
  surface: string
  input: string
  border: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  accentPrimary: string
  accentSecondary: string
  accentSuccess: string
  accentWarning: string
  accentError: string
}

export function ThemeSelectorCompact({ expandUpwards = false }: { expandUpwards?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<string>('classic')
  const [showCustomEditor, setShowCustomEditor] = useState(false)
  const [customThemes, setCustomThemes] = useState<Record<string, Theme>>({})
  const [editingTheme, setEditingTheme] = useState<string | null>(null)
  const [themeName, setThemeName] = useState('')

  // Custom theme colors
  const [colors, setColors] = useState<CustomThemeColors>({
    background: '#000000',
    surface: '#111111',
    input: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.5)',
    textTertiary: 'rgba(255, 255, 255, 0.25)',
    accentPrimary: '#ffffff',
    accentSecondary: '#cccccc',
    accentSuccess: '#00ff00',
    accentWarning: '#ffff00',
    accentError: '#ff0000',
  })

  // Effects
  const [glow, setGlow] = useState(false)
  const [scanlines, setScanlines] = useState(false)
  const [textShadow, setTextShadow] = useState(false)

  useEffect(() => {
    // Load saved theme and custom themes (but don't apply - ThemeInitializer handles that)
    const savedTheme = localStorage.getItem('app_theme') || 'classic'
    const savedCustomThemes = localStorage.getItem('custom_themes')

    setCurrentTheme(savedTheme)

    if (savedCustomThemes) {
      try {
        const parsed = JSON.parse(savedCustomThemes)
        setCustomThemes(parsed)
      } catch (e) {
        console.error('Failed to parse custom themes:', e)
      }
    }
  }, [])

  const getAllThemes = () => {
    return { ...themes, ...customThemes }
  }

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId)
    localStorage.setItem('app_theme', themeId)
    const allThemes = getAllThemes()
    applyTheme(allThemes[themeId] || getTheme(themeId))
    toast.success(`Theme: ${allThemes[themeId]?.name || themeId}`)
  }

  const loadThemeForEditing = (themeId: string) => {
    const theme = getAllThemes()[themeId]
    if (!theme) return

    setThemeName(theme.name)
    setColors({
      background: theme.colors.background,
      surface: theme.colors.surface,
      input: theme.colors.input,
      border: theme.colors.border,
      borderStrong: theme.colors.borderStrong,
      textPrimary: theme.colors.text.primary,
      textSecondary: theme.colors.text.secondary,
      textTertiary: theme.colors.text.tertiary,
      accentPrimary: theme.colors.accent.primary,
      accentSecondary: theme.colors.accent.secondary,
      accentSuccess: theme.colors.accent.success,
      accentWarning: theme.colors.accent.warning,
      accentError: theme.colors.accent.error,
    })
    setGlow(theme.effects.glow)
    setScanlines(theme.effects.scanlines)
    setTextShadow(theme.effects.textShadow)
    setEditingTheme(themeId)
    setShowCustomEditor(true)
  }

  const createNewCustomTheme = () => {
    const theme = getAllThemes()[currentTheme]
    if (theme) {
      loadThemeForEditing(currentTheme)
      setThemeName(`${theme.name} Custom`)
      setEditingTheme(null)
    }
  }

  const previewTheme = () => {
    const tempTheme: Theme = {
      id: 'preview',
      name: 'Preview',
      colors: {
        background: colors.background,
        surface: colors.surface,
        input: colors.input,
        border: colors.border,
        borderStrong: colors.borderStrong,
        text: {
          primary: colors.textPrimary,
          secondary: colors.textSecondary,
          tertiary: colors.textTertiary,
          accent: colors.accentPrimary,
        },
        accent: {
          primary: colors.accentPrimary,
          secondary: colors.accentSecondary,
          success: colors.accentSuccess,
          warning: colors.accentWarning,
          error: colors.accentError,
        },
      },
      effects: {
        glow,
        scanlines,
        textShadow,
      },
    }
    applyTheme(tempTheme)
  }

  const saveCustomTheme = () => {
    if (!themeName.trim()) {
      toast.error('Enter theme name')
      return
    }

    const themeId = editingTheme || `custom_${Date.now()}`
    const newTheme: Theme = {
      id: themeId,
      name: themeName,
      colors: {
        background: colors.background,
        surface: colors.surface,
        input: colors.input,
        border: colors.border,
        borderStrong: colors.borderStrong,
        text: {
          primary: colors.textPrimary,
          secondary: colors.textSecondary,
          tertiary: colors.textTertiary,
          accent: colors.accentPrimary,
        },
        accent: {
          primary: colors.accentPrimary,
          secondary: colors.accentSecondary,
          success: colors.accentSuccess,
          warning: colors.accentWarning,
          error: colors.accentError,
        },
      },
      effects: {
        glow,
        scanlines,
        textShadow,
      },
    }

    const updated = { ...customThemes, [themeId]: newTheme }
    setCustomThemes(updated)
    localStorage.setItem('custom_themes', JSON.stringify(updated))

    handleThemeChange(themeId)
    setShowCustomEditor(false)
    setEditingTheme(null)
    toast.success(`"${themeName}" saved!`)
  }

  const deleteCustomTheme = (themeId: string) => {
    const updated = { ...customThemes }
    delete updated[themeId]
    setCustomThemes(updated)
    localStorage.setItem('custom_themes', JSON.stringify(updated))

    if (currentTheme === themeId) {
      handleThemeChange('classic')
    }
    toast.success('Theme deleted')
  }

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <label className="text-sm font-bold uppercase flex-1 tracking-wide" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith('rgba') ? '#ffffff' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 border-2 cursor-pointer"
          style={{ borderColor: 'var(--border-color)' }}
        />
      </div>
    </div>
  )

  const theme = getAllThemes()[currentTheme]

  return (
    <div className="relative">
      {/* Dropdown Panel - positioned above or below button */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-x-4 border-t-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              ...(expandUpwards && {
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
              }),
            }}
          >
            {!showCustomEditor ? (
              <div className="p-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {/* Built-in Themes */}
                <div className="space-y-2 mb-3">
                  {Object.values(themes).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        handleThemeChange(t.id)
                        setIsOpen(false)
                      }}
                      className="w-full flex items-center justify-between gap-3 p-3 transition-all hover:scale-[1.02] border-2 shadow-md"
                      style={{
                        backgroundColor: currentTheme === t.id ? 'var(--bg-input-hover)' : 'var(--bg-input)',
                        borderColor: currentTheme === t.id ? 'var(--border-strong)' : 'var(--border-color)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 border" style={{ backgroundColor: t.colors.text.primary, borderColor: 'var(--border-color)' }} />
                          <div className="w-4 h-4 border" style={{ backgroundColor: t.colors.accent.primary, borderColor: 'var(--border-color)' }} />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                          {t.name}
                        </span>
                      </div>
                      {currentTheme === t.id && <CheckIcon className="w-5 h-5" style={{ color: 'var(--accent-success)' }} />}
                    </button>
                  ))}
                </div>

                {/* Custom Themes */}
                {Object.keys(customThemes).length > 0 && (
                  <div className="border-t-2 pt-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                    {Object.values(customThemes).map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            handleThemeChange(t.id)
                            setIsOpen(false)
                          }}
                          className="flex-1 flex items-center justify-between gap-3 p-3 transition-all hover:scale-[1.02] border-2 shadow-md"
                          style={{
                            backgroundColor: currentTheme === t.id ? 'var(--bg-input-hover)' : 'var(--bg-input)',
                            borderColor: currentTheme === t.id ? 'var(--border-strong)' : 'var(--border-color)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <div className="w-4 h-4 border" style={{ backgroundColor: t.colors.text.primary, borderColor: 'var(--border-color)' }} />
                              <div className="w-4 h-4 border" style={{ backgroundColor: t.colors.accent.primary, borderColor: 'var(--border-color)' }} />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                              {t.name}
                            </span>
                          </div>
                          {currentTheme === t.id && <CheckIcon className="w-5 h-5" style={{ color: 'var(--accent-success)' }} />}
                        </button>
                        <button
                          onClick={() => loadThemeForEditing(t.id)}
                          className="p-3 border-2 transition-all hover:opacity-80 shadow-md"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          <PaintBrushIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteCustomTheme(t.id)}
                          className="p-3 border-2 transition-all hover:opacity-80 shadow-md"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--accent-error)',
                          }}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create Button */}
                <button
                  onClick={createNewCustomTheme}
                  className="w-full flex items-center justify-center gap-2 mt-3 p-3 border-2 transition-all hover:opacity-90 shadow-lg"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    borderColor: 'var(--accent-primary)',
                    color: 'var(--bg-primary)',
                    fontFamily: 'var(--font-digital)',
                  }}
                >
                  <PlusIcon className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wide">Create Custom</span>
                </button>
              </div>
            ) : (
              /* Custom Editor */
              <div className="p-3 max-h-[500px] overflow-y-auto custom-scrollbar space-y-3">
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="Theme Name"
                  className="w-full px-3 py-2.5 text-sm border-2"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-digital)',
                  }}
                />

                <div className="border-2 p-3 space-y-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                  <ColorPicker label="BG" value={colors.background} onChange={(v) => setColors({ ...colors, background: v })} />
                  <ColorPicker label="Text" value={colors.textPrimary} onChange={(v) => setColors({ ...colors, textPrimary: v })} />
                  <ColorPicker label="Accent" value={colors.accentPrimary} onChange={(v) => setColors({ ...colors, accentPrimary: v })} />
                  <ColorPicker label="Border" value={colors.border} onChange={(v) => setColors({ ...colors, border: v })} />
                </div>

                <div className="flex gap-2 text-xs">
                  <label className="flex-1 flex items-center justify-center gap-2 p-2.5 border-2 cursor-pointer transition-all" style={{ borderColor: 'var(--border-color)', backgroundColor: glow ? 'var(--bg-input-hover)' : 'var(--bg-input)' }}>
                    <input type="checkbox" checked={glow} onChange={(e) => setGlow(e.target.checked)} className="w-4 h-4" />
                    <span className="font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>GLOW</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-2.5 border-2 cursor-pointer transition-all" style={{ borderColor: 'var(--border-color)', backgroundColor: scanlines ? 'var(--bg-input-hover)' : 'var(--bg-input)' }}>
                    <input type="checkbox" checked={scanlines} onChange={(e) => setScanlines(e.target.checked)} className="w-4 h-4" />
                    <span className="font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>SCAN</span>
                  </label>
                </div>

                <button
                  onClick={previewTheme}
                  className="w-full py-2.5 border-2 font-bold uppercase text-sm transition-all hover:opacity-90 shadow-md"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    borderColor: 'var(--accent-primary)',
                    color: 'var(--bg-primary)',
                    fontFamily: 'var(--font-digital)',
                  }}
                >
                  Preview
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={saveCustomTheme}
                    className="flex-1 py-2.5 border-2 font-bold uppercase text-sm transition-all hover:opacity-90 shadow-md"
                    style={{
                      backgroundColor: 'var(--accent-success)',
                      borderColor: 'var(--accent-success)',
                      color: 'var(--bg-primary)',
                      fontFamily: 'var(--font-digital)',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomEditor(false)
                      setEditingTheme(null)
                      handleThemeChange(currentTheme)
                    }}
                    className="px-3 py-2.5 border-2 font-bold uppercase text-sm transition-all hover:opacity-90 shadow-md"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-digital)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-4 border-4 transition-all hover:opacity-90 shadow-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-strong)',
          fontFamily: 'var(--font-digital)',
        }}
      >
        <SwatchIcon className="w-7 h-7" style={{ color: 'var(--text-primary)' }} />
        <span className="flex-1 text-left text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
          {theme?.name || 'Classic'}
        </span>
        <ChevronDownIcon className={`w-6 h-6 transition-transform ${isOpen ? (expandUpwards ? '' : 'rotate-180') : (expandUpwards ? 'rotate-180' : '')}`} style={{ color: 'var(--text-primary)' }} />
      </button>
    </div>
  )
}
