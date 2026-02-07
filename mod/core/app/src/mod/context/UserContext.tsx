"use client";

import React, { createContext, useContext, useEffect, useState } from 'react'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import Client from '@/mod/client'
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
  balances: (token?: string) => Promise<Record<string, number>>
}

const UserContext = createContext<UserContextType | null>(null)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [network, setNetwork] = useState<Network | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  /**
   * Client-only initialization
   */
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        setAuthLoading(true)

        // Guard: browser only
        if (typeof window === 'undefined') return

        await cryptoWaitReady()
        if (cancelled) return

        setNetwork(new Network('test'))

        const storedUser = localStorage.getItem('user_data')
        const walletMode = localStorage.getItem('wallet_mode')
        const walletAddress = localStorage.getItem('wallet_address')
        let walletToken = localStorage.getItem('wallet_token')

        if (storedUser && walletMode && walletAddress) {
          const parsedUser = JSON.parse(storedUser) as UserType
          setUser(parsedUser)

          if (!walletToken) {
            const auth = new Auth()
            walletToken = await auth.token('', walletAddress, walletMode)
            localStorage.setItem('wallet_token', walletToken)
          }

          if (!cancelled) {
            setClient(new Client(undefined, walletToken))
          }
        }
      } catch (err) {
        console.error('Auth restore failed:', err)
        localStorage.removeItem('user_data')
        localStorage.removeItem('wallet_token')
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  const connectClient = async () => {
    if (typeof window === 'undefined') return

    await cryptoWaitReady()

    const walletAddress = localStorage.getItem('wallet_address')
    const walletMode = localStorage.getItem('wallet_mode') || 'local'

    if (!walletAddress) {
      throw new Error('Wallet address not found')
    }

    const auth = new Auth()
    const token = await auth.token('', walletAddress, walletMode)

    localStorage.setItem('wallet_token', token)
    setClient(new Client(undefined, token))
  }

  const signIn = async () => {
    if (typeof window === 'undefined') return

    await cryptoWaitReady()

    const walletMode = localStorage.getItem('wallet_mode') || 'local'
    const walletAddress = localStorage.getItem('wallet_address')
    const walletType = localStorage.getItem('wallet_type') || 'ecdsa'

    if (!walletAddress) {
      throw new Error('Wallet address missing')
    }

    const auth = new Auth()
    const token = await auth.token('', walletAddress, walletMode)

    localStorage.setItem('wallet_token', token)

    const userData: UserType = {
      key: walletAddress,
      crypto_type: walletType,
      wallet_mode: walletMode,
      token,
      balance: 0,
    }

    setUser(userData)
    setClient(new Client(undefined, token))

    localStorage.setItem('user_data', JSON.stringify(userData))
  }

  const signOut = () => {
    setUser(null)
    setClient(null)

    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_mode')
      localStorage.removeItem('wallet_password')
      localStorage.removeItem('wallet_address')
      localStorage.removeItem('wallet_token')
      localStorage.removeItem('user_data')
    }
  }

  const balances = async (token: string = 'market'): Promise<Record<string, number>> => {
    if (!client) {
      throw new Error('Client not initialized')
    }

    try {
      console.log(`Fetching all balances for token: ${token}`)

      // Call backend API to get all balances for the token
      const result = await client.call('balances', { token })

      if (result && typeof result === 'object') {
        return result as Record<string, number>
      }

      throw new Error('Invalid response format from balances API')
    } catch (err) {
      console.error(`Failed to get balances for token ${token}:`, err)
      throw err
    }
  }

  return (
    <UserContext.Provider
      value={{
        user,
        signIn,
        signOut,
        authLoading,
        client,
        network,
        connectClient,
        balances,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export const userContext = () => {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('userContext must be used within UserProvider')
  }
  return ctx
}
