import type { Metadata } from 'next'
import './globals.css'
import 'react-toastify/dist/ReactToastify.css'
import { ToastContainer } from 'react-toastify'

export const metadata: Metadata = {
  title: 'Polycopy - Polymarket Copy Trading',
  description: 'Monitor and copy trade Polymarket addresses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white">
        {children}
        <ToastContainer theme="dark" position="bottom-right" />
      </body>
    </html>
  )
}
