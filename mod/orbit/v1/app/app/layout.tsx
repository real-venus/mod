import './globals.css'

export const metadata = {
  title: 'v1',
  description: 'A mod app module',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
