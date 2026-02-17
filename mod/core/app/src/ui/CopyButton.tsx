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
        className={`${sizeClasses[size]} inline-flex items-center justify-center ${size === 'sm' ? 'rounded' : 'rounded-xl'} hover:bg-white/10 transition-colors flex-shrink-0`}
        title={copied ? 'Copied!' : `Copy ${copyContent} to clipboard`}
        type="button"
      >
        {showShortened && displayText && <span className="mr-2 text-white/70">{displayText}</span>}
        {copied ? (
          <CheckIcon className={`${iconSizes[size]} text-green-400`} />
        ) : (
          <ClipboardDocumentIcon className={`${iconSizes[size]} ${size === 'sm' ? 'text-white/30 hover:text-white/60' : 'text-white/70 hover:text-white'} transition-colors`} />
        )}
      </button>
      
      {showValueOnHover && isHovered && copyContent && (
        <div
          className={`absolute left-full top-1/2 -translate-y-1/2 ml-1.5 ${size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-4 py-2 text-xs'} rounded-md border font-mono whitespace-nowrap z-50 pointer-events-none`}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {copyContent}
        </div>
      )}
    </div>
  )
}