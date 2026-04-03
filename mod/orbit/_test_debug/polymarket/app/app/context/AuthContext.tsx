"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AuthState, ClobCredentials } from "../lib/types";
import { connectWallet, deriveClobApiKey, createClobApiKey, detectWallet } from "../lib/auth";

interface AuthContextType {
  auth: AuthState;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  authenticate: () => Promise<void>;
  error: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  auth: { connected: false, address: null, chainId: null, clobCreds: null, authenticated: false },
  hasWallet: false,
  connect: async () => {},
  disconnect: () => {},
  authenticate: async () => {},
  error: null,
  loading: false,
});

const CREDS_KEY = "poly8bit_creds";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    connected: false,
    address: null,
    chainId: null,
    clobCreds: null,
    authenticated: false,
  });
  const [hasWallet, setHasWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHasWallet(detectWallet());

    // Restore cached creds
    try {
      const cached = localStorage.getItem(CREDS_KEY);
      if (cached) {
        const { address, creds } = JSON.parse(cached);
        setAuth((a) => ({
          ...a,
          clobCreds: creds,
          address,
          authenticated: true,
        }));
      }
    } catch {}

    if (window.ethereum) {
      const handleAccounts = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        if (accounts.length === 0) {
          setAuth((a) => ({ ...a, connected: false, address: null }));
        } else {
          setAuth((a) => ({ ...a, address: accounts[0] }));
        }
      };
      const handleChain = (...args: unknown[]) => {
        const chainId = args[0] as string;
        setAuth((a) => ({ ...a, chainId: parseInt(chainId, 16) }));
      };
      window.ethereum.on("accountsChanged", handleAccounts);
      window.ethereum.on("chainChanged", handleChain);
      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccounts);
        window.ethereum?.removeListener("chainChanged", handleChain);
      };
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { address, chainId } = await connectWallet();
      setAuth((a) => ({ ...a, connected: true, address, chainId }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "CONNECTION FAILED");
    }
    setLoading(false);
  }, []);

  const disconnect = useCallback(() => {
    setAuth({
      connected: false,
      address: null,
      chainId: null,
      clobCreds: null,
      authenticated: false,
    });
    localStorage.removeItem(CREDS_KEY);
    setError(null);
  }, []);

  const authenticate = useCallback(async () => {
    if (!auth.address) {
      setError("CONNECT WALLET FIRST");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Try deriving first, fall back to creating
      let creds: ClobCredentials;
      try {
        creds = await deriveClobApiKey(auth.address);
      } catch {
        creds = await createClobApiKey(auth.address);
      }
      setAuth((a) => ({ ...a, clobCreds: creds, authenticated: true }));
      // Cache creds
      localStorage.setItem(CREDS_KEY, JSON.stringify({ address: auth.address, creds }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AUTH FAILED");
    }
    setLoading(false);
  }, [auth.address]);

  return (
    <AuthContext.Provider value={{ auth, hasWallet, connect, disconnect, authenticate, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
