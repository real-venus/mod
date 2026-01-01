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
    <div className="p-4 flex gap-2 justify-center">
      <button
        onClick={() => setConfigOrientation('top')}
        className={`px-4 py-2 text-2xl ${configOrientation === 'top' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all shadow-lg`}
        title="Top"
      >↑</button>
      <button
        onClick={() => setConfigOrientation('vertical')}
        className={`px-4 py-2 text-2xl ${configOrientation === 'vertical' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all shadow-lg`}
        title="Right"
      >→</button>
      <button
        onClick={() => setConfigOrientation('horizontal')}
        className={`px-4 py-2 text-2xl ${configOrientation === 'horizontal' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all shadow-lg`}
        title="Bottom"
      >↓</button>
      <button
        onClick={() => setConfigOrientation('left')}
        className={`px-4 py-2 text-2xl ${configOrientation === 'left' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded-lg transition-all shadow-lg`}
        title="Left"
      >←</button>
    </div>
  )
}
