import './globals.css'
import { Inter } from 'next/font/google'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Registry',
  description: 'Multi-chain module registry',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <ToastContainer
          position="bottom-right"
          theme="dark"
          autoClose={4000}
          hideProgressBar={false}
          closeOnClick
        />
      </body>
    </html>
  )
}
