"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { CopyEngine, CopyEngineState, CopyEngineConfig } from "../lib/copyEngine";

interface CopyEngineContextValue {
  engineState: CopyEngineState | null;
  isLive: boolean;
  startLive: (config: CopyEngineConfig) => void;
  stopLive: () => void;
  pauseLive: () => void;
  resumeLive: () => void;
  clearLog: () => void;
}

const CopyEngineContext = createContext<CopyEngineContextValue>({
  engineState: null,
  isLive: false,
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
    setEngineState(engine.getState());
  }, []);

  const stopLive = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setEngineState(engineRef.current.getState());
    }
    setIsLive(false);
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
    <CopyEngineContext.Provider value={{ engineState, isLive, startLive, stopLive, pauseLive, resumeLive, clearLog }}>
      {children}
    </CopyEngineContext.Provider>
  );
}
