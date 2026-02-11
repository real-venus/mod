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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-neutral-500 font-mono text-sm">Redirecting to modules...</div>
    </div>
  )
}
