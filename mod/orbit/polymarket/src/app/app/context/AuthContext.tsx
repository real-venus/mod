"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { AuthState } from "../lib/types";
import { detectWallet, connectWallet, deriveClobApiKey } from "../lib/auth";

interface LocalToken {
  token: string;
  tokenPreview: string;
  issuedAt: number;
}

interface AuthContextValue {
  auth: AuthState;
  connect: () => Promise<void>;
  disconnect: () => void;
  authenticate: () => Promise<void>;
  generateToken: () => void;
  localToken: LocalToken | null;
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

const LOCAL_TOKEN_KEY = "poly8bit_local_token";

const AuthContext = createContext<AuthContextValue>({
  auth: defaultAuth,
  connect: async () => {},
  disconnect: () => {},
  authenticate: async () => {},
  generateToken: () => {},
  localToken: null,
  error: null,
  loading: false,
  hasWallet: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

function loadStoredToken(): LocalToken | null {
  try {
    const raw = localStorage.getItem(LOCAL_TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(defaultAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [localToken, setLocalToken] = useState<LocalToken | null>(null);

  useEffect(() => {
    setHasWallet(detectWallet());
    setLocalToken(loadStoredToken());
  }, []);

  // Clear CLOB creds when the active wallet account changes. The HMAC
  // creds are minted against a specific EOA, so leaving them in place
  // after a switch produces silent 401s on every L2 call.
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const eth = window.ethereum as {
      on?: (e: string, h: (...a: unknown[]) => void) => void;
      removeListener?: (e: string, h: (...a: unknown[]) => void) => void;
    };
    if (!eth.on || !eth.removeListener) return;
    const handler = (...args: unknown[]) => {
      const accts = (args[0] as string[]) || [];
      const next = accts[0]?.toLowerCase() || null;
      setAuth((prev) => {
        const cur = prev.address?.toLowerCase() || null;
        if (next === cur) return prev;
        // Account changed (or disconnected) — drop CLOB creds; user must
        // re-authenticate against the new address.
        return {
          ...prev,
          address: next,
          authenticated: false,
          clobCreds: null,
          connected: !!next,
        };
      });
    };
    eth.on("accountsChanged", handler);
    return () => eth.removeListener?.("accountsChanged", handler);
  }, []);

  const generateToken = useCallback(() => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const entry: LocalToken = { token, tokenPreview: token.slice(0, 8), issuedAt: Date.now() };
    try { localStorage.setItem(LOCAL_TOKEN_KEY, JSON.stringify(entry)); } catch {}
    setLocalToken(entry);
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
      console.error("CLOB auth error:", e);
      setError(e instanceof Error ? e.message : "AUTH FAILED");
    } finally {
      setLoading(false);
    }
  }, [auth.address]);

  return (
    <AuthContext.Provider value={{ auth, connect, disconnect, authenticate, generateToken, localToken, error, loading, hasWallet }}>
      {children}
    </AuthContext.Provider>
  );
}
