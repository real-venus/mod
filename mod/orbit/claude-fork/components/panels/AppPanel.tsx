"use client";

import { useEffect, useState } from 'react'
import { ExternalLink, AlertCircle } from 'lucide-react'
import type { ModuleData } from '../UnifiedInterface'

interface AppPanelProps {
  mod: ModuleData
  moduleColor?: string
}

export default function AppPanel({ mod, moduleColor = '#00ff00' }: AppPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if the URL is valid
    if (!mod.url_app) {
      setError('No application URL provided')
      setLoading(false)
      return
    }

    // Validate URL format
    try {
      const url = new URL(mod.url_app)
      // URL is valid, iframe will handle loading
      setLoading(false)
    } catch (e) {
      setError('Invalid application URL')
      setLoading(false)
    }
  }, [mod.url_app])

  if (error) {
    return (
      <div className='flex min-h-[600px] items-center justify-center'>
        <div className='text-center'>
          <AlertCircle
            className='mx-auto h-16 w-16 mb-4'
            style={{ color: 'var(--text-tertiary)' }}
          />
          <h3
            className='text-xl font-semibold mb-2 uppercase tracking-wider'
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-digital)'
            }}
          >
            ▸ Application Error
          </h3>
          <p className='mb-6' style={{ color: 'var(--text-secondary)' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!mod.url_app) {
    return null
  }

  return (
    <div className='relative w-full h-full min-h-[600px]'>
      {loading && (
        <div
          className='absolute inset-0 flex items-center justify-center z-10'
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex flex-col items-center gap-5">
            <div
              className="w-16 h-16 border-4 flex items-center justify-center"
              style={{
                borderColor: 'var(--border-strong)',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              <span
                className="animate-pulse font-bold text-2xl"
                style={{ color: 'var(--text-primary)' }}
              >
                _
              </span>
            </div>
            <span
              className="text-lg font-bold uppercase tracking-wider"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-digital)'
              }}
            >
              ▸ LOADING APP...
            </span>
          </div>
        </div>
      )}

      <iframe
        src={mod.url_app}
        className='w-full h-full border-0'
        title={`${mod.name} Application`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError('Failed to load application')
          setLoading(false)
        }}
        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        allowFullScreen
        style={{
          backgroundColor: 'var(--bg-primary)',
          minHeight: '600px'
        }}
      />

      {/* External link button */}
      <a
        href={mod.url_app}
        target='_blank'
        rel='noopener noreferrer'
        className='absolute top-4 right-4 flex items-center gap-2 px-4 py-2 text-sm transition-all border-4 font-bold uppercase tracking-wider hover:scale-105'
        style={{
          borderColor: 'var(--border-strong)',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
          fontFamily: 'var(--font-digital)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <ExternalLink className='h-4 w-4' />
        ▸ Open in New Tab
      </a>
    </div>
  )
}
