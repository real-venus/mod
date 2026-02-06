'use client'

import { useTheme } from '@/mod/context/ThemeContext'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ThemeToggleProps {
  compact?: boolean
  className?: string
}

function ThemeToggleClient({ compact = false, className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  const themes = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ]

  if (compact) {
    // Compact version for header/mobile - cycles through themes
    const cycleTheme = () => {
      const currentIndex = themes.findIndex(t => t.value === theme)
      const nextIndex = (currentIndex + 1) % themes.length
      setTheme(themes[nextIndex].value)
    }

    const CurrentIcon = themes.find(t => t.value === theme)?.icon || Sun

    return (
      <button
        onClick={cycleTheme}
        className={`p-2 rounded-lg hover:bg-surface-elevated transition-colors ${className}`}
        aria-label="Toggle theme"
      >
        <CurrentIcon className="w-5 h-5 text-text-secondary hover:text-text-primary transition-colors" />
      </button>
    )
  }

  // Full version - shows all options
  return (
    <div className={`inline-flex gap-1 p-1 bg-surface rounded-lg ${className}`}>
      {themes.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value

        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200
              ${isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }
            `}
            aria-label={`${label} theme`}
            aria-pressed={isActive}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything on server
  if (!mounted) {
    return (
      <div className={`p-2 rounded-lg ${className}`} style={{ width: '40px', height: '40px' }} />
    )
  }

  // Only render the actual component on client
  return <ThemeToggleClient compact={compact} className={className} />
}

// Compact version as separate export for convenience
export function ThemeToggleCompact({ className }: { className?: string }) {
  return <ThemeToggle compact className={className} />
}
