"use client";

import ChatInterface from '@/chat/ChatInterface'

export const dynamic = 'force-dynamic'

export default function ChatPage() {
  return (
    <div className="h-full pt-20">
      <ChatInterface />
    </div>
  )
}
