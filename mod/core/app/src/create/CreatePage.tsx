"use client";

import CreateModule from './CreateModule'
import { userContext } from '@/context/UserContext'

export default function CreatePage() {
  const { user } = userContext()

  return (
    <div className="min-h-full pt-20 pb-8 px-4 flex flex-col" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        <CreateModule />
      </div>
    </div>
  )
}
