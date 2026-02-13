import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WASM Deployer - IPFS',
  description: 'Deploy and run WebAssembly modules via IPFS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black">{children}</body>
    </html>
  )
}
