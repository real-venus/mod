import './globals.css'
import { Inter, VT323, Orbitron, Press_Start_2P } from 'next/font/google'
import Providers from './providers'
import { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })
const vt323 = VT323({ weight: '400', subsets: ['latin'], variable: '--font-digital' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })
const pressStart = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel' })

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
      <body className={`${inter.className} ${vt323.variable} ${orbitron.variable} ${pressStart.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
