import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Zcash Explorer',
  description: 'Zcash blockchain explorer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0a0a0f', color: '#e0e0e0' }}>
        {children}
      </body>
    </html>
  )
}
