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
  fromDate: string;
  onFromDateChange: (v: string) => void;
  toDate: string;
  onToDateChange: (v: string) => void;
  onReload: () => void;
  showFilters?: boolean;
}

export default function Header({
  search, onSearchChange,
  sort, onSortChange,
  category, onCategoryChange,
  fromDate, onFromDateChange,
  toDate, onToDateChange,
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
      <div className="max-w-[1920px] mx-auto px-4 h-12 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 border-2 border-pixel-white flex items-center justify-center bg-pixel-panel relative">
            <span className="text-pixel-white text-[10px] glow-green">?</span>
            <div className="absolute -top-[2px] -left-[2px] w-1 h-1 bg-pixel-white" />
            <div className="absolute -top-[2px] -right-[2px] w-1 h-1 bg-pixel-white" />
            <div className="absolute -bottom-[2px] -left-[2px] w-1 h-1 bg-pixel-black" />
            <div className="absolute -bottom-[2px] -right-[2px] w-1 h-1 bg-pixel-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-pixel-white text-[9px] glow-green tracking-wider leading-tight">
              SUPER POLYMARKET
            </span>
            <span className="text-pixel-gray text-[5px] tracking-widest leading-tight">
              BROS TRADING TERMINAL
            </span>
          </div>
        </div>

        {/* FROM / TO date filters */}
        {showFilters && (
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[6px] text-pixel-gray tracking-wider">FROM</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                className="pixel-input text-[7px] px-1.5 py-0.5 w-[105px] bg-pixel-bg border-pixel-border"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[6px] text-pixel-gray tracking-wider">TO</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                className="pixel-input text-[7px] px-1.5 py-0.5 w-[105px] bg-pixel-bg border-pixel-border"
              />
            </div>
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
              className="pixel-input w-full text-[7px] px-2 py-1"
            />
          </div>
        )}

        {/* Status */}
        <div className="hidden lg:flex items-center gap-3 text-[6px] text-pixel-gray-light shrink-0">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-pixel-white animate-pulse" />
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
            <div className="flex items-center gap-1.5">
              {auth.authenticated ? (
                <div className="pixel-badge border-pixel-green text-pixel-green text-[5px] px-1.5 py-0.5">
                  API
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(!showAuth)}
                  className="pixel-btn border-pixel-amber text-pixel-amber text-[6px] px-1.5 py-0.5 bg-pixel-amber/10"
                >
                  {loading ? "..." : "KEY"}
                </button>
              )}
              <div className="pixel-panel px-2 py-1 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-pixel-green" />
                <span className="text-pixel-green text-[6px] glow-green">
                  {shortAddress(auth.address || "")}
                </span>
                <button
                  onClick={disconnect}
                  className="text-pixel-gray hover:text-pixel-red transition-colors text-[7px]"
                >
                  X
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={loading}
              className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10 hover:bg-pixel-green/20 text-[6px]"
            >
              {loading ? "..." : hasWallet ? "CONNECT" : "INSTALL"}
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Sort + Categories + Reload */}
      {showFilters && <div className="max-w-[1920px] mx-auto px-4 py-1 flex items-center gap-1.5 border-t border-pixel-border/50 overflow-x-auto">
        {/* Sort buttons */}
        {(["volume", "liquidity", "end_date_min"] as SortMode[]).map((s) => (
          <button
            key={s}
            onClick={() => onSortChange(s)}
            className={`pixel-btn text-[5px] px-1.5 py-0.5 shrink-0 ${
              sort === s
                ? "border-pixel-cyan text-pixel-cyan bg-pixel-cyan/10"
                : "border-pixel-border text-pixel-gray hover:text-pixel-white"
            }`}
          >
            {s === "end_date_min" ? "ENDING" : s.toUpperCase()}
          </button>
        ))}

        <span className="text-pixel-border text-[6px] shrink-0">|</span>

        {/* Category filters */}
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onCategoryChange(cat.slug)}
            className={`pixel-btn text-[5px] px-1.5 py-0.5 shrink-0 ${
              category === cat.slug
                ? "border-pixel-amber text-pixel-amber bg-pixel-amber/10"
                : "border-pixel-border text-pixel-gray hover:text-pixel-white"
            }`}
          >
            {cat.label}
          </button>
        ))}

        <span className="text-pixel-border text-[6px] shrink-0">|</span>

        <button
          onClick={onReload}
          className="pixel-btn text-[5px] px-1.5 py-0.5 border-pixel-green text-pixel-green bg-pixel-green/10 shrink-0"
        >
          RELOAD
        </button>
      </div>}

      {/* Auth Panel Dropdown */}
      {showAuth && auth.connected && !auth.authenticated && (
        <div className="border-t-2 border-pixel-border bg-pixel-panel px-4 py-4">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-[8px] text-pixel-amber glow-amber text-center">
              SIGN MESSAGE TO DERIVE API CREDENTIALS
            </div>
            <div className="text-[7px] text-pixel-gray text-center">
              THIS WILL SIGN AN EIP-712 MESSAGE WITH YOUR WALLET
              TO CREATE A BEARER TOKEN FOR THE POLYMARKET CLOB API
            </div>
            {error && (
              <div className="pixel-panel-red p-2 text-[7px] text-pixel-red text-center">
                {error}
              </div>
            )}
            <div className="flex justify-center gap-2">
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
