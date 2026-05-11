"use client";

import { ReactNode, useCallback } from "react";
import { useSidebar, SIDEBAR_DEFAULT } from "../context/SidebarContext";
import { useFilters } from "../context/FiltersContext";
import { fetchPositions } from "../lib/polymarket";
import { loadIndexes, getActiveIndexId } from "../lib/indexStore";
import { StratContext } from "../../../strats/types";
import StratPicker from "./StratPicker";
import CopyIndex from "./CopyIndex";
import ProfileAuthPanel from "./ProfileAuthPanel";

/// Wraps the page content. When the strats sidebar is docked, renders a
/// resizable right rail next to the page so strats stay visible across routes.
export default function SidebarShell({ children }: { children: ReactNode }) {
  const { docked, width, hydrated, setWidth, setDocked, startDrag } = useSidebar();
  const { search } = useFilters();

  const buildContext = useCallback(async (): Promise<StratContext> => {
    const indexes = loadIndexes();
    const activeId = getActiveIndexId();
    const active = (activeId && indexes.find((i) => i.id === activeId)) || indexes[0] || null;
    return {
      vaultAddress: process.env.NEXT_PUBLIC_VAULT_ADDRESS || "",
      vaultUsdc: 0n,
      vaultPositions: new Map(),
      followedTraders: active ? active.traders.map((t) => ({ address: t.address, weight: t.weight })) : [],
      fetchTraderPositions: (addr: string) => fetchPositions(addr),
      fetchMidPrice: async () => 0.5,
    };
  }, []);

  // Avoid layout flicker until persisted prefs hydrate.
  if (!hydrated) return <>{children}</>;
  if (!docked) return <>{children}</>;

  const resetWidth = () => setWidth(SIDEBAR_DEFAULT);

  return (
    <div className="flex items-stretch min-h-[calc(100vh-3rem)]">
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      <div
        onMouseDown={startDrag}
        onDoubleClick={resetWidth}
        className="w-1.5 shrink-0 bg-pixel-border hover:bg-pixel-white/40 active:bg-pixel-white/60 cursor-col-resize transition-colors"
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize · Double-click to reset"
      />
      <aside
        style={{ width }}
        className="shrink-0 border-l-2 border-pixel-border bg-pixel-black/60 overflow-y-auto"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-pixel-border bg-pixel-black sticky top-0 z-10">
          <span className="text-[9px] text-pixel-gray tracking-wider">PROFILE · STRATS</span>
          <button
            onClick={() => setDocked(false)}
            className="pixel-btn text-[8px] px-2 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white"
            title="Close"
          >
            CLOSE
          </button>
        </div>
        <div className="p-3 space-y-3">
          <ProfileAuthPanel />
          <StratPicker buildContext={buildContext} />
          <CopyIndex searchFilter={search} compact />
        </div>
      </aside>
    </div>
  );
}
