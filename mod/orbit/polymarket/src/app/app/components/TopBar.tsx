"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useFilters, useFilterParams } from "../context/FiltersContext";
import { shortAddress } from "@/lib/auth";

const TABS = [
  { href: "/markets", label: "MARKETS" },
  { href: "/traders", label: "TRADERS" },
  { href: "/strats", label: "STRATS" },
];

interface TopBarProps {
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export default function TopBar({
  showSearch = true,
  searchPlaceholder = "SEARCH...",
}: TopBarProps) {
  const pathname = usePathname() || "";
  const { search, setSearch } = useFilters();
  const { auth, hasWallet, connect, disconnect, authenticate, loading } = useAuth();
  const filterQs = useFilterParams();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const tabHref = (base: string) => {
    if ((base === "/traders" || base === "/strats") && filterQs)
      return `${base}?${filterQs}`;
    return base;
  };

  return (
    <header className="border-b-2 border-pixel-border bg-pixel-black/90 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 h-12 flex items-center gap-0">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0 mr-3" title="POLYMARKET">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-pixel-white">
            <path d="M12 2L22 12L12 22L2 12Z" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.15"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
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

        {/* Search — always visible, prominent */}
        {showSearch && (
          <div className="flex-1 flex items-center ml-4 max-w-[480px]">
            <div className="relative w-full">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-pixel-gray pointer-events-none">
                /
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pixel-input-sm w-full pl-6 pr-3 font-mono text-[10px]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-pixel-gray hover:text-pixel-white"
                >
                  x
                </button>
              )}
            </div>
          </div>
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
