"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { AuthState } from "../lib/types";
import { detectWallet, connectWallet, deriveClobApiKey } from "../lib/auth";

interface AuthContextValue {
  auth: AuthState;
  connect: () => Promise<void>;
  disconnect: () => void;
  authenticate: () => Promise<void>;
  error: string | null;
  loading: boolean;
  hasWallet: boolean;
}

const defaultAuth: AuthState = {
  connected: false,
  address: null,
  chainId: null,
  clobCreds: null,
  authenticated: false,
};

const AuthContext = createContext<AuthContextValue>({
  auth: defaultAuth,
  connect: async () => {},
  disconnect: () => {},
  authenticate: async () => {},
  error: null,
  loading: false,
  hasWallet: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(defaultAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(detectWallet());
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { address, chainId } = await connectWallet();
      setAuth((prev) => ({ ...prev, connected: true, address, chainId }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "CONNECTION FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAuth(defaultAuth);
    setError(null);
  }, []);

  const authenticate = useCallback(async () => {
    if (!auth.address) return;
    setError(null);
    setLoading(true);
    try {
      const creds = await deriveClobApiKey(auth.address);
      setAuth((prev) => ({ ...prev, clobCreds: creds, authenticated: true }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AUTH FAILED");
    } finally {
      setLoading(false);
    }
  }, [auth.address]);

  return (
    <AuthContext.Provider value={{ auth, connect, disconnect, authenticate, error, loading, hasWallet }}>
      {children}
    </AuthContext.Provider>
  );
}
