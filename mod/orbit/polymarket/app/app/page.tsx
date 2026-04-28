"use client";

import { useState } from "react";
import { PolymarketMarket } from "./lib/types";
import Header from "./components/Header";
import MarketsGrid from "./components/MarketsGrid";
import TradePanel from "./components/TradePanel";
import CopyTrading from "./components/CopyTrading";
import PositionsTable from "./components/PositionsTable";
import AuthPanel from "./components/AuthPanel";
import { useAuth } from "./context/AuthContext";
import { CategorySlug } from "./lib/polymarket";

type Tab = "markets" | "copy" | "portfolio";
type SortMode = "volume" | "liquidity" | "end_date_min";

export default function Home() {
  const [tab, setTab] = useState<Tab>("markets");
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const { auth } = useAuth();

  // Lifted filter state
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("volume");
  const [category, setCategory] = useState<CategorySlug>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const tabs: { id: Tab; label: string; icon: string; color: string }[] = [
    { id: "markets", label: "WORLDS", icon: "?", color: "white" },
    { id: "copy", label: "WARP ZONE", icon: "★", color: "white" },
    { id: "portfolio", label: "POWER UPS", icon: "🍄", color: "white" },
  ];

  return (
    <div className="max-w-[1920px] mx-auto">
      {/* Header with filters */}
      <Header
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        category={category}
        onCategoryChange={setCategory}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        onReload={() => setReloadKey((k) => k + 1)}
        showFilters={tab === "markets"}
      />

      {/* Tab Navigation */}
      <div className="border-b-2 border-pixel-border bg-pixel-black/50 px-4">
        <div className="flex items-center gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-all ${
                tab === t.id
                  ? `text-pixel-${t.color} border-pixel-${t.color} bg-pixel-${t.color}/5`
                  : "text-pixel-gray border-transparent hover:text-pixel-white hover:border-pixel-border"
              }`}
            >
              <div
                className={`w-4 h-4 border flex items-center justify-center text-[6px] ${
                  tab === t.id
                    ? `border-pixel-${t.color} text-pixel-${t.color}`
                    : "border-pixel-border text-pixel-gray"
                }`}
              >
                {t.icon}
              </div>
              <span className="text-[7px] tracking-widest">{t.label}</span>
            </button>
          ))}

          {/* Right side status */}
          <div className="ml-auto flex items-center gap-3 text-[6px]">
            {auth.authenticated && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-pixel-green animate-pulse" />
                <span className="text-pixel-green">API LIVE</span>
              </div>
            )}
            <span className="text-pixel-gray">POLYGON CLOB v1</span>
          </div>
        </div>
      </div>

      {/* MARKETS TAB */}
      {tab === "markets" && (
        <div className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            {/* Markets grid */}
            <div className="xl:col-span-3">
              <MarketsGrid
                onSelectMarket={setSelectedMarket}
                selectedMarket={selectedMarket}
                search={search}
                sort={sort}
                category={category}
                fromDate={fromDate}
                toDate={toDate}
                reloadKey={reloadKey}
              />
            </div>

            {/* Trade panel sidebar */}
            <div className="space-y-4">
              <TradePanel market={selectedMarket} />
              {!auth.authenticated && <AuthPanel />}
            </div>
          </div>
        </div>
      )}

      {/* COPY TRADE TAB */}
      {tab === "copy" && (
        <div className="p-4">
          <CopyTrading />
        </div>
      )}

      {/* PORTFOLIO TAB */}
      {tab === "portfolio" && (
        <div className="p-4 space-y-4">
          {!auth.authenticated ? (
            <div className="max-w-md mx-auto">
              <AuthPanel />
            </div>
          ) : (
            <>
              <PositionsTable />

              {/* API Info */}
              <div className="pixel-panel p-4">
                <div className="text-[7px] text-pixel-gray-light tracking-wider mb-3">
                  API CREDENTIALS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="pixel-panel p-3">
                    <div className="text-[5px] text-pixel-gray mb-1">API KEY</div>
                    <div className="text-[7px] text-pixel-cyan font-mono truncate">
                      {auth.clobCreds?.apiKey || "---"}
                    </div>
                  </div>
                  <div className="pixel-panel p-3">
                    <div className="text-[5px] text-pixel-gray mb-1">PASSPHRASE</div>
                    <div className="text-[7px] text-pixel-amber font-mono truncate">
                      {auth.clobCreds?.passphrase?.slice(0, 16)}...
                    </div>
                  </div>
                  <div className="pixel-panel p-3">
                    <div className="text-[5px] text-pixel-gray mb-1">SECRET</div>
                    <div className="text-[7px] text-pixel-red font-mono">
                      ••••••••••••
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mario-style Footer */}
      <footer className="border-t-2 border-pixel-white mx-4 mt-8 pt-4 pb-8">
        <div className="flex items-center justify-between text-[6px] text-pixel-gray">
          <div className="flex items-center gap-3">
            <span className="text-pixel-white glow-green">SUPER POLYMARKET BROS</span>
            <span className="text-pixel-border">|</span>
            <span>WORLD 1-1</span>
            <span className="text-pixel-border">|</span>
            <span>PREDICTION MARKETS</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mario mushroom pixel art */}
            <div className="flex flex-col gap-[1px]">
              <div className="flex gap-[1px]">
                <div className="w-1 h-1" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1" />
              </div>
              <div className="flex gap-[1px]">
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1" />
                <div className="w-1 h-1 bg-pixel-white" />
              </div>
              <div className="flex gap-[1px]">
                <div className="w-1 h-1" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1 bg-pixel-white" />
                <div className="w-1 h-1" />
              </div>
            </div>
            <span>1UP WITH MOD</span>
          </div>
        </div>

        {/* Mario ground pattern */}
        <div className="mt-3 mario-ground" />
      </footer>
    </div>
  );
}
