"use client";

import { useEffect, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'

interface QRCodeProps {
  value: string
  size?: number
  color?: string
}

export function QRCode({ value, size = 200, color = '#00ff00' }: QRCodeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const qrCode = useRef<QRCodeStyling | null>(null)

  useEffect(() => {
    if (!qrCode.current) {
      qrCode.current = new QRCodeStyling({
        width: size,
        height: size,
        data: value,
        dotsOptions: {
          color: color,
          type: 'rounded'
        },
        backgroundOptions: {
          color: 'transparent'
        },
        cornersSquareOptions: {
          color: color,
          type: 'extra-rounded'
        },
        cornersDotOptions: {
          color: color,
          type: 'dot'
        }
      })
      if (ref.current) {
        qrCode.current.append(ref.current)
      }
    } else {
      qrCode.current.update({
        data: value,
        dotsOptions: { color },
        cornersSquareOptions: { color },
        cornersDotOptions: { color }
      })
    }
  }, [value, size, color])

  return <div ref={ref} className="flex items-center justify-center" />
}
