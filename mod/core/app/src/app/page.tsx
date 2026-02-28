"use client";

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/mod/explore')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>Redirecting to modules...</div>
    </div>
  )
}
