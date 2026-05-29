"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/copy", label: "Copy" },
  { href: "/history", label: "History" },
];

export default function Header() {
  const path = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-accent no-underline">
            copytensor
          </Link>
          <nav className="flex gap-4">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`text-sm no-underline ${
                  path === n.href ? "text-white" : "text-muted hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <AccountSearch />
      </div>
    </header>
  );
}

function AccountSearch() {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const input = (e.target as HTMLFormElement).elements.namedItem(
          "ss58"
        ) as HTMLInputElement;
        const val = input.value.trim();
        if (val) window.location.href = `/account/${val}`;
      }}
    >
      <input
        name="ss58"
        placeholder="SS58 address..."
        className="w-64 text-sm"
      />
      <button type="submit" className="btn-primary text-sm">
        Lookup
      </button>
    </form>
  );
}
