"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'

interface MetaMaskContextType {
  account: string | null
  chainId: number | null
  isConnecting: boolean
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
  switchChain: (chainId: number) => Promise<void>
  provider: ethers.BrowserProvider | null
  signer: ethers.Signer | null
}

const MetaMaskContext = createContext<MetaMaskContextType | undefined>(undefined)

interface MetaMaskProviderProps {
  children: ReactNode
}

export function MetaMaskProvider({ children }: MetaMaskProviderProps) {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)

  const isConnected = Boolean(account)

  // Initialize provider
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      setProvider(browserProvider)
    }
  }, [])

  // Check if already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        })

        if (accounts.length > 0) {
          setAccount(accounts[0])

          // Get chain ID
          const chainIdHex = await window.ethereum.request({
            method: 'eth_chainId'
          })
          setChainId(parseInt(chainIdHex, 16))

          // Get signer
          if (provider) {
            const signer = await provider.getSigner()
            setSigner(signer)
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error)
      }
    }

    checkConnection()
  }, [provider])

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setAccount(null)
        setSigner(null)
      } else {
        setAccount(accounts[0])
        // Update signer
        if (provider) {
          provider.getSigner().then(setSigner)
        }
      }
    }

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16)
      setChainId(newChainId)
      // Reload page on chain change (recommended by MetaMask)
      window.location.reload()
    }

    window.ethereum?.on('accountsChanged', handleAccountsChanged)
    window.ethereum?.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [provider])

  const connect = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask is not installed. Please install MetaMask to continue.')
      window.open('https://metamask.io/download/', '_blank')
      return
    }

    setIsConnecting(true)

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        setAccount(accounts[0])

        // Get chain ID
        const chainIdHex = await window.ethereum.request({
          method: 'eth_chainId'
        })
        setChainId(parseInt(chainIdHex, 16))

        // Get signer
        if (provider) {
          const signer = await provider.getSigner()
          setSigner(signer)
        }

        toast.success('Wallet connected successfully')
      }
    } catch (error: any) {
      console.error('Error connecting to MetaMask:', error)

      if (error.code === 4001) {
        toast.error('Connection request rejected')
      } else {
        toast.error('Failed to connect wallet')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAccount(null)
    setSigner(null)
    toast.info('Wallet disconnected')
  }

  const switchChain = async (targetChainId: number) => {
    if (!window.ethereum) {
      toast.error('MetaMask is not installed')
      return
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
      setChainId(targetChainId)
      toast.success('Network switched successfully')
    } catch (error: any) {
      console.error('Error switching chain:', error)

      // Chain not added to MetaMask
      if (error.code === 4902) {
        toast.error('This network is not added to your wallet. Please add it manually.')
      } else if (error.code === 4001) {
        toast.error('Network switch request rejected')
      } else {
        toast.error('Failed to switch network')
      }
    }
  }

  const value: MetaMaskContextType = {
    account,
    chainId,
    isConnecting,
    isConnected,
    connect,
    disconnect,
    switchChain,
    provider,
    signer,
  }

  return (
    <MetaMaskContext.Provider value={value}>
      {children}
    </MetaMaskContext.Provider>
  )
}

export function useMetaMask() {
  const context = useContext(MetaMaskContext)
  if (context === undefined) {
    throw new Error('useMetaMask must be used within a MetaMaskProvider')
  }
  return context
}
