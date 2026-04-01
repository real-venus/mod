"use client";

import { useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import { copyToClipboard, shorten } from '../utils'
import { useTheme } from '@/context/ThemeContext'

interface CopyButtonProps {
  text?: string
  content?: string
  size?: 'sm' | 'md' | 'lg'
  showShortened?: boolean
  showValueOnHover?: boolean
}

export function CopyButton({ text, content, size = 'md', showShortened = false, showValueOnHover = false }: CopyButtonProps) {
  const { effectiveTheme } = useTheme()
  const [copied, setCopied] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const copyContent = text || content || ''
  const displayText = showShortened ? shorten(copyContent) : copyContent
  const isLight = effectiveTheme === 'light'

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const success = await copyToClipboard(copyContent)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sizeClasses = {
    sm: 'h-5 w-5 p-0.5',
    md: 'h-8 w-8 p-1.5',
    lg: 'h-10 w-10 p-2'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  if (!copyContent) {
    return null
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={handleCopy}
        className={`${sizeClasses[size]} inline-flex items-center justify-center ${size === 'sm' ? 'rounded' : 'rounded-xl'} transition-colors flex-shrink-0 ${
          isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'
        }`}
        title={copied ? 'Copied!' : `Copy ${copyContent} to clipboard`}
        type="button"
      >
        {showShortened && displayText && (
          <span className={`mr-2 ${isLight ? 'text-black/70' : 'text-white/70'}`}>
            {displayText}
          </span>
        )}
        {copied ? (
          <CheckIcon className={`${iconSizes[size]} text-green-500`} />
        ) : (
          <ClipboardDocumentIcon
            className={`${iconSizes[size]} transition-colors ${
              size === 'sm'
                ? isLight
                  ? 'text-black/40 hover:text-black/70'
                  : 'text-white/30 hover:text-white/60'
                : isLight
                  ? 'text-black/60 hover:text-black'
                  : 'text-white/70 hover:text-white'
            }`}
          />
        )}
      </button>

      {showValueOnHover && isHovered && copyContent && (
        <div
          className={`absolute left-full top-1/2 -translate-y-1/2 ml-1.5 ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'} rounded-md border font-digital whitespace-nowrap z-50 pointer-events-none`}
          style={{
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)',
            borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
            color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
            boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {copyContent}
        </div>
      )}
    </div>
  )
}