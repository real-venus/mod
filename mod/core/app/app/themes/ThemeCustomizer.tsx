"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { themes, getTheme, applyTheme, type Theme } from './themeConfig'
import {
  SwatchIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ChevronRightIcon,
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

export function ThemeCustomizer() {
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
    // Load saved theme and custom themes from localStorage
    const savedTheme = localStorage.getItem('app_theme') || 'classic'
    const savedCustomThemes = localStorage.getItem('custom_themes')

    setCurrentTheme(savedTheme)
    applyTheme(getAllThemes()[savedTheme] || getTheme(savedTheme))

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
    toast.success(`Theme changed to ${allThemes[themeId]?.name || themeId}`)
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
      toast.error('Please enter a theme name')
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
    toast.success(`Theme "${themeName}" saved!`)
  }

  const deleteCustomTheme = (themeId: string) => {
    const updated = { ...customThemes }
    delete updated[themeId]
    setCustomThemes(updated)
    localStorage.setItem('custom_themes', JSON.stringify(updated))

    if (currentTheme === themeId) {
      handleThemeChange('classic')
    }
    toast.success('Custom theme deleted')
  }

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
      <label className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith('rgba') ? '#ffffff' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-8 border cursor-pointer"
          style={{ borderColor: 'var(--border-color)' }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 px-2 py-1 text-xs font-mono border"
          style={{
            backgroundColor: 'var(--bg-input)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-digital)',
          }}
        />
      </div>
    </div>
  )

  const theme = getAllThemes()[currentTheme]

  return (
    <>
      {/* Toggle Button - fixed to right edge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-1/2 right-0 -translate-y-1/2 z-[100] p-3 border-2 border-r-0 transition-all"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-strong)',
          borderRadius: '8px 0 0 8px',
          boxShadow: isOpen ? 'none' : 'var(--card-shadow)',
        }}
        title="Theme Settings"
      >
        <PaintBrushIcon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
      </button>

      {/* Right Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95]"
              onClick={() => setIsOpen(false)}
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="fixed top-0 right-0 h-screen w-96 z-[100] flex flex-col border-l-2 overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-strong)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b-2" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <SwatchIcon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
                  <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                    THEMES
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!showCustomEditor ? (
                  <>
                    {/* Current Theme Display */}
                    <div className="p-4 border-b-2" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                        Current Theme
                      </div>
                      <div
                        className="flex items-center justify-between p-3 border-2"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border-strong)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-4 h-4 border" style={{ backgroundColor: theme?.colors.text.primary, borderColor: theme?.colors.border }} />
                            <div className="w-4 h-4 border" style={{ backgroundColor: theme?.colors.accent.primary, borderColor: theme?.colors.border }} />
                            <div className="w-4 h-4 border" style={{ backgroundColor: theme?.colors.background, borderColor: theme?.colors.border }} />
                          </div>
                          <span className="text-sm font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                            {theme?.name || 'Classic'}
                          </span>
                        </div>
                        <button
                          onClick={createNewCustomTheme}
                          className="p-1.5 border-2 transition-all hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--accent-primary)',
                          }}
                          title="Edit this theme"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Built-in Themes */}
                    <div className="p-4">
                      <div className="text-xs uppercase tracking-wider mb-3 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                        Built-in Themes
                      </div>
                      <div className="space-y-2">
                        {Object.values(themes).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleThemeChange(t.id)}
                            className="w-full flex items-center justify-between gap-3 p-3 transition-all hover:opacity-80 border"
                            style={{
                              backgroundColor: currentTheme === t.id ? 'var(--bg-input-hover)' : 'var(--bg-input)',
                              borderColor: currentTheme === t.id ? 'var(--border-strong)' : 'var(--border-color)',
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                <div className="w-3 h-3 border" style={{ backgroundColor: t.colors.text.primary, borderColor: t.colors.border }} />
                                <div className="w-3 h-3 border" style={{ backgroundColor: t.colors.accent.primary, borderColor: t.colors.border }} />
                                <div className="w-3 h-3 border" style={{ backgroundColor: t.colors.background, borderColor: t.colors.border }} />
                              </div>
                              <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                {t.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {t.effects.glow && <span className="text-[9px] px-1 py-0.5 border" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)', fontFamily: 'var(--font-digital)' }}>GLOW</span>}
                              {t.effects.scanlines && <span className="text-[9px] px-1 py-0.5 border" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)', fontFamily: 'var(--font-digital)' }}>SCAN</span>}
                              {currentTheme === t.id && <CheckIcon className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Themes */}
                    {Object.keys(customThemes).length > 0 && (
                      <div className="p-4 border-t-2" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="text-xs uppercase tracking-wider mb-3 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Custom Themes
                        </div>
                        <div className="space-y-2">
                          {Object.values(customThemes).map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center gap-2"
                            >
                              <button
                                onClick={() => handleThemeChange(t.id)}
                                className="flex-1 flex items-center justify-between gap-3 p-3 transition-all hover:opacity-80 border"
                                style={{
                                  backgroundColor: currentTheme === t.id ? 'var(--bg-input-hover)' : 'var(--bg-input)',
                                  borderColor: currentTheme === t.id ? 'var(--border-strong)' : 'var(--border-color)',
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex gap-1">
                                    <div className="w-3 h-3 border" style={{ backgroundColor: t.colors.text.primary, borderColor: t.colors.border }} />
                                    <div className="w-3 h-3 border" style={{ backgroundColor: t.colors.accent.primary, borderColor: t.colors.border }} />
                                    <div className="w-3 h-3 border" style={{ backgroundColor: t.colors.background, borderColor: t.colors.border }} />
                                  </div>
                                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                    {t.name}
                                  </span>
                                </div>
                                {currentTheme === t.id && <CheckIcon className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />}
                              </button>
                              <button
                                onClick={() => loadThemeForEditing(t.id)}
                                className="p-3 border transition-all hover:opacity-80"
                                style={{
                                  backgroundColor: 'var(--bg-input)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--accent-primary)',
                                }}
                                title="Edit"
                              >
                                <PaintBrushIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteCustomTheme(t.id)}
                                className="p-3 border transition-all hover:opacity-80"
                                style={{
                                  backgroundColor: 'var(--bg-input)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--accent-error)',
                                }}
                                title="Delete"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create Custom Theme Button */}
                    <div className="p-4">
                      <button
                        onClick={createNewCustomTheme}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 transition-all hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          borderColor: 'var(--accent-primary)',
                          color: 'var(--bg-primary)',
                          fontFamily: 'var(--font-digital)',
                        }}
                      >
                        <PlusIcon className="w-5 h-5" />
                        <span className="font-bold uppercase">Create Custom Theme</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* Custom Theme Editor */
                  <div className="p-4">
                    <button
                      onClick={() => {
                        setShowCustomEditor(false)
                        setEditingTheme(null)
                      }}
                      className="flex items-center gap-2 mb-4 text-sm transition-opacity hover:opacity-70"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}
                    >
                      <ChevronRightIcon className="w-4 h-4 rotate-180" />
                      Back to Themes
                    </button>

                    <div className="space-y-4">
                      {/* Live Preview */}
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Live Preview
                        </div>
                        <div
                          className="border-2 p-4 space-y-2"
                          style={{
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          }}
                        >
                          <div
                            className="p-3 border"
                            style={{
                              backgroundColor: colors.surface,
                              borderColor: colors.borderStrong,
                            }}
                          >
                            <div className="text-sm font-bold mb-1" style={{ color: colors.textPrimary, fontFamily: 'var(--font-digital)' }}>
                              Primary Text
                            </div>
                            <div className="text-xs" style={{ color: colors.textSecondary, fontFamily: 'var(--font-digital)' }}>
                              Secondary Text
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 px-2 py-1.5 text-xs text-center border font-bold" style={{ backgroundColor: colors.accentPrimary, color: colors.background, borderColor: colors.accentPrimary, fontFamily: 'var(--font-digital)' }}>
                              PRIMARY
                            </div>
                            <div className="flex-1 px-2 py-1.5 text-xs text-center border font-bold" style={{ backgroundColor: colors.accentSuccess, color: colors.background, borderColor: colors.accentSuccess, fontFamily: 'var(--font-digital)' }}>
                              SUCCESS
                            </div>
                            <div className="flex-1 px-2 py-1.5 text-xs text-center border font-bold" style={{ backgroundColor: colors.accentError, color: colors.background, borderColor: colors.accentError, fontFamily: 'var(--font-digital)' }}>
                              ERROR
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Theme Name */}
                      <div>
                        <label className="text-xs uppercase tracking-wider mb-2 block font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Theme Name
                        </label>
                        <input
                          type="text"
                          value={themeName}
                          onChange={(e) => setThemeName(e.target.value)}
                          placeholder="My Custom Theme"
                          className="w-full px-3 py-2 text-sm border-2"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-digital)',
                          }}
                        />
                      </div>

                      {/* Background Colors */}
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Background Colors
                        </div>
                        <div className="border-2 p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <ColorPicker label="Background" value={colors.background} onChange={(v) => setColors({ ...colors, background: v })} />
                          <ColorPicker label="Surface" value={colors.surface} onChange={(v) => setColors({ ...colors, surface: v })} />
                          <ColorPicker label="Input" value={colors.input} onChange={(v) => setColors({ ...colors, input: v })} />
                        </div>
                      </div>

                      {/* Borders */}
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Borders
                        </div>
                        <div className="border-2 p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <ColorPicker label="Border" value={colors.border} onChange={(v) => setColors({ ...colors, border: v })} />
                          <ColorPicker label="Border Strong" value={colors.borderStrong} onChange={(v) => setColors({ ...colors, borderStrong: v })} />
                        </div>
                      </div>

                      {/* Text Colors */}
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Text Colors
                        </div>
                        <div className="border-2 p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <ColorPicker label="Text Primary" value={colors.textPrimary} onChange={(v) => setColors({ ...colors, textPrimary: v })} />
                          <ColorPicker label="Text Secondary" value={colors.textSecondary} onChange={(v) => setColors({ ...colors, textSecondary: v })} />
                          <ColorPicker label="Text Tertiary" value={colors.textTertiary} onChange={(v) => setColors({ ...colors, textTertiary: v })} />
                        </div>
                      </div>

                      {/* Accent Colors */}
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Accent Colors
                        </div>
                        <div className="border-2 p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <ColorPicker label="Primary" value={colors.accentPrimary} onChange={(v) => setColors({ ...colors, accentPrimary: v })} />
                          <ColorPicker label="Secondary" value={colors.accentSecondary} onChange={(v) => setColors({ ...colors, accentSecondary: v })} />
                          <ColorPicker label="Success" value={colors.accentSuccess} onChange={(v) => setColors({ ...colors, accentSuccess: v })} />
                          <ColorPicker label="Warning" value={colors.accentWarning} onChange={(v) => setColors({ ...colors, accentWarning: v })} />
                          <ColorPicker label="Error" value={colors.accentError} onChange={(v) => setColors({ ...colors, accentError: v })} />
                        </div>
                      </div>

                      {/* Effects */}
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                          Effects
                        </div>
                        <div className="border-2 p-3 space-y-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>Glow Effects</span>
                            <input
                              type="checkbox"
                              checked={glow}
                              onChange={(e) => setGlow(e.target.checked)}
                              className="w-5 h-5"
                            />
                          </label>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>Scanlines</span>
                            <input
                              type="checkbox"
                              checked={scanlines}
                              onChange={(e) => setScanlines(e.target.checked)}
                              className="w-5 h-5"
                            />
                          </label>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>Text Shadow</span>
                            <input
                              type="checkbox"
                              checked={textShadow}
                              onChange={(e) => setTextShadow(e.target.checked)}
                              className="w-5 h-5"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-4">
                        <button
                          onClick={previewTheme}
                          className="w-full py-3 border-2 font-bold uppercase text-sm transition-all hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            borderColor: 'var(--accent-primary)',
                            color: 'var(--bg-primary)',
                            fontFamily: 'var(--font-digital)',
                          }}
                        >
                          Preview Theme
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={saveCustomTheme}
                            className="flex-1 py-3 border-2 font-bold uppercase text-sm transition-all hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--accent-success)',
                              borderColor: 'var(--accent-success)',
                              color: 'var(--bg-primary)',
                              fontFamily: 'var(--font-digital)',
                            }}
                          >
                            {editingTheme ? 'Update' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setShowCustomEditor(false)
                              setEditingTheme(null)
                              handleThemeChange(currentTheme)
                            }}
                            className="px-4 py-3 border-2 font-bold uppercase text-sm transition-all hover:opacity-80"
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
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
