"use client"

import ChatBox from '@/components/chat-box'

export default function ChatTest() {
  return (
    <div className="container mx-auto max-w-2xl p-4 min-h-svh">
      <div className="h-[calc(100svh-2rem)]">
        <ChatBox variant="embedded" />
      </div>
    </div>
  )
}
