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
  const [daysAgo, setDaysAgo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const tradersDaysOptions = [
    { label: "1D", value: "1" },
    { label: "7D", value: "7" },
    { label: "14D", value: "14" },
    { label: "30D", value: "30" },
  ];

  // The days filter is shared across markets and traders tabs, but
  // each tab has its own valid set of values. Coerce on tab switch.
  const tradersDaysAgo = daysAgo && daysAgo !== "" ? daysAgo : "7";

  const tabs: { id: Tab; label: string; icon: string; color: string }[] = [
    { id: "markets", label: "MARKETS", icon: "M", color: "white" },
    { id: "copy", label: "TRADERS", icon: "T", color: "white" },
    { id: "portfolio", label: "PORTFOLIO", icon: "P", color: "white" },
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
        daysAgo={tab === "copy" ? tradersDaysAgo : daysAgo}
        onDaysAgoChange={setDaysAgo}
        onReload={() => setReloadKey((k) => k + 1)}
        showFilters={tab === "markets" || tab === "copy"}
        showSort={tab === "markets"}
        showDaysFilter={tab === "markets" || tab === "copy"}
        daysOptions={tab === "copy" ? tradersDaysOptions : undefined}
        searchPlaceholder={tab === "copy" ? "SEARCH BY ADDRESS..." : "SEARCH MARKETS..."}
      />

      {/* Tab Navigation */}
      <div className="border-b-2 border-pixel-border bg-pixel-black/50 px-4">
        <div className="flex items-center gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 flex items-center gap-2.5 border-b-2 transition-all ${
                tab === t.id
                  ? "text-pixel-white border-pixel-white bg-pixel-panel"
                  : "text-pixel-gray border-transparent hover:text-pixel-white hover:border-pixel-border"
              }`}
            >
              <div
                className={`w-5 h-5 border flex items-center justify-center text-[9px] ${
                  tab === t.id
                    ? "border-pixel-white text-pixel-white"
                    : "border-pixel-border text-pixel-gray"
                }`}
              >
                {t.icon}
              </div>
              <span className="text-[11px] tracking-widest">{t.label}</span>
            </button>
          ))}

          {/* Right side status */}
          <div className="ml-auto flex items-center gap-3 text-[10px]">
            {auth.authenticated && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-pixel-green animate-pulse" />
                <span className="text-pixel-green">API LIVE</span>
              </div>
            )}
            <span className="text-pixel-gray">POLYGON CLOB v1</span>
          </div>
        </div>
      </div>

      {/* MARKETS TAB */}
      {tab === "markets" && (
        <div className="p-4 space-y-4">
          {/* Trade panel (shown when market selected) */}
          {selectedMarket && (
            <div className="max-w-2xl mx-auto">
              <TradePanel market={selectedMarket} />
            </div>
          )}
          <MarketsGrid
            onSelectMarket={setSelectedMarket}
            selectedMarket={selectedMarket}
            search={search}
            sort={sort}
            category={category}
            daysAgo={daysAgo}
            reloadKey={reloadKey}
          />
        </div>
      )}

      {/* COPY TRADE TAB */}
      {tab === "copy" && (
        <div className="p-4">
          <CopyTrading
            days={Number(tradersDaysAgo)}
            reloadKey={reloadKey}
            search={search}
            category={category}
          />
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
              <div className="pixel-panel p-5">
                <div className="text-[11px] text-pixel-gray-light tracking-wider mb-4">
                  API CREDENTIALS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="pixel-panel p-4">
                    <div className="text-[9px] text-pixel-gray mb-1.5">API KEY</div>
                    <div className="text-[11px] text-pixel-cyan font-mono truncate">
                      {auth.clobCreds?.apiKey || "---"}
                    </div>
                  </div>
                  <div className="pixel-panel p-4">
                    <div className="text-[9px] text-pixel-gray mb-1.5">PASSPHRASE</div>
                    <div className="text-[11px] text-pixel-amber font-mono truncate">
                      {auth.clobCreds?.passphrase?.slice(0, 16)}...
                    </div>
                  </div>
                  <div className="pixel-panel p-4">
                    <div className="text-[9px] text-pixel-gray mb-1.5">SECRET</div>
                    <div className="text-[11px] text-pixel-red font-mono">
                      ••••••••••••
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t-2 border-pixel-border mx-4 mt-8 pt-4 pb-8">
        <div className="flex items-center justify-between text-[10px] text-pixel-gray">
          <div className="flex items-center gap-4">
            <span className="text-pixel-white">POLYMARKET</span>
            <div className="w-[2px] h-3 bg-pixel-border" />
            <span>PREDICTION MARKETS</span>
            <div className="w-[2px] h-3 bg-pixel-border" />
            <span>POLYGON</span>
          </div>
          <div className="flex items-center gap-2">
            <span>POWERED BY MOD</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
