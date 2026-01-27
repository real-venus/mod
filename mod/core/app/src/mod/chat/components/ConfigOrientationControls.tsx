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
    <div className="p-4 flex items-center justify-center">
      <div className="relative bg-gray-800/50 border-2 border-gray-700 rounded-lg p-3" style={{ width: '120px', height: '120px' }}>
        {/* Center indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-700/50 border border-gray-600" />
        
        {/* Top button */}
        <button
          onClick={() => setConfigOrientation('top')}
          className={`absolute top-1 left-1/2 -translate-x-1/2 px-2 py-1 text-lg ${configOrientation === 'top' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border hover:bg-blue-500/30 rounded transition-all hover:scale-105 active:scale-95`}
          title="Top"
        >↑</button>
        
        {/* Bottom button */}
        <button
          onClick={() => setConfigOrientation('horizontal')}
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-1 text-lg ${configOrientation === 'horizontal' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border hover:bg-blue-500/30 rounded transition-all hover:scale-105 active:scale-95`}
          title="Bottom"
        >↓</button>
        
        {/* Left button */}
        <button
          onClick={() => setConfigOrientation('left')}
          className={`absolute top-1/2 left-1 -translate-y-1/2 px-2 py-1 text-lg ${configOrientation === 'left' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border hover:bg-blue-500/30 rounded transition-all hover:scale-105 active:scale-95`}
          title="Left"
        >←</button>
        
        {/* Right button - CHANGED FROM vertical TO left */}
        <button
          onClick={() => setConfigOrientation('left')}
          className={`absolute top-1/2 right-1 -translate-y-1/2 px-2 py-1 text-lg ${configOrientation === 'left' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border hover:bg-blue-500/30 rounded transition-all hover:scale-105 active:scale-95`}
          title="Left"
        >→</button>
      </div>
    </div>
  )
}
