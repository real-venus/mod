"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useFilters, useFilterParams, SortMode } from "../context/FiltersContext";
import { shortAddress } from "@/lib/auth";

const TABS = [
  { href: "/markets", label: "MARKETS" },
  { href: "/traders", label: "TRADERS" },
  { href: "/portfolio", label: "PORTFOLIO" },
];

interface TopBarProps {
  showSearch?: boolean;
  showSort?: boolean;
  searchPlaceholder?: string;
}

export default function TopBar({
  showSearch = false,
  showSort = false,
  searchPlaceholder = "SEARCH...",
}: TopBarProps) {
  const pathname = usePathname() || "";
  const { search, setSearch, sort, setSort, reload } = useFilters();
  const { auth, hasWallet, connect, disconnect, authenticate, loading } = useAuth();
  const filterQs = useFilterParams();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const tabHref = (base: string) => {
    if ((base === "/traders" || base === "/portfolio") && filterQs)
      return `${base}?${filterQs}`;
    return base;
  };

  return (
    <header className="border-b-2 border-pixel-border bg-pixel-black/90 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 h-12 flex items-center gap-0">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-3">
          <div className="w-7 h-7 border-2 border-pixel-white flex items-center justify-center bg-pixel-panel relative">
            <span className="text-pixel-white text-[10px]">P</span>
          </div>
          <span className="hidden sm:inline text-pixel-white text-[11px] tracking-wider">
            POLYMARKET
          </span>
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={tabHref(t.href)}
                className={`px-3 py-3 text-[11px] tracking-widest border-b-2 transition-all ${
                  active
                    ? "text-pixel-white border-pixel-white"
                    : "text-pixel-gray border-transparent hover:text-pixel-white hover:border-pixel-border"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="w-4" />

        {/* Search */}
        {showSearch && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pixel-input-sm flex-1 min-w-[120px] max-w-[320px] font-mono text-[9px]"
          />
        )}

        {/* Sort */}
        {showSort && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="pixel-input-sm text-[9px] ml-2 w-[100px] cursor-pointer shrink-0"
          >
            <option value="volume">VOLUME</option>
            <option value="liquidity">LIQUIDITY</option>
            <option value="end_date_min">ENDING</option>
          </select>
        )}

        {/* Reload */}
        {(showSearch || showSort) && (
          <button
            onClick={reload}
            className="pixel-btn text-[9px] px-1.5 py-1 border-pixel-border text-pixel-gray hover:text-pixel-green hover:border-pixel-green ml-1.5 shrink-0"
            title="Reload"
          >
            ↻
          </button>
        )}

        {/* Right side: wallet */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {auth.connected ? (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <div className={`w-1.5 h-1.5 ${auth.authenticated ? "bg-green-400" : "bg-amber-400"}`} />
              <span className={`text-[9px] font-mono ${auth.authenticated ? "text-green-400" : "text-amber-400"}`}>
                {shortAddress(auth.address || "")}
              </span>
              {!auth.authenticated && (
                <button
                  onClick={authenticate}
                  disabled={loading}
                  className="text-[8px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {loading ? "..." : "[SIGN]"}
                </button>
              )}
              <button
                onClick={disconnect}
                className="text-pixel-gray hover:text-red-400 transition-colors text-[9px] ml-0.5"
                title="Disconnect"
              >
                x
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={loading}
              className="pixel-btn text-[9px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-green hover:border-pixel-green"
            >
              {loading ? "..." : hasWallet ? "CONNECT" : "INSTALL"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
