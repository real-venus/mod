'use client'

import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'

const ganache = {
  id: 1337,
  name: 'Ganache',
  network: 'ganache',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_GANACHE_RPC || 'http://localhost:7545'] },
    public: { http: [process.env.NEXT_PUBLIC_GANACHE_RPC || 'http://localhost:7545'] },
  },
  testnet: true,
}

const base = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'] },
    public: { http: [process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
}

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'] },
    public: { http: [process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
}

const { chains, publicClient } = configureChains(
  [ganache, base, baseSepolia],
  [publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: 'Prefi Prediction Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains,
})

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}