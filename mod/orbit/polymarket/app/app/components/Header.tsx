"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useFilters, SortMode } from "../context/FiltersContext";
import { shortAddress } from "@/lib/auth";
import { CATEGORIES, CategorySlug } from "../lib/polymarket";

interface HeaderProps {
  showSearch?: boolean;
  showSort?: boolean;
  showCategories?: boolean;
  searchPlaceholder?: string;
}

export default function Header({
  showSearch = true,
  showSort = true,
  showCategories = true,
  searchPlaceholder = "SEARCH MARKETS...",
}: HeaderProps) {
  const {
    search, setSearch,
    sort, setSort,
    category, setCategory,
    reload,
  } = useFilters();
  const { auth, hasWallet, connect, disconnect, authenticate, error, loading } = useAuth();
  const [dateStr, setDateStr] = useState("----.--.--");
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    setDateStr(new Date().toISOString().split("T")[0]);
  }, []);


  return (
    <header className="border-b-2 border-pixel-border bg-pixel-black/90 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 border-2 border-pixel-white flex items-center justify-center bg-pixel-panel relative">
            <span className="text-pixel-white text-[13px] glow-green">P</span>
            <div className="absolute -top-[2px] -left-[2px] w-1 h-1 bg-pixel-white" />
            <div className="absolute -top-[2px] -right-[2px] w-1 h-1 bg-pixel-white" />
            <div className="absolute -bottom-[2px] -left-[2px] w-1 h-1 bg-pixel-black" />
            <div className="absolute -bottom-[2px] -right-[2px] w-1 h-1 bg-pixel-black" />
          </div>
          <div className="hidden md:flex flex-col gap-0.5">
            <span className="text-pixel-white text-[12px] glow-green tracking-wider">
              POLYMARKET
            </span>
            <span className="text-pixel-gray text-[8px] tracking-widest">
              TERMINAL
            </span>
          </div>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="flex-1 min-w-[140px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pixel-input w-full text-[10px] px-3 py-1.5"
            />
          </div>
        )}

        {/* CATEGORY — single-select dropdown right next to the search */}
        {showCategories && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategorySlug)}
            className="pixel-input text-[10px] px-2 py-1.5 shrink-0 w-[110px] cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        )}


        {/* SORT — dropdown (only on pages that need it) */}
        {showSort && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="pixel-input text-[10px] px-2 py-1.5 shrink-0 w-[110px] cursor-pointer"
            title="Sort markets"
          >
            <option value="volume">VOLUME</option>
            <option value="liquidity">LIQUIDITY</option>
            <option value="end_date_min">ENDING SOON</option>
          </select>
        )}

        {/* RELOAD */}
        {(showSort || showCategories || showSearch) && (
          <button
            onClick={reload}
            className="pixel-btn text-[9px] px-2 py-1.5 border-pixel-green text-pixel-green bg-pixel-green/10 shrink-0"
            title="Reload"
          >
            ↻
          </button>
        )}

        {/* Status */}
        <div className="hidden xl:flex items-center gap-3 text-[10px] text-pixel-gray-light shrink-0 ml-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-pixel-white animate-pulse" />
            <span className="text-pixel-white">ONLINE</span>
          </div>
          <span className="text-pixel-white glow-amber">{dateStr}</span>
        </div>

        {/* Wallet / Auth */}
        <div className="flex items-center gap-2 shrink-0 xl:ml-0 ml-auto">
          {auth.connected ? (
            <div className="flex items-center gap-2">
              {auth.authenticated ? (
                <div className="pixel-badge border-pixel-green text-pixel-green text-[9px] px-2 py-1">
                  API
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(!showAuth)}
                  className="pixel-btn border-pixel-amber text-pixel-amber text-[9px] px-2 py-1 bg-pixel-amber/10"
                >
                  {loading ? "..." : "KEY"}
                </button>
              )}
              <div className="pixel-panel px-2.5 py-1 flex items-center gap-1.5">
                <div className="w-2 h-2 bg-pixel-green" />
                <span className="text-pixel-green text-[10px] glow-green">
                  {shortAddress(auth.address || "")}
                </span>
                <button
                  onClick={disconnect}
                  className="text-pixel-gray hover:text-pixel-red transition-colors text-[11px]"
                >
                  X
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={loading}
              className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10 hover:bg-pixel-green/20 text-[10px]"
            >
              {loading ? "..." : hasWallet ? "CONNECT" : "INSTALL"}
            </button>
          )}
        </div>
      </div>

      {/* Auth Panel Dropdown */}
      {showAuth && auth.connected && !auth.authenticated && (
        <div className="border-t-2 border-pixel-border bg-pixel-panel px-4 py-5">
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-[12px] text-pixel-amber glow-amber text-center">
              SIGN MESSAGE TO DERIVE API CREDENTIALS
            </div>
            <div className="text-[10px] text-pixel-gray text-center leading-relaxed">
              THIS WILL SIGN AN EIP-712 MESSAGE WITH YOUR WALLET
              TO CREATE A BEARER TOKEN FOR THE POLYMARKET CLOB API
            </div>
            {error && (
              <div className="pixel-panel-red p-3 text-[10px] text-pixel-red text-center">
                {error}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={async () => {
                  await authenticate();
                  setShowAuth(false);
                }}
                disabled={loading}
                className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10"
              >
                {loading ? "SIGNING..." : "SIGN & DERIVE KEY"}
              </button>
              <button
                onClick={() => setShowAuth(false)}
                className="pixel-btn border-pixel-gray text-pixel-gray"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
