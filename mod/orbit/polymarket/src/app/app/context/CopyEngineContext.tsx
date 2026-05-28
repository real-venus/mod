"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { CopyEngine, CopyEngineState, CopyEngineConfig } from "../lib/copyEngine";

interface CopyEngineContextValue {
  engineState: CopyEngineState | null;
  isLive: boolean;
  /** Strategy id currently being run (null when stopped). Exposed so the
      global LIVE indicator can show which strat is running and let users
      switch from anywhere in the app. */
  activeStrategyId: string | null;
  startLive: (config: CopyEngineConfig) => void;
  stopLive: () => void;
  pauseLive: () => void;
  resumeLive: () => void;
  clearLog: () => void;
}

// Persisted live-session record. Holds only the *config* needed to rebuild
// the engine on reload; sensitive bits (clobCreds) are sourced from
// AuthContext's per-EOA cache, so we don't double-store them.
interface PersistedLive {
  strategyId: string;
  address: string;
  capital: number;
  intervalMs: number;
  minOrderSize: number;
  maxSlippageBps: number;
  startedAt: number;
}

const LIVE_KEY = "poly_live_session";

function loadPersistedLive(): PersistedLive | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LIVE_KEY) : null;
    if (!raw) return null;
    const obj = JSON.parse(raw) as PersistedLive;
    if (!obj.strategyId || !obj.address || !obj.intervalMs) return null;
    return obj;
  } catch {
    return null;
  }
}

function savePersistedLive(rec: PersistedLive): void {
  try { localStorage.setItem(LIVE_KEY, JSON.stringify(rec)); } catch {}
}

function clearPersistedLive(): void {
  try { localStorage.removeItem(LIVE_KEY); } catch {}
}

export function getPersistedLive(): PersistedLive | null {
  return loadPersistedLive();
}

const CopyEngineContext = createContext<CopyEngineContextValue>({
  engineState: null,
  isLive: false,
  activeStrategyId: null,
  startLive: () => {},
  stopLive: () => {},
  pauseLive: () => {},
  resumeLive: () => {},
  clearLog: () => {},
});

export function useCopyEngine() {
  return useContext(CopyEngineContext);
}

export function CopyEngineProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<CopyEngine | null>(null);
  const [engineState, setEngineState] = useState<CopyEngineState | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);

  const startLive = useCallback((config: CopyEngineConfig) => {
    // Stop existing engine if any
    if (engineRef.current) {
      engineRef.current.stop();
    }

    const engine = new CopyEngine(config);
    engineRef.current = engine;

    engine.subscribe((s) => setEngineState(s));
    engine.start();
    setIsLive(true);
    setActiveStrategyId(config.strategyId);
    setEngineState(engine.getState());

    // Persist the session so a page reload (intentional or accidental) can
    // restart the engine without the user having to click GO LIVE again.
    // CLOB creds are NOT included — those come from AuthContext's per-EOA
    // cache, rehydrated independently at boot.
    savePersistedLive({
      strategyId: config.strategyId,
      address: config.address,
      capital: config.capital,
      intervalMs: config.intervalMs,
      minOrderSize: config.minOrderSize,
      maxSlippageBps: config.maxSlippageBps,
      startedAt: Date.now(),
    });
  }, []);

  const stopLive = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setEngineState(engineRef.current.getState());
    }
    setIsLive(false);
    setActiveStrategyId(null);
    // User explicitly stopped — wipe the persisted record so the next
    // reload doesn't silently restart the engine.
    clearPersistedLive();
  }, []);

  const pauseLive = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
      setEngineState(engineRef.current.getState());
    }
  }, []);

  const resumeLive = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resume();
      setEngineState(engineRef.current.getState());
    }
  }, []);

  const clearLog = useCallback(() => {
    // Clear persisted log for current strategy
    setEngineState((prev) => prev ? { ...prev, log: [] } : null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, []);

  return (
    <CopyEngineContext.Provider value={{ engineState, isLive, activeStrategyId, startLive, stopLive, pauseLive, resumeLive, clearLog }}>
      {children}
    </CopyEngineContext.Provider>
  );
}
