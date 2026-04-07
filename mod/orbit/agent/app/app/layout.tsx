import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Agent - Mod Agentic Framework',
  description: 'The simplest agentic framework. Skills-based autonomous agent.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
