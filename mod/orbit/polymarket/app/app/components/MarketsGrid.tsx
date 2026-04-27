"use client";

import { useState, useEffect, useCallback } from "react";
import { PolymarketMarket } from "../lib/types";
import {
  fetchMarkets,
  fetchMarketsByCategory,
  searchMarkets,
  CATEGORIES,
  CategorySlug,
} from "../lib/polymarket";
import MarketCard from "./MarketCard";

type SortMode = "volume" | "liquidity" | "end_date_min";
const PAGE_SIZE = 20;

interface Props {
  onSelectMarket?: (market: PolymarketMarket) => void;
  selectedMarket?: PolymarketMarket | null;
}

export default function MarketsGrid({ onSelectMarket, selectedMarket }: Props) {
  const [allMarkets, setAllMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("volume");
  const [category, setCategory] = useState<CategorySlug>("");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: PolymarketMarket[];
      if (search.trim()) {
        data = await searchMarkets(search.trim(), 100);
      } else if (category) {
        data = await fetchMarketsByCategory(category, 100);
      } else {
        data = await fetchMarkets(100, sort);
      }
      setAllMarkets(data);
      setPage(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "LOAD FAILED");
    }
    setLoading(false);
  }, [search, sort, category]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(allMarkets.length / PAGE_SIZE);
  const pageMarkets = allMarkets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="pixel-panel p-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH MARKETS..."
              className="pixel-input w-full"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["volume", "liquidity", "end_date_min"] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`pixel-btn text-[6px] ${
                  sort === s
                    ? "border-pixel-cyan text-pixel-cyan bg-pixel-cyan/10"
                    : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                }`}
              >
                {s === "end_date_min" ? "ENDING" : s.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10"
          >
            RELOAD
          </button>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setCategory(cat.slug)}
              className={`pixel-btn text-[6px] ${
                category === cat.slug
                  ? "border-pixel-amber text-pixel-amber bg-pixel-amber/10"
                  : "border-pixel-border text-pixel-gray hover:text-pixel-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="pixel-panel-red p-3 text-[7px] text-pixel-red text-center">
          ERROR: {error}
        </div>
      )}

      {loading ? (
        <div className="pixel-panel p-8 text-center">
          <div className="text-[8px] text-pixel-green animate-pulse glow-green">
            LOADING MARKETS...
          </div>
          <div className="mt-2 flex justify-center gap-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 bg-pixel-green/40"
                style={{ animationDelay: `${i * 100}ms`, animation: "blink 1.5s step-end infinite" }}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-[7px] text-pixel-gray-light tracking-widest">
              PREDICTION MARKETS
            </span>
            <span className="text-[6px] text-pixel-gray">
              {allMarkets.length} TOTAL
              {totalPages > 1 && ` \u2022 PAGE ${page + 1}/${totalPages}`}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="pixel-btn text-[7px] border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                PREV
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`pixel-btn text-[7px] w-7 ${
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
                className="pixel-btn text-[7px] border-pixel-border text-pixel-gray hover:text-pixel-white disabled:opacity-30 disabled:cursor-not-allowed"
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
