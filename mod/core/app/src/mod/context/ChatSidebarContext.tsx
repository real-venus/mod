"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatSidebarContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const ChatSidebarContext = createContext<ChatSidebarContextType | undefined>(undefined);

export function ChatSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <ChatSidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </ChatSidebarContext.Provider>
  );
}

export function useChatSidebar() {
  const context = useContext(ChatSidebarContext);
  if (context === undefined) {
    throw new Error('useChatSidebar must be used within a ChatSidebarProvider');
  }
  return context;
}
