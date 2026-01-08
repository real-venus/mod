'use client'

import React from 'react'

export function BatteryLoader() {
  return (
    <div className="flex items-center gap-1.5 py-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-2 h-6 bg-gradient-to-t from-cyan-500/40 to-cyan-400/60 rounded-sm animate-pulse"
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.8s'
          }}
        />
      ))}
    </div>
  )
}
