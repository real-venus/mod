"use client";

import { Suspense } from "react";
import TopBar from "../components/TopBar";
import CopyIndex from "../components/CopyIndex";
import PreconditionChecklist from "../components/PreconditionChecklist";
import { useFilters, useUrlSync } from "../context/FiltersContext";

function StratsInner() {
  useUrlSync();
  const { search } = useFilters();

  return (
    <div className="max-w-[1920px] mx-auto">
      <TopBar searchPlaceholder="FILTER INDEX BY MARKET..." />
      <div className="p-4">
        <PreconditionChecklist />
        <CopyIndex searchFilter={search} />
      </div>
    </div>
  );
}

export default function StratsPage() {
  return (
    <Suspense>
      <StratsInner />
    </Suspense>
  );
}
