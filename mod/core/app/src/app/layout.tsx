import './globals.css'
import { Inter, VT323, Orbitron } from 'next/font/google'
import Providers from './providers'
import { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })
const vt323 = VT323({ weight: '400', subsets: ['latin'], variable: '--font-digital' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  other: {
    'color-scheme': 'dark light',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className={`${inter.className} ${vt323.variable} ${orbitron.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
