"use client";

import Header from "../components/Header";
import NavTabs from "../components/NavTabs";
import MarketsGrid from "../components/MarketsGrid";
import { useFilters } from "../context/FiltersContext";

export default function MarketsPage() {
  // Markets only ever shows currently-active markets — no historical
  // filter — so the shared `daysAgo` filter doesn't apply here. Days
  // is hidden in the header and we pass an empty value to the grid.
  const { search, sort, category, reloadKey } = useFilters();

  return (
    <div className="max-w-[1920px] mx-auto">
      <Header
        showSearch
        showSort

        showCategories
        searchPlaceholder="SEARCH MARKETS..."
      />
      <NavTabs />
      <div className="p-4 space-y-4">
        <MarketsGrid
          search={search}
          sort={sort}
          category={category}
          daysAgo=""
          reloadKey={reloadKey}
        />
      </div>
    </div>
  );
}
