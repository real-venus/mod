'use client'

import { useState } from 'react'
import { MicrophoneIcon } from '@heroicons/react/24/outline'

interface VoiceControlProps {
  onVoiceInput?: (text: string) => void
}

export function VoiceControl({ onVoiceInput }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false)

  const handleVoiceClick = () => {
    // Placeholder for future voice integration
    setIsListening(!isListening)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleVoiceClick}
        className={`px-4 py-2 border-2 rounded-lg transition-all font-bold text-sm flex items-center gap-2 ${
          isListening
            ? 'bg-red-500/30 text-red-300 border-red-400/80 shadow-lg animate-pulse'
            : 'bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/30'
        }`}
        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
        title="Voice input - Coming soon"
      >
        <MicrophoneIcon className="h-5 w-5" />
        {isListening ? 'listening...' : 'voice'}
      </button>
      
      {isListening && (
        <div className="absolute top-full mt-2 left-0 bg-black/95 border-2 border-purple-500/60 rounded-lg p-4 shadow-2xl backdrop-blur-md z-50 whitespace-nowrap">
          <p className="text-purple-400 font-bold text-sm" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            🎤 coming soon
          </p>
          <p className="text-purple-300/60 text-xs mt-1" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            voice models integration in progress
          </p>
        </div>
      )}
    </div>
  )
}