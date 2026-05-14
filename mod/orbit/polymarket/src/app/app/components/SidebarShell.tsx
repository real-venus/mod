"use client";

import { ReactNode, useState } from "react";
import { useSidebar, SIDEBAR_DEFAULT } from "../context/SidebarContext";
import { useFilters } from "../context/FiltersContext";
import { useAuth } from "../context/AuthContext";
import StratPicker from "./StratPicker";
import CopyIndex from "./CopyIndex";
import LivePanel from "./LivePanel";
import ProfileWalletPanel from "./ProfileWalletPanel";
import TokenPanel from "./TokenPanel";

type SubTab = "backtest" | "live" | "profile";

export default function SidebarShell({ children }: { children: ReactNode }) {
  const { docked, width, hydrated, setWidth, setDocked, startDrag } = useSidebar();
  const { search } = useFilters();
  const { localToken } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("backtest");
  const [stratVersion, setStratVersion] = useState(0);

  if (!hydrated) return <>{children}</>;
  if (!docked) return <>{children}</>;

  const resetWidth = () => setWidth(SIDEBAR_DEFAULT);

  const tabs: { id: SubTab; label: string }[] = [
    { id: "backtest", label: "BACKTEST" },
    { id: "live", label: "LIVE" },
    { id: "profile", label: "PROFILE" },
  ];

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
        {/* Header: key + close */}
        <div className="flex items-center justify-between px-2 py-1 bg-pixel-black sticky top-0 z-10">
          {localToken ? (
            <div className="flex items-center gap-1.5 text-[8px] font-mono">
              <span className="text-pixel-gray tracking-wider">KEY</span>
              <span className="text-green-400">{localToken.tokenPreview}</span>
            </div>
          ) : (
            <span className="text-[8px] text-pixel-gray tracking-wider">NO KEY</span>
          )}
          <button
            onClick={() => setDocked(false)}
            className="pixel-btn text-[7px] px-1.5 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white"
            title="Close"
          >
            X
          </button>
        </div>

        <div className="p-2 space-y-2">
          {/* Strat picker is always visible at top */}
          <StratPicker onStratChange={() => setStratVersion((v) => v + 1)} />

          {/* Tabs below strats */}
          <div className="flex items-center">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`text-[8px] tracking-wider px-2 py-1 transition-colors ${
                  subTab === t.id
                    ? "text-green-400 border-b border-green-400"
                    : "text-pixel-gray hover:text-pixel-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {subTab === "backtest" && (
            <CopyIndex key={stratVersion} searchFilter={search} compact />
          )}
          {subTab === "live" && (
            <LivePanel />
          )}
          {subTab === "profile" && (
            <div className="space-y-2">
              <ProfileWalletPanel />
              <TokenPanel />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
