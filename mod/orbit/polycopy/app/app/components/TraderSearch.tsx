"use client";

import { useState } from "react";

export type SortField = "trades" | "pnl" | "winRate" | "volume" | "drawdown";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortField: SortField;
  onSortChange: (f: SortField) => void;
  resultCount: number;
  totalCount: number;
}

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "trades", label: "TRADES" },
  { field: "pnl", label: "P&L" },
  { field: "winRate", label: "WIN%" },
  { field: "volume", label: "VOLUME" },
  { field: "drawdown", label: "DD" },
];

export default function TraderSearch({
  searchQuery,
  onSearchChange,
  sortField,
  onSortChange,
  resultCount,
  totalCount,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="panel-glow bg-ibm-panel p-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Search input */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ibm-gray">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="SEARCH TRADERS BY ADDRESS..."
            className={`w-full bg-ibm-black/50 border px-8 py-2 text-[11px] text-ibm-green font-mono placeholder:text-ibm-gray focus:outline-none transition-colors ${
              focused
                ? "border-ibm-green/40"
                : "border-ibm-border/40"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ibm-gray hover:text-ibm-white transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-ibm-gray tracking-wider mr-1">SORT:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.field}
              onClick={() => onSortChange(opt.field)}
              className={`px-2 py-1.5 text-[10px] tracking-wider transition-colors border ${
                sortField === opt.field
                  ? "bg-ibm-green/15 text-ibm-green border-ibm-green/40"
                  : "text-ibm-gray-light hover:text-ibm-white border-transparent hover:border-ibm-border/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="text-[10px] text-ibm-gray font-mono">
          {resultCount === totalCount
            ? `${totalCount} TRADERS`
            : `${resultCount}/${totalCount}`
          }
        </div>
      </div>
    </div>
  );
}
