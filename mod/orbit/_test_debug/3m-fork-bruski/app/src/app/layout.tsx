import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '3m-fork-bruski',
  description: 'Uniswap GraphQL scraper module',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
