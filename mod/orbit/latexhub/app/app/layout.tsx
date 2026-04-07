import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LatexHub - Mod LaTeX Document Manager',
  description: 'Local filesystem LaTeX document storage, editing, and compilation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
