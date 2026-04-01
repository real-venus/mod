"use client";

import React, { useState, useEffect } from 'react';
import { useChatSidebar } from '../context/ChatSidebarContext';
import Chat from '../chat/Chat';
import { TransactionsPanel } from '../chat/transactions/TransactionsPanel';

export default function ChatSidebar() {
  const { isOpen, close } = useChatSidebar();
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [chatHeight, setChatHeight] = useState(60); // percentage

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.max(320, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = chatHeight;

    const handleDividerMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const containerHeight = window.innerHeight - 64; // minus header
      const deltaPercent = (deltaY / containerHeight) * 100;
      const newHeight = Math.max(20, Math.min(80, startHeight + deltaPercent));
      setChatHeight(newHeight);
    };

    const handleDividerUp = () => {
      document.removeEventListener('mousemove', handleDividerMove);
      document.removeEventListener('mouseup', handleDividerUp);
    };

    document.addEventListener('mousemove', handleDividerMove);
    document.addEventListener('mouseup', handleDividerUp);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={close}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-64px)] z-50 flex transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: sidebarWidth }}
      >
        {/* Resize handle */}
        <div
          className="w-1 cursor-ew-resize transition-colors"
          style={{ backgroundColor: 'var(--border-color)' }}
          onMouseDown={handleMouseDown}
        />

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Chat & Transactions
            </h2>
            <button
              onClick={close}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Chat Section */}
          <div
            className="overflow-hidden"
            style={{ height: `${chatHeight}%` }}
          >
            <Chat />
          </div>

          {/* Divider */}
          <div
            className="h-2 cursor-ns-resize flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)' }}
            onMouseDown={handleDividerMouseDown}
          >
            <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--border-strong)' }} />
          </div>

          {/* Transactions Section */}
          <div
            className="overflow-auto"
            style={{ height: `${100 - chatHeight}%` }}
          >
            <TransactionsPanel />
          </div>
        </div>
      </div>
    </>
  );
}
