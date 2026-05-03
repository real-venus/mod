"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { href: "/markets", label: "MARKETS", icon: "M" },
  { href: "/traders", label: "TRADERS", icon: "T" },
  { href: "/portfolio", label: "PORTFOLIO", icon: "P" },
];

export default function NavTabs() {
  const pathname = usePathname() || "";
  const { auth } = useAuth();

  // A pathname is "active" for a tab if it matches the tab href or starts
  // with the tab href + "/" (e.g. /traders/0xabc activates the TRADERS tab).
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="border-b-2 border-pixel-border bg-pixel-black/50 px-4">
      <div className="flex items-center gap-0">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-5 py-3 flex items-center gap-2.5 border-b-2 transition-all ${
                active
                  ? "text-pixel-white border-pixel-white bg-pixel-panel"
                  : "text-pixel-gray border-transparent hover:text-pixel-white hover:border-pixel-border"
              }`}
            >
              <div
                className={`w-5 h-5 border flex items-center justify-center text-[9px] ${
                  active
                    ? "border-pixel-white text-pixel-white"
                    : "border-pixel-border text-pixel-gray"
                }`}
              >
                {t.icon}
              </div>
              <span className="text-[11px] tracking-widest">{t.label}</span>
            </Link>
          );
        })}

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
  );
}
