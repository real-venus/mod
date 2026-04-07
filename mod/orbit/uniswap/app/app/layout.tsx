import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Uniswap V3 Explorer',
  description: 'Multi-chain Uniswap V3 pool & swap explorer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
