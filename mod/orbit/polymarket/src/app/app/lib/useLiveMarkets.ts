"use client";

import { useEffect, useRef, useState } from "react";
import { PolymarketMarket } from "./types";
import { fetchMarkets } from "./polymarket";

interface Options {
  limit?: number;
  order?: string;
  intervalMs?: number;
  pauseWhenHidden?: boolean;
}

/**
 * Poll the top markets on an interval. Tracks the previous outcomePrices
 * snapshot so consumers can render price-delta flashes without recomputing.
 *
 * Stops polling while the tab is hidden (visibilitychange) so we don't burn
 * the rate limit on background tabs.
 */
export function useLiveMarkets({
  limit = 24,
  order = "volume",
  intervalMs = 8000,
  pauseWhenHidden = true,
}: Options = {}) {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Map conditionId → previous yes price, for delta animations.
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const [prevPrices, setPrevPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const next = await fetchMarkets(limit, order);
        if (!alive) return;
        const snap = new Map<string, number>();
        for (const m of next) {
          snap.set(m.conditionId, m.outcomePrices?.[0] ?? 0);
        }
        setPrevPrices(new Map(prevPricesRef.current));
        prevPricesRef.current = snap;
        setMarkets(next);
        setLoading(false);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        setLoading(false);
      }
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    void tick();
    start();

    const onVisibility = () => {
      if (!pauseWhenHidden) return;
      if (document.hidden) stop();
      else {
        void tick();
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [limit, order, intervalMs, pauseWhenHidden]);

  return { markets, loading, error, prevPrices };
}
