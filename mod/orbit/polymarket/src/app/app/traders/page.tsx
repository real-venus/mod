"use client";

import { Suspense } from "react";
import TopBar from "../components/TopBar";
import CopyTrading from "../components/CopyTrading";
import { useFilters, useUrlSync } from "../context/FiltersContext";

function TradersInner() {
  useUrlSync();
  const { search, category, daysAgo, minPerDay, reloadKey } = useFilters();
  const days = Number(daysAgo) > 0 ? Number(daysAgo) : 7;
  const minTradesPerDay =
    minPerDay !== "" && Number.isFinite(Number(minPerDay))
      ? Math.max(0, Number(minPerDay))
      : 0;

  return (
    <div className="max-w-[1920px] mx-auto">
      <TopBar searchPlaceholder="SEARCH MARKETS OR ADDRESS..." />
      <div className="p-4">
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

export default function TradersPage() {
  return (
    <Suspense>
      <TradersInner />
    </Suspense>
  );
}
