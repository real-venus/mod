'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'
import { ToastContainer } from 'react-toastify'
import { useState } from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import 'react-toastify/dist/ReactToastify.css'

const config = getDefaultConfig({
  appName: 'ModFi',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'modfi-dev',
  chains: [base],
  ssr: true,
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#6366f1',
          accentColorForeground: 'white',
          borderRadius: 'medium',
          overlayBlur: 'small',
        })}>
          {children}
          <ToastContainer
            position="bottom-right"
            theme="dark"
            toastStyle={{ background: '#12131a', border: '1px solid #1e2030' }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
