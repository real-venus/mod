"use client";

import Chat from '@/mod/chat/Chat'

export const dynamic = 'force-dynamic'

export default function ChatPage() {
  return (
    <div className="bg-black h-full">
      <Chat />
    </div>
  )
}
