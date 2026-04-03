import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ModFi - DeFi Aggregator',
  description: 'Aggregate and invest in DeFi protocols on Base',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-modfi-bg antialiased">
        {children}
      </body>
    </html>
  )
}
