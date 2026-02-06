"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Auth } from '@/mod/client/auth';
import { TokenRefreshManager } from '@/mod/client/tokenRefresh';
import { userContext } from './UserContext';

interface TokenRefreshContextType {
  refreshToken: () => Promise<void>;
  isRefreshing: boolean;
}

const TokenRefreshContext = createContext<TokenRefreshContextType | undefined>(undefined);

export const TokenRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signIn } = userContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshManager, setRefreshManager] = useState<TokenRefreshManager | null>(null);

  useEffect(() => {
    if (user) {
      const auth = new Auth();
      const manager = new TokenRefreshManager(
        auth,
        async (newToken) => {
          // Update client with new token
          localStorage.setItem('wallet_token', newToken);
          // Re-sign in to update user context
          await signIn();
        },
        3600000 // 1 hour
      );

      setRefreshManager(manager);
      manager.startAutoRefresh();

      return () => {
        manager.stopAutoRefresh();
      };
    }
  }, [user]);

  const refreshToken = async () => {
    if (!refreshManager) return;
    
    setIsRefreshing(true);
    try {
      const walletMode = localStorage.getItem('wallet_mode') || 'local';
      const walletAddress = localStorage.getItem('wallet_address');
      
      // Prompt user to sign based on wallet mode
      if (walletMode === 'local') {
        // Local key - just re-sign automatically
        await refreshManager.refreshToken();
      } else {
        // Wallet key - prompt wallet to sign
        const auth = new Auth();
        const newToken = await auth.token('', walletAddress, walletMode);
        localStorage.setItem('wallet_token', newToken);
        await signIn();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <TokenRefreshContext.Provider value={{ refreshToken, isRefreshing }}>
      {children}
    </TokenRefreshContext.Provider>
  );
};

export const useTokenRefresh = () => {
  const context = useContext(TokenRefreshContext);
  if (context === undefined) {
    throw new Error('useTokenRefresh must be used within TokenRefreshProvider');
  }
  return context;
};