"use client";

import Header from "../components/Header";
import NavTabs from "../components/NavTabs";
import CopyTrading from "../components/CopyTrading";
import ScraperStatus from "../components/ScraperStatus";
import TraderFilterBar from "../components/TraderFilterBar";
import { useFilters } from "../context/FiltersContext";

export default function TradersPage() {
  const { search, category, daysAgo, minPerDay, reloadKey } = useFilters();
  // Default to 7-day window for traders if user hasn't picked anything
  // — there's no leaderboard for "all-time" via this endpoint, so an empty
  // daysAgo would be meaningless here.
  const days = Number(daysAgo) > 0 ? Number(daysAgo) : 7;
  // Minimum trades-per-day default: 0 (no minimum). Empty input falls
  // through as 0; otherwise we respect the user's value.
  const minTradesPerDay =
    minPerDay !== "" && Number.isFinite(Number(minPerDay))
      ? Math.max(0, Number(minPerDay))
      : 0;

  return (
    <div className="max-w-[1920px] mx-auto">
      <Header
        showSearch
        showSort={false}

        showCategories
        searchPlaceholder="SEARCH BY ADDRESS..."
      />
      <NavTabs />
      <TraderFilterBar />
      <div className="p-4 space-y-3">
        <ScraperStatus />
        <CopyTrading
          days={days}
          minTradesPerDay={minTradesPerDay}
          reloadKey={reloadKey}
          search={search}
          category={category}
        />
      </div>
    </div>
  );
}
