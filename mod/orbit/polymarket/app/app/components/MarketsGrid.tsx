"use client";

import { useState, useEffect, useCallback } from "react";
import { PolymarketMarket } from "../lib/types";
import {
  fetchMarkets,
  fetchMarketsByCategory,
  searchMarkets,
  CategorySlug,
} from "../lib/polymarket";
import MarketCard from "./MarketCard";

type SortMode = "volume" | "liquidity" | "end_date_min";
const PAGE_SIZE = 20;

interface Props {
  onSelectMarket?: (market: PolymarketMarket) => void;
  selectedMarket?: PolymarketMarket | null;
  search: string;
  sort: SortMode;
  category: CategorySlug;
  daysAgo: string;
  reloadKey: number;
}

export default function MarketsGrid({
  onSelectMarket, selectedMarket,
  search, sort, category, daysAgo, reloadKey,
}: Props) {
  const [allMarkets, setAllMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Compute fromDate from daysAgo
      let fromDate = "";
      if (daysAgo && parseInt(daysAgo) > 0) {
        const d = new Date();
        d.setDate(d.getDate() - parseInt(daysAgo));
        fromDate = d.toISOString().split("T")[0];
      }

      let data: PolymarketMarket[];
      if (search.trim()) {
        data = await searchMarkets(search.trim(), 100);
      } else if (category) {
        data = await fetchMarketsByCategory(category, 100);
      } else {
        data = await fetchMarkets(100, sort, fromDate);
      }
      // Client-side date filtering for search/category results
      if (fromDate) {
        data = data.filter((m) => {
          if (!m.endDate) return true;
          const end = m.endDate.split("T")[0];
          if (end < fromDate) return false;
          return true;
        });
      }
      setAllMarkets(data);
      setPage(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "LOAD FAILED");
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, category, daysAgo, reloadKey]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(allMarkets.length / PAGE_SIZE);
  const pageMarkets = allMarkets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {error && (
        <div className="pixel-panel-red p-4 text-[11px] text-pixel-red text-center">
          ERROR: {error}
        </div>
      )}

      {loading ? (
        <div className="pixel-panel p-10 text-center">
          <div className="text-[12px] text-pixel-green animate-pulse glow-green">
            LOADING MARKETS...
          </div>
          <div className="mt-3 flex justify-center gap-1.5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 bg-pixel-green/40"
                style={{ animationDelay: `${i * 100}ms`, animation: "blink 1.5s step-end infinite" }}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-pixel-gray-light tracking-widest">
              PREDICTION MARKETS
            </span>
            <span className="text-[10px] text-pixel-gray">
              {allMarkets.length} TOTAL
              {totalPages > 1 && ` \u2022 PAGE ${page + 1}/${totalPages}`}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {pageMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onSelect={onSelectMarket}
                selected={selectedMarket?.id === market.id}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="pixel-btn text-[10px] border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                PREV
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`pixel-btn text-[10px] w-8 ${
                    page === i
                      ? "border-pixel-green text-pixel-green bg-pixel-green/10"
                      : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="pixel-btn text-[10px] border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                NEXT
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
