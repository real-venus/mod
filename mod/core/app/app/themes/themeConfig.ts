export interface Theme {
  id: string
  name: string
  colors: {
    background: string
    surface: string
    input: string
    border: string
    borderStrong: string
    text: {
      primary: string
      secondary: string
      tertiary: string
      accent: string
    }
    accent: {
      primary: string
      secondary: string
      success: string
      warning: string
      error: string
    }
  }
  effects: {
    glow: boolean
    scanlines: boolean
    textShadow: boolean
  }
}

export const themes: Record<string, Theme> = {
  // Classic clean black & white
  classic: {
    id: 'classic',
    name: 'Classic',
    colors: {
      background: '#000000',
      surface: '#111111',
      input: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.2)',
      borderStrong: 'rgba(255, 255, 255, 0.4)',
      text: {
        primary: '#ffffff',
        secondary: 'rgba(255, 255, 255, 0.7)',
        tertiary: 'rgba(255, 255, 255, 0.5)',
        accent: '#ffffff',
      },
      accent: {
        primary: '#ffffff',
        secondary: '#cccccc',
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
      },
    },
    effects: {
      glow: false,
      scanlines: false,
      textShadow: false,
    },
  },

  // Light mode - clean white
  light: {
    id: 'light',
    name: 'Light',
    colors: {
      background: '#ffffff',
      surface: '#f5f5f5',
      input: 'rgba(0, 0, 0, 0.08)',
      border: 'rgba(0, 0, 0, 0.2)',
      borderStrong: 'rgba(0, 0, 0, 0.4)',
      text: {
        primary: '#000000',
        secondary: 'rgba(0, 0, 0, 0.7)',
        tertiary: 'rgba(0, 0, 0, 0.5)',
        accent: '#000000',
      },
      accent: {
        primary: '#000000',
        secondary: '#333333',
        success: '#00aa00',
        warning: '#cc9900',
        error: '#cc0000',
      },
    },
    effects: {
      glow: false,
      scanlines: false,
      textShadow: false,
    },
  },

  // Retro CRT - cyan/magenta
  retro: {
    id: 'retro',
    name: 'Retro CRT',
    colors: {
      background: '#0a0e27',
      surface: '#1a1f3a',
      input: 'rgba(0, 255, 255, 0.08)',
      border: 'rgba(0, 255, 255, 0.3)',
      borderStrong: 'rgba(255, 0, 255, 0.6)',
      text: {
        primary: '#00ffff',
        secondary: '#ff00ff',
        tertiary: '#00ff00',
        accent: '#ffff00',
      },
      accent: {
        primary: '#ff00ff',
        secondary: '#00ffff',
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0088',
      },
    },
    effects: {
      glow: true,
      scanlines: true,
      textShadow: true,
    },
  },

  // Apple Terminal - green on black
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    colors: {
      background: '#000000',
      surface: '#0a0a0a',
      input: 'rgba(0, 255, 0, 0.05)',
      border: 'rgba(0, 255, 0, 0.3)',
      borderStrong: 'rgba(0, 255, 0, 0.6)',
      text: {
        primary: '#00ff00',
        secondary: 'rgba(0, 255, 0, 0.7)',
        tertiary: 'rgba(0, 255, 0, 0.5)',
        accent: '#00ff00',
      },
      accent: {
        primary: '#00ff00',
        secondary: '#00cc00',
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
      },
    },
    effects: {
      glow: true,
      scanlines: false,
      textShadow: true,
    },
  },

  // Cyberpunk - neon blue/pink
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: {
      background: '#0d0221',
      surface: '#1a0b3f',
      input: 'rgba(138, 43, 226, 0.1)',
      border: 'rgba(138, 43, 226, 0.4)',
      borderStrong: 'rgba(255, 20, 147, 0.6)',
      text: {
        primary: '#00d9ff',
        secondary: '#ff006e',
        tertiary: '#8338ec',
        accent: '#ffbe0b',
      },
      accent: {
        primary: '#ff006e',
        secondary: '#00d9ff',
        success: '#06ffa5',
        warning: '#ffbe0b',
        error: '#ff0055',
      },
    },
    effects: {
      glow: true,
      scanlines: true,
      textShadow: true,
    },
  },

  // Matrix - green matrix style
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    colors: {
      background: '#000000',
      surface: '#001a00',
      input: 'rgba(0, 255, 65, 0.08)',
      border: 'rgba(0, 255, 65, 0.3)',
      borderStrong: 'rgba(0, 255, 65, 0.6)',
      text: {
        primary: '#00ff41',
        secondary: 'rgba(0, 255, 65, 0.7)',
        tertiary: 'rgba(0, 255, 65, 0.5)',
        accent: '#00ff41',
      },
      accent: {
        primary: '#00ff41',
        secondary: '#00cc33',
        success: '#00ff41',
        warning: '#ccff00',
        error: '#ff3300',
      },
    },
    effects: {
      glow: true,
      scanlines: true,
      textShadow: true,
    },
  },

  // Nord - cool blues
  nord: {
    id: 'nord',
    name: 'Nord',
    colors: {
      background: '#2e3440',
      surface: '#3b4252',
      input: 'rgba(136, 192, 208, 0.1)',
      border: 'rgba(136, 192, 208, 0.3)',
      borderStrong: 'rgba(136, 192, 208, 0.5)',
      text: {
        primary: '#eceff4',
        secondary: '#d8dee9',
        tertiary: '#88c0d0',
        accent: '#81a1c1',
      },
      accent: {
        primary: '#88c0d0',
        secondary: '#81a1c1',
        success: '#a3be8c',
        warning: '#ebcb8b',
        error: '#bf616a',
      },
    },
    effects: {
      glow: false,
      scanlines: false,
      textShadow: false,
    },
  },

  // Futuristic Glassmorphism - deep space + frosted glass
  glass: {
    id: 'glass',
    name: 'Glass',
    colors: {
      background: '#080b16',
      surface: 'rgba(15, 20, 40, 0.6)',
      input: 'rgba(255, 255, 255, 0.04)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.15)',
      text: {
        primary: 'rgba(255, 255, 255, 0.95)',
        secondary: 'rgba(255, 255, 255, 0.55)',
        tertiary: 'rgba(255, 255, 255, 0.3)',
        accent: '#a78bfa',
      },
      accent: {
        primary: '#a78bfa',
        secondary: '#67e8f9',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
      },
    },
    effects: {
      glow: false,
      scanlines: false,
      textShadow: false,
    },
  },

  // Dracula
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      background: '#282a36',
      surface: '#44475a',
      input: 'rgba(98, 114, 164, 0.1)',
      border: 'rgba(98, 114, 164, 0.3)',
      borderStrong: 'rgba(98, 114, 164, 0.5)',
      text: {
        primary: '#f8f8f2',
        secondary: '#bd93f9',
        tertiary: '#8be9fd',
        accent: '#ff79c6',
      },
      accent: {
        primary: '#bd93f9',
        secondary: '#ff79c6',
        success: '#50fa7b',
        warning: '#f1fa8c',
        error: '#ff5555',
      },
    },
    effects: {
      glow: false,
      scanlines: false,
      textShadow: false,
    },
  },
}

export const defaultTheme = 'glass'

export function getTheme(themeId: string): Theme {
  return themes[themeId] || themes[defaultTheme]
}

// Light themes use light color scheme, everything else is dark
const lightThemeIds = new Set(['light'])

export function isLightTheme(theme: Theme): boolean {
  return lightThemeIds.has(theme.id)
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const isLight = isLightTheme(theme)

  // Sync light/dark class with the named theme
  root.classList.remove('light', 'dark')
  root.classList.add(isLight ? 'light' : 'dark')
  root.setAttribute('data-theme', isLight ? 'light' : 'dark')
  root.style.colorScheme = isLight ? 'light' : 'dark'

  // Also sync the ThemeContext localStorage so they stay in agreement
  localStorage.setItem('theme', isLight ? 'light' : 'dark')

  // Apply color variables
  root.style.setProperty('--bg-primary', theme.colors.background)
  root.style.setProperty('--bg-secondary', theme.colors.surface)
  root.style.setProperty('--bg-surface', theme.colors.surface)
  root.style.setProperty('--bg-header', theme.colors.background)
  root.style.setProperty('--bg-sidebar', theme.colors.surface)
  root.style.setProperty('--bg-input', theme.colors.input)
  root.style.setProperty('--bg-input-hover', theme.colors.input)
  root.style.setProperty('--border-color', theme.colors.border)
  root.style.setProperty('--border-input', theme.colors.border)
  root.style.setProperty('--border-strong', theme.colors.borderStrong)

  root.style.setProperty('--text-primary', theme.colors.text.primary)
  root.style.setProperty('--text-secondary', theme.colors.text.secondary)
  root.style.setProperty('--text-tertiary', theme.colors.text.tertiary)
  root.style.setProperty('--text-accent', theme.colors.text.accent)

  root.style.setProperty('--accent-primary', theme.colors.accent.primary)
  root.style.setProperty('--accent-secondary', theme.colors.accent.secondary)
  root.style.setProperty('--accent-success', theme.colors.accent.success)
  root.style.setProperty('--accent-warning', theme.colors.accent.warning)
  root.style.setProperty('--accent-error', theme.colors.accent.error)

  // Light theme needs its own hover/shadow/scrollbar values
  if (isLight) {
    root.style.setProperty('--hover-bg', 'rgba(0, 0, 0, 0.06)')
    root.style.setProperty('--card-shadow', '0 2px 12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.15)')
    root.style.setProperty('--card-shadow-hover', '0 8px 28px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.2)')
    root.style.setProperty('--scrollbar-track', 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--scrollbar-thumb', 'rgba(0, 0, 0, 0.15)')
    root.style.setProperty('--scrollbar-thumb-hover', 'rgba(0, 0, 0, 0.25)')
    root.style.setProperty('--text-placeholder', 'rgba(0, 0, 0, 0.3)')
    root.style.setProperty('--bg-header', 'rgba(245, 245, 245, 0.95)')
    root.style.setProperty('--bg-sidebar', 'rgba(240, 240, 244, 0.98)')
    root.style.setProperty('--bg-input-hover', 'rgba(0, 0, 0, 0.12)')
  } else {
    root.style.setProperty('--hover-bg', 'rgba(255, 255, 255, 0.04)')
    root.style.setProperty('--card-shadow', '0 2px 16px rgba(0, 0, 0, 0.4)')
    root.style.setProperty('--card-shadow-hover', '0 20px 50px rgba(0, 0, 0, 0.5)')
    root.style.setProperty('--scrollbar-track', 'rgba(0, 0, 0, 0.3)')
    root.style.setProperty('--scrollbar-thumb', 'rgba(255, 255, 255, 0.3)')
    root.style.setProperty('--scrollbar-thumb-hover', 'rgba(255, 255, 255, 0.5)')
    root.style.setProperty('--text-placeholder', 'rgba(255, 255, 255, 0.25)')
    root.style.setProperty('--bg-header', 'rgba(0, 0, 0, 0.98)')
    root.style.setProperty('--bg-sidebar', 'rgba(8, 8, 12, 0.98)')
    root.style.setProperty('--bg-input-hover', 'rgba(255, 255, 255, 0.1)')
  }

  // Apply effects
  root.style.setProperty('--effect-glow', theme.effects.glow ? '1' : '0')
  root.style.setProperty('--effect-scanlines', theme.effects.scanlines ? '1' : '0')
  root.style.setProperty('--effect-text-shadow', theme.effects.textShadow ? '1' : '0')

  // Toggle body classes for effects
  if (theme.effects.scanlines) {
    root.classList.add('has-scanlines')
  } else {
    root.classList.remove('has-scanlines')
  }

  // Glass theme class toggle
  if (theme.id === 'glass') {
    root.classList.add('has-glass')
  } else {
    root.classList.remove('has-glass')
  }
}
