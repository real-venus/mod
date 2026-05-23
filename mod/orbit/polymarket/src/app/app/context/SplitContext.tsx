"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

export interface SplitPane {
  id: string;
  url: string;
}

interface SplitContextValue {
  panes: SplitPane[];
  widths: number[]; // % of viewport per column, including main; sums to 100
  addPane: (url?: string) => void;
  closePane: (id: string) => void;
  setPaneUrl: (id: string, url: string) => void;
  setWidths: (w: number[]) => void;
}

const STORAGE_KEY = "poly_split_state_v1";

const Ctx = createContext<SplitContextValue | null>(null);

export function useSplit() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSplit must be used inside <SplitProvider>");
  return v;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultPaneUrl(): string {
  if (typeof window === "undefined") return "/polymarket";
  return window.location.pathname + window.location.search;
}

function rebalance(widths: number[]): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0) return widths.map(() => 100 / widths.length);
  return widths.map((w) => (w / sum) * 100);
}

export function SplitProvider({ children }: { children: ReactNode }) {
  const [panes, setPanes] = useState<SplitPane[]>([]);
  const [widths, setWidths] = useState<number[]>([100]);

  // Hydrate from localStorage (only the pane URLs — widths recompute on add).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.panes)) {
        setPanes(parsed.panes);
        const cols = parsed.panes.length + 1;
        setWidths(Array(cols).fill(100 / cols));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ panes }));
    } catch {}
  }, [panes]);

  const addPane = useCallback((url?: string) => {
    const newPane: SplitPane = { id: uid(), url: url || defaultPaneUrl() };
    setPanes((prev) => {
      const next = [...prev, newPane];
      const cols = next.length + 1;
      setWidths(Array(cols).fill(100 / cols));
      return next;
    });
  }, []);

  const closePane = useCallback((id: string) => {
    setPanes((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const cols = next.length + 1;
      setWidths(Array(cols).fill(100 / cols));
      return next;
    });
  }, []);

  const setPaneUrl = useCallback((id: string, url: string) => {
    setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, url } : p)));
  }, []);

  const setWidthsSafe = useCallback((w: number[]) => {
    setWidths(rebalance(w));
  }, []);

  return (
    <Ctx.Provider value={{ panes, widths, addPane, closePane, setPaneUrl, setWidths: setWidthsSafe }}>
      {children}
    </Ctx.Provider>
  );
}
