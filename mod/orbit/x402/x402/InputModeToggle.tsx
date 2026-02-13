'use client'

interface InputModeToggleProps {
  mode: 'chat' | 'params'
  onModeChange: (mode: 'chat' | 'params') => void
}

export function InputModeToggle({ mode, onModeChange }: InputModeToggleProps) {
  return (
    <div className="flex gap-2 bg-black/60 border-2 border-cyan-400/60 rounded-xl p-2">
      <button
        type="button"
        onClick={() => onModeChange('chat')}
        className={`px-6 py-3 rounded-lg transition-all font-bold text-base ${
          mode === 'chat'
            ? 'bg-cyan-500/40 text-cyan-300 border-2 border-cyan-400/80 shadow-[0_0_15px_rgba(0,255,255,0.4)]'
            : 'bg-transparent text-cyan-600 hover:text-cyan-400'
        }`}
        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
      >
        💬 chat
      </button>
      <button
        type="button"
        onClick={() => onModeChange('params')}
        className={`px-6 py-3 rounded-lg transition-all font-bold text-base ${
          mode === 'params'
            ? 'bg-orange-500/40 text-orange-300 border-2 border-orange-400/80 shadow-[0_0_15px_rgba(255,165,0,0.4)]'
            : 'bg-transparent text-orange-600 hover:text-orange-400'
        }`}
        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
      >
        ⚙️ params
      </button>
    </div>
  )
}
