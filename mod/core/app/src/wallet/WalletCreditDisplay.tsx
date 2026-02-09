"use client";

import React from 'react'

interface WalletCreditDisplayProps {
  credits?: number | string
  label?: string
  className?: string
}

const WalletCreditDisplay: React.FC<WalletCreditDisplayProps> = ({
  credits = 0,
  label = 'Market Tokens',
  className = '',
}) => {
  const formatCredits = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '0.00'
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-400">{label}:</span>
      <span className="text-sm font-mono font-semibold text-white">
        {formatCredits(credits)}
      </span>
    </div>
  )
}

export default WalletCreditDisplay
