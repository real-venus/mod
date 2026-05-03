"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchWalletTradesUntil, fetchPositions, TopTrader,
} from "../../lib/polymarket";
import { PolymarketTrade, PolymarketPosition } from "../../lib/types";
import TraderProfile from "../../components/TraderProfile";
import NavTabs from "../../components/NavTabs";
import Header from "../../components/Header";
import TraderFilterBar from "../../components/TraderFilterBar";
import { useFilters } from "../../context/FiltersContext";

interface FetchProgress {
  pages: number;
  totalTrades: number;
  oldestMs: number;        // 0 = not yet known
  done: boolean;
}

export default function TraderPage() {
  const params = useParams();
  const router = useRouter();
  const { daysAgo, reloadKey } = useFilters();
  const days = Number(daysAgo) > 0 ? Number(daysAgo) : 7;

  const address = String(
    Array.isArray(params.address) ? params.address[0] : params.address || "",
  ).toLowerCase();

  const [trades, setTrades] = useState<PolymarketTrade[]>([]);
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<FetchProgress>({
    pages: 0, totalTrades: 0, oldestMs: 0, done: false,
  });

  // Start empty on both SSR and CSR; hydrate from localStorage post-mount
  // so we don't trigger a React hydration mismatch.
  const [watchlist, setWatchlist] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = localStorage.getItem("poly8bit_watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved) as string[]));
    } catch {}
  }, []);

  // Day-by-day fetch: paginate /activity until we cover the requested
  // window, reporting progress after each page so the UI can show how
  // far back we've reached. Re-runs whenever the address or window
  // changes — flipping 7→14 days actually pulls more pages of data.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setProgress({ pages: 0, totalTrades: 0, oldestMs: 0, done: false });
    setTrades([]);
    setPositions([]);

    const cutoffSec = Math.floor((Date.now() - days * 86400_000) / 1000);

    // Run trades fetch + positions fetch in parallel — positions is
    // small and one-shot, trades streams progress.
    const tradesP = fetchWalletTradesUntil(address, cutoffSec, (info) => {
      if (cancelled) return;
      setProgress(info);
      // Stream partial trades into state too, so the curve and table
      // start populating as soon as the first page lands instead of
      // waiting for the full pagination to finish.
      setTrades((prev) => {
        if (info.totalTrades <= prev.length) return prev;
        return info.partial;
      });
    });
    const posP = fetchPositions(address);

    Promise.all([tradesP, posP])
      .then(([t, p]) => {
        if (cancelled) return;
        setTrades(t);
        setPositions(p);
      })
      .catch(() => {
        if (cancelled) return;
        setTrades([]);
        setPositions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, days, reloadKey]);

  const trader: TopTrader = useMemo(() => {
    const cutoffMs = Date.now() - days * 86400_000;
    const recent = trades.filter((t) => t.timestamp >= cutoffMs);
    const volume = recent.reduce((s, t) => s + t.size * t.price, 0);
    return {
      address,
      volume,
      pnl: 0,
      winRate: -1,
      positions: positions.length,
      marketTitles: positions.map((p) => p.market).slice(0, 20),
    };
  }, [address, days, trades, positions]);

  const watching = watchlist.has(address);
  const toggleWatch = () => {
    const next = new Set(Array.from(watchlist));
    if (next.has(address)) next.delete(address);
    else next.add(address);
    setWatchlist(next);
    try {
      localStorage.setItem("poly8bit_watchlist", JSON.stringify(Array.from(next)));
    } catch {}
  };

  // Convert "how far back have we paginated" into hours synced. The
  // window is `days` long so the target is `days * 24` hours; we cap at
  // 100% once we've reached the cutoff.
  const hoursTotal = days * 24;
  const hoursCovered =
    progress.oldestMs > 0
      ? Math.max(0, (Date.now() - progress.oldestMs) / 3_600_000)
      : 0;
  const pct = Math.min(100, Math.round((hoursCovered / hoursTotal) * 100));

  return (
    <div className="max-w-[1920px] mx-auto">
      <Header
        showSearch={false}
        showSort={false}

        showCategories={false}
      />
      <NavTabs />
      <TraderFilterBar />

      {/* Sticky load-progress strip — sits right below the nav tabs so
          it's always visible while we're paginating /activity. Shows
          hours synced out of the total hours in the requested window. */}
      {loading && progress.pages > 0 && (
        <div className="sticky top-14 z-30 border-b-2 border-pixel-border bg-pixel-black/95 px-4 py-2">
          <div className="max-w-[1920px] mx-auto flex items-center gap-3 font-mono text-[10px]">
            <span className="text-pixel-green glow-green shrink-0">SYNCING</span>
            <span className="text-pixel-white shrink-0">
              {hoursCovered.toFixed(1)}H / {hoursTotal}H
            </span>
            <div className="pixel-bar flex-1 h-2.5">
              <div
                className="pixel-bar-fill bg-pixel-green/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-pixel-gray shrink-0">
              {progress.totalTrades} TRADES · PG {progress.pages}
            </span>
            <span className="text-pixel-gray-light shrink-0">{pct}%</span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        <TraderProfile
          trader={trader}
          trades={trades}
          positions={positions}
          loading={loading && trades.length === 0}
          watching={watching}
          onToggleWatch={toggleWatch}
          onBack={() => router.push("/traders")}
          days={days}
        />
      </div>
    </div>
  );
}
