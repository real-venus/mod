'use client'

interface ConfigOrientationControlsProps {
  configOrientation: 'vertical' | 'horizontal' | 'left' | 'top'
  setConfigOrientation: (value: 'vertical' | 'horizontal' | 'left' | 'top') => void
}

export function ConfigOrientationControls({
  configOrientation,
  setConfigOrientation
}: ConfigOrientationControlsProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => setConfigOrientation('top')}
        className={`px-2 py-1.5 text-xl ${configOrientation === 'top' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
        title="Top"
      >↑</button>
      <button
        onClick={() => setConfigOrientation('vertical')}
        className={`px-2 py-1.5 text-xl ${configOrientation === 'vertical' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
        title="Right"
      >→</button>
      <button
        onClick={() => setConfigOrientation('horizontal')}
        className={`px-2 py-1.5 text-xl ${configOrientation === 'horizontal' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
        title="Bottom"
      >↓</button>
      <button
        onClick={() => setConfigOrientation('left')}
        className={`px-2 py-1.5 text-xl ${configOrientation === 'left' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
        title="Left"
      >←</button>
    </div>
  )
}
