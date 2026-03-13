"use client";

import CreateModule from './CreateModule'
import { userContext } from '@/context/UserContext'

export default function CreatePage() {
  const { user } = userContext()

  return (
    <div
      className="min-h-full pt-16 pb-6 px-4 flex flex-col"
      style={{
        fontFamily: 'var(--font-digital), monospace',
        backgroundColor: 'var(--bg-primary)',
        background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px), var(--bg-primary)`,
      }}
    >
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        <CreateModule />
      </div>
    </div>
  )
}
