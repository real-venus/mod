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
  const color = tao >= 0 ? "text-positive" : "text-negative";
  const fontSize =
    size === "sm" ? "text-xs" : size === "lg" ? "text-lg font-bold" : "text-sm";

  return (
    <span className={`${color} ${fontSize} font-mono`}>
      {fmtPnl(tao)}{" "}
      <span className="opacity-70">({fmtPct(pct)})</span>
    </span>
  );
}
