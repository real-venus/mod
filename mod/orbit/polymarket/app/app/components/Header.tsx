"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { shortAddress } from "../lib/auth";
import { CATEGORIES, CategorySlug } from "../lib/polymarket";

type SortMode = "volume" | "liquidity" | "end_date_min";

interface HeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  sort: SortMode;
  onSortChange: (v: SortMode) => void;
  category: CategorySlug;
  onCategoryChange: (v: CategorySlug) => void;
  daysAgo: string;
  onDaysAgoChange: (v: string) => void;
  onReload: () => void;
  showFilters?: boolean;
}

export default function Header({
  search, onSearchChange,
  sort, onSortChange,
  category, onCategoryChange,
  daysAgo, onDaysAgoChange,
  onReload,
  showFilters = true,
}: HeaderProps) {
  const { auth, hasWallet, connect, disconnect, authenticate, error, loading } = useAuth();
  const [dateStr, setDateStr] = useState("----.--.--");
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    setDateStr(new Date().toISOString().split("T")[0]);
  }, []);

  return (
    <header className="border-b-2 border-pixel-border bg-pixel-black/90 sticky top-0 z-50">
      {/* Row 1: Logo + FROM/TO + Status + Wallet */}
      <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 border-2 border-pixel-white flex items-center justify-center bg-pixel-panel relative">
            <span className="text-pixel-white text-[13px] glow-green">P</span>
            <div className="absolute -top-[2px] -left-[2px] w-1 h-1 bg-pixel-white" />
            <div className="absolute -top-[2px] -right-[2px] w-1 h-1 bg-pixel-white" />
            <div className="absolute -bottom-[2px] -left-[2px] w-1 h-1 bg-pixel-black" />
            <div className="absolute -bottom-[2px] -right-[2px] w-1 h-1 bg-pixel-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-pixel-white text-[13px] glow-green tracking-wider leading-tight">
              POLYMARKET
            </span>
            <span className="text-pixel-gray text-[8px] tracking-widest leading-tight">
              TRADING TERMINAL
            </span>
          </div>
        </div>

        {/* Time range filter */}
        {showFilters && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {[
              { label: "CURRENT", value: "" },
              { label: "7D", value: "7" },
              { label: "14D", value: "14" },
              { label: "30D", value: "30" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onDaysAgoChange(opt.value)}
                className={`pixel-btn text-[9px] px-2 py-1 ${
                  daysAgo === opt.value
                    ? "border-pixel-green text-pixel-green bg-pixel-green/10"
                    : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        {showFilters && (
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="SEARCH MARKETS..."
              className="pixel-input w-full text-[10px] px-3 py-1.5"
            />
          </div>
        )}

        {/* Status */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] text-pixel-gray-light shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-pixel-white animate-pulse" />
            <span className="text-pixel-white">ONLINE</span>
          </div>
          <span className="text-pixel-border">|</span>
          <span className="text-pixel-white glow-amber">{dateStr}</span>
          <span className="text-pixel-border">|</span>
          <span>POLYGON</span>
        </div>

        {/* Wallet / Auth */}
        <div className="flex items-center gap-2 shrink-0">
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
              <div className="pixel-panel px-3 py-1.5 flex items-center gap-2">
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

      {/* Row 2: Sort + Categories + Reload */}
      {showFilters && <div className="max-w-[1920px] mx-auto px-4 py-1.5 flex items-center gap-2 border-t border-pixel-border/50 overflow-x-auto">
        {/* Sort buttons */}
        {(["volume", "liquidity", "end_date_min"] as SortMode[]).map((s) => (
          <button
            key={s}
            onClick={() => onSortChange(s)}
            className={`pixel-btn text-[9px] px-2.5 py-1 shrink-0 ${
              sort === s
                ? "border-pixel-cyan text-pixel-cyan bg-pixel-cyan/10"
                : "border-pixel-border text-pixel-gray hover:text-pixel-white"
            }`}
          >
            {s === "end_date_min" ? "ENDING" : s.toUpperCase()}
          </button>
        ))}

        <span className="text-pixel-border text-[10px] shrink-0">|</span>

        {/* Category filters */}
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onCategoryChange(cat.slug)}
            className={`pixel-btn text-[9px] px-2.5 py-1 shrink-0 ${
              category === cat.slug
                ? "border-pixel-amber text-pixel-amber bg-pixel-amber/10"
                : "border-pixel-border text-pixel-gray hover:text-pixel-white"
            }`}
          >
            {cat.label}
          </button>
        ))}

        <span className="text-pixel-border text-[10px] shrink-0">|</span>

        <button
          onClick={onReload}
          className="pixel-btn text-[9px] px-2.5 py-1 border-pixel-green text-pixel-green bg-pixel-green/10 shrink-0"
        >
          RELOAD
        </button>
      </div>}

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
