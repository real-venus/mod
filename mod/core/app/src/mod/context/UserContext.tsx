'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Key } from '@/mod/key'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import  Client from '@/mod/client'
import { Auth } from '@/mod/client/auth'
import { UserType } from '@/mod/types'
import { Network } from '@/mod/network/network'

interface UserContextType {
  user: UserType | null
  signIn: () => Promise<void>
  signOut: () => void
  network: Network | null
  authLoading: boolean
  client: Client | null
  connectClient: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [network, setNetwork] = useState<Network| null>(null)

  // Initialize from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setNetwork(new Network('test'))
        await cryptoWaitReady()
        
        // Check if user data exists in localStorage
        const storedUserData = localStorage.getItem('user_data')
        const walletMode = localStorage.getItem('wallet_mode')
        const walletAddress = localStorage.getItem('wallet_address')
        let  walletToken = localStorage.getItem('wallet_token')
        
        if (storedUserData && walletMode && walletAddress) {
          // Restore user session from localStorage
          const userData = JSON.parse(storedUserData)
          setUser(userData)
          
          // Regenerate token and client
          if (!walletToken) {
            const auth = new Auth()
            walletToken = await auth.token('', walletAddress, walletMode)
            localStorage.setItem('wallet_token', walletToken)
          }
          setClient(new Client(undefined, walletToken))

        }
      } catch (error) {
        console.error('Failed to restore auth session:', error)
        localStorage.removeItem('user_data')
      } finally {
        setAuthLoading(false)
      }
    }
    
    initializeAuth()
  }, [])

  const signIn = async () => {
    try {
      await cryptoWaitReady()
  
      const wallet_mode = localStorage.getItem('wallet_mode') || 'local'
      const wallet_address = localStorage.getItem('wallet_address') 
      const wallet_type = localStorage.getItem('wallet_type') || 'edcsa'

      const auth = new Auth()
      const token = await auth.token('',wallet_address, wallet_mode)
      localStorage.setItem('wallet_token', token)

      setClient(new Client(undefined, token))
      let balance = 0
      if (!network) {
        throw new Error('Network not initialized')
      }      
      const userData = {
        key: wallet_address,
        crypto_type: wallet_type,
        wallet_mode: wallet_mode,
        token: token,
        balance: balance,
        
      }
      setUser(userData)
      
      // Persist to localStorage
      localStorage.setItem('user_data', JSON.stringify(userData))
    } catch (error) {
      console.error('Failed to sign in:', error)
      throw error
    }
  }

  const signOut = () => {
    setUser(null)
    setClient(null)
    localStorage.removeItem('wallet_mode')
    localStorage.removeItem('wallet_password')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('user_data')
  }

  return (
    <UserContext.Provider value={{ user, signIn, signOut, authLoading, client , network }}>
      {children}
    </UserContext.Provider>
  )
}

export const userContext = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('userContext must be used within an UserProvider')
  }
  return context
}