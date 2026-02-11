"use client";

import { useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import { copyToClipboard, shorten } from '../utils'

interface CopyButtonProps {
  text?: string
  content?: string
  size?: 'sm' | 'md' | 'lg'
  showShortened?: boolean
  showValueOnHover?: boolean
}

export function CopyButton({ text, content, size = 'md', showShortened = false, showValueOnHover = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const copyContent = text || content || ''
  const displayText = showShortened ? shorten(copyContent) : copyContent

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
    sm: 'h-10 w-10 p-2.5',
    md: 'h-12 w-12 p-3',
    lg: 'h-14 w-14 p-3.5'
  }

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
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
        className={`${sizeClasses[size]} inline-flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors flex-shrink-0`}
        title={copied ? 'Copied!' : `Copy ${copyContent} to clipboard`}
        type="button"
      >
        {showShortened && displayText && <span className="mr-2 text-white/70">{displayText}</span>}
        {copied ? (
          <CheckIcon className={`${iconSizes[size]} text-green-400`} />
        ) : (
          <ClipboardDocumentIcon className={`${iconSizes[size]} text-white/70 hover:text-white`} />
        )}
      </button>
      
      {showValueOnHover && isHovered && copyContent && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-4 py-2 rounded-lg border-2 text-xs font-mono whitespace-nowrap z-50 shadow-2xl pointer-events-none"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            borderColor: '#10b981',
            color: '#10b981',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
          }}
        >
          {copyContent}
        </div>
      )}
    </div>
  )
}