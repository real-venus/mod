"use client";

import { fmtPct, fmtPnl } from "../lib/api";

export default function PnlBadge({
  tao,
  pct,
  size = "md",
}: {
  tao: number;
  pct: number;
  size?: "sm" | "md" | "lg";
}) {
  const positive = tao >= 0;
  const color = positive ? "text-green-400" : "text-red-400";
  const fontSize =
    size === "sm" ? "text-[11px]" :
    size === "lg" ? "text-lg font-bold" :
    "text-[13px]";

  return (
    <span className={`${color} ${fontSize} font-mono tabular-nums whitespace-nowrap`}>
      {fmtPnl(tao)}
      <span className="opacity-60 ml-1">({fmtPct(pct)})</span>
    </span>
  );
}
