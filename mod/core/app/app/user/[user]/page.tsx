"use client";

import { useRef } from 'react'
import  UserPage  from '@/user/UserPage'

export default function UserPageWrapper() {
  const transactionsPanelRef = useRef<{ handleSync: () => void } | null>(null)

  return (
    <div className="bg-black h-full p-4">
      <div className="max-w-7xl mx-auto">
        <UserPage />
      </div>
    </div>
  )
}
