"use client";

import Chat from '@/chat/Chat'

export const dynamic = 'force-dynamic'

export default function ChatPage() {
  return (
    <div className="bg-black h-full pt-20">
      <Chat />
    </div>
  )
}
