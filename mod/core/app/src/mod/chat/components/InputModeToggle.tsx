'use client'

interface InputModeToggleProps {
  mode: 'chat' | 'params'
  onModeChange: (mode: 'chat' | 'params') => void
}

export function InputModeToggle({ mode, onModeChange }: InputModeToggleProps) {
  return (
    <div className="flex gap-2 items-center justify-center">
      <button
        type="button"
        onClick={() => onModeChange('chat')}
        className={`px-4 py-2 border-2 rounded-lg transition-all font-bold text-sm ${
          mode === 'chat'
            ? 'bg-orange-500/30 text-orange-300 border-orange-400/80 shadow-lg'
            : 'bg-black/40 text-orange-600/60 border-orange-500/30 hover:bg-orange-500/10'
        }`}
        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
      >
        💬 chat
      </button>
      <button
        type="button"
        onClick={() => onModeChange('params')}
        className={`px-4 py-2 border-2 rounded-lg transition-all font-bold text-sm ${
          mode === 'params'
            ? 'bg-orange-500/30 text-orange-300 border-orange-400/80 shadow-lg'
            : 'bg-black/40 text-orange-600/60 border-orange-500/30 hover:bg-orange-500/10'
        }`}
        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
      >
        ⚙️ params
      </button>
    </div>
  )
}