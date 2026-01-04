'use client'

interface ChatOrientationToggleProps {
  orientation: 'vertical' | 'horizontal'
  setOrientation: (value: 'vertical' | 'horizontal') => void
}

export function ChatOrientationToggle({ orientation, setOrientation }: ChatOrientationToggleProps) {
  return (
    <button
      onClick={() => setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical')}
      className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-blue-500/20 text-blue-400 border-2 border-blue-500/40 hover:bg-blue-500/30 rounded-lg transition-all font-bold shadow-lg"
      style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
      title={`Switch to ${orientation === 'vertical' ? 'Horizontal' : 'Vertical'} Split`}
    >
      {orientation === 'vertical' ? '⚌ vertical' : '⚏ horizontal'}
    </button>
  )
}
