"use client";

import { useState, useEffect } from 'react'
import { Auth } from '@/client/auth'

const TOKEN_DURATION = 3600

export function useTokenExpiry(userExists: boolean) {
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [isTokenExpired, setIsTokenExpired] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const getTokenExpiry = () => {
    try {
      const token = localStorage.getItem('wallet_token')
      if (!token) return 'No token'
      const auth = new Auth()
      const authData = auth.token2data(token)
      const tokenTime = parseFloat(authData.time)
      const expiryTime = tokenTime + TOKEN_DURATION
      const now = Date.now() / 1000
      const timeLeft = expiryTime - now
      if (timeLeft <= 0) return 'Expired'
      const minutes = Math.floor(timeLeft / 60)
      const seconds = Math.floor(timeLeft % 60)
      return `${minutes}m ${seconds}s`
    } catch {
      return 'Invalid token'
    }
  }

  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      const wallet_mode = localStorage.getItem('wallet_mode') || 'local'
      const wallet_address = localStorage.getItem('wallet_address')
      const auth = new Auth()
      const newToken = await auth.token('', wallet_address, wallet_mode)
      localStorage.setItem('wallet_token', newToken)
      setTokenExpiry(getTokenExpiry())
      setIsTokenExpired(false)
      if (typeof window !== 'undefined') {
        (window as any).__tokenExpired = false
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (!userExists) return
    const interval = setInterval(() => {
      const expiry = getTokenExpiry()
      setTokenExpiry(expiry)
      if (expiry === 'Expired' || expiry === 'Invalid token') {
        setIsTokenExpired(true)
      } else {
        setIsTokenExpired(false)
        if (typeof window !== 'undefined') {
          (window as any).__tokenExpired = false
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [userExists])

  return { tokenExpiry, isTokenExpired, isRefreshing, setIsRefreshing, getTokenExpiry, handleRefreshToken }
}
