"use client";

import {
  createContext, useContext, useState, useEffect, ReactNode, useCallback,
} from "react";
import { CategorySlug } from "../lib/polymarket";

export type SortMode = "volume" | "liquidity" | "end_date_min";

interface FiltersContextValue {
  search: string;
  setSearch: (v: string) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
  category: CategorySlug;
  setCategory: (v: CategorySlug) => void;
  daysAgo: string;            // empty string = "no time filter"
  setDaysAgo: (v: string) => void;
  minPerDay: string;          // empty string = "no minimum activity filter"
  setMinPerDay: (v: string) => void;
  minVolume: string;          // min total in-window USDC traded
  setMinVolume: (v: string) => void;
  minBuyVolume: string;       // min in-window USDC on BUYs
  setMinBuyVolume: (v: string) => void;
  minSellVolume: string;      // min in-window USDC on SELLs
  setMinSellVolume: (v: string) => void;
  reloadKey: number;
  reload: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

const STORAGE_KEY = "poly8bit_filters_v1";

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used inside <FiltersProvider>");
  return ctx;
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("volume");
  const [category, setCategory] = useState<CategorySlug>("");
  const [daysAgo, setDaysAgo] = useState<string>("");
  const [minPerDay, setMinPerDay] = useState<string>("1");
  const [minVolume, setMinVolume] = useState<string>("");
  const [minBuyVolume, setMinBuyVolume] = useState<string>("");
  const [minSellVolume, setMinSellVolume] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  // Hydrate persisted filters once on mount so filters survive navigation
  // and reloads (sessionStorage keeps it scoped to the tab).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<FiltersContextValue>;
      if (typeof saved.search === "string") setSearch(saved.search);
      if (typeof saved.sort === "string") setSort(saved.sort as SortMode);
      if (typeof saved.category === "string") setCategory(saved.category as CategorySlug);
      if (typeof saved.daysAgo === "string") setDaysAgo(saved.daysAgo);
      if (typeof saved.minPerDay === "string") setMinPerDay(saved.minPerDay);
      if (typeof saved.minVolume === "string") setMinVolume(saved.minVolume);
      if (typeof saved.minBuyVolume === "string") setMinBuyVolume(saved.minBuyVolume);
      if (typeof saved.minSellVolume === "string") setMinSellVolume(saved.minSellVolume);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          search, sort, category, daysAgo, minPerDay,
          minVolume, minBuyVolume, minSellVolume,
        }),
      );
    } catch {}
  }, [search, sort, category, daysAgo, minPerDay, minVolume, minBuyVolume, minSellVolume]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <FiltersContext.Provider
      value={{
        search, setSearch,
        sort, setSort,
        category, setCategory,
        daysAgo, setDaysAgo,
        minPerDay, setMinPerDay,
        minVolume, setMinVolume,
        minBuyVolume, setMinBuyVolume,
        minSellVolume, setMinSellVolume,
        reloadKey, reload,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
}
