"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PolymarketMarket } from "../lib/types";
import { formatVolume } from "../lib/polymarket";

interface Props {
  market: PolymarketMarket;
  onSelect?: (market: PolymarketMarket) => void;
  selected?: boolean;
}

type Flash = "" | "up" | "down";

export default function MarketCard({ market, onSelect, selected }: Props) {
  const router = useRouter();
  const [hoveredOutcome, setHoveredOutcome] = useState<number | null>(null);

  const outcomes = market.outcomes || ["Yes", "No"];
  const prices = market.outcomePrices || [0.5, 0.5];
  const yesPrice = prices[0] || 0;
  const noPrice = prices[1] || 1 - yesPrice;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  // Detect price changes between renders and briefly flash the price chip.
  const prevYesRef = useRef<number>(yesPrice);
  const [flash, setFlash] = useState<Flash>("");
  useEffect(() => {
    const prev = prevYesRef.current;
    if (yesPrice !== prev) {
      const dir: Flash = yesPrice > prev ? "up" : "down";
      setFlash(dir);
      prevYesRef.current = yesPrice;
      const t = setTimeout(() => setFlash(""), 700);
      return () => clearTimeout(t);
    }
  }, [yesPrice]);

  const flashShadow =
    flash === "up"   ? "0 0 0 1px rgba(74,222,128,0.6), 0 0 14px rgba(74,222,128,0.45)" :
    flash === "down" ? "0 0 0 1px rgba(248,113,113,0.6), 0 0 14px rgba(248,113,113,0.45)" :
    "none";

  const endDate = market.endDate
    ? new Date(market.endDate).toLocaleDateString([], { month: "short", day: "numeric" })
    : "---";

  const handleClick = () => {
    if (onSelect) {
      onSelect(market);
    } else if (market.slug) {
      router.push(`/markets/${market.slug}`);
    }
  };

  const handleOutcomeClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    // Navigate to market detail with the selected outcome pre-highlighted
    if (market.slug) {
      router.push(`/markets/${market.slug}?side=${outcomes[idx]?.toLowerCase() || "yes"}`);
    }
  };

  const isHighConviction = yesPct >= 80 || yesPct <= 20;
  const isBinary = outcomes.length === 2;

  return (
    <div
      onClick={handleClick}
      className={`market-card group cursor-pointer flex flex-col ${
        selected ? "market-card-selected" : ""
      }`}
    >
      {/* Top: category + end date */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] tracking-[2px] text-pixel-gray uppercase">
          {market.category ? market.category.slice(0, 14) : "\u00A0"}
        </span>
        <span className="text-[11px] text-pixel-gray font-mono">{endDate}</span>
      </div>

      {/* Question — flex-1 so cards align */}
      <div className="text-[14px] text-pixel-white leading-[1.7] mb-4 line-clamp-3 flex-1">
        {market.question}
      </div>

      {/* Outcome buttons — clickable options */}
      {isBinary ? (
        <div className="mb-3 space-y-1.5">
          {/* YES / NO probability bar */}
          <div
            className="relative h-[36px] w-full bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden"
            style={{ boxShadow: flashShadow, transition: "box-shadow 0.7s ease-out" }}
          >
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{
                width: `${yesPct}%`,
                background: "linear-gradient(90deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)",
              }}
            />
            <div
              className="absolute inset-y-0 right-0 transition-all duration-500"
              style={{
                width: `${noPct}%`,
                background: "linear-gradient(270deg, rgba(248, 113, 113, 0.15) 0%, transparent 100%)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono" style={{ color: "#4ade80" }}>YES</span>
                <span className="text-[16px] font-mono" style={{
                  color: yesPct >= 50 ? "#4ade80" : "#555",
                }}>
                  {yesPct}¢
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-mono" style={{
                  color: noPct >= 50 ? "#f87171" : "#555",
                }}>
                  {noPct}¢
                </span>
                <span className="text-[12px] font-mono" style={{ color: "#f87171" }}>NO</span>
              </div>
            </div>
          </div>

          {/* Quick-buy buttons — visible on hover */}
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => handleOutcomeClick(e, 0)}
              onMouseEnter={() => setHoveredOutcome(0)}
              onMouseLeave={() => setHoveredOutcome(null)}
              className={`flex-1 py-1.5 text-[11px] font-mono border transition-all ${
                hoveredOutcome === 0
                  ? "border-green-400 text-green-400 bg-green-400/10"
                  : "border-[#2a2a2a] text-pixel-gray hover:border-green-400 hover:text-green-400"
              }`}
            >
              BUY YES {yesPct}¢
            </button>
            <button
              onClick={(e) => handleOutcomeClick(e, 1)}
              onMouseEnter={() => setHoveredOutcome(1)}
              onMouseLeave={() => setHoveredOutcome(null)}
              className={`flex-1 py-1.5 text-[11px] font-mono border transition-all ${
                hoveredOutcome === 1
                  ? "border-red-400 text-red-400 bg-red-400/10"
                  : "border-[#2a2a2a] text-pixel-gray hover:border-red-400 hover:text-red-400"
              }`}
            >
              BUY NO {noPct}¢
            </button>
          </div>

          {/* Conviction indicator */}
          {isHighConviction && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5" style={{
                background: yesPct >= 80 ? "#4ade80" : "#f87171",
              }} />
              <span className="text-[10px] tracking-wider" style={{
                color: yesPct >= 80 ? "#4ade80" : "#f87171",
              }}>
                {yesPct >= 80 ? "HIGH YES" : "HIGH NO"}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Multi-outcome: list each option with price */
        <div className="mb-3 space-y-1">
          {outcomes.map((outcome, i) => {
            const px = prices[i] ?? 0;
            const pct = Math.round(px * 100);
            return (
              <button
                key={outcome + i}
                onClick={(e) => handleOutcomeClick(e, i)}
                onMouseEnter={() => setHoveredOutcome(i)}
                onMouseLeave={() => setHoveredOutcome(null)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-mono border transition-all ${
                  hoveredOutcome === i
                    ? "border-pixel-white text-pixel-white bg-pixel-white/10"
                    : "border-[#1e1e1e] text-pixel-gray hover:border-pixel-white/40 hover:text-pixel-white"
                }`}
              >
                <span className="truncate mr-2">{outcome}</span>
                <span className="shrink-0">{pct}¢</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom stats */}
      <div className="flex items-center justify-between pt-3 border-t border-[#1e1e1e]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-pixel-gray tracking-wider">VOL</span>
            <span className="text-[12px] text-pixel-white font-mono">{formatVolume(market.volume)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-pixel-gray tracking-wider">LIQ</span>
            <span className="text-[12px] text-pixel-gray-light font-mono">{formatVolume(market.liquidity)}</span>
          </div>
        </div>
        {market.image && (
          <div className="w-6 h-6 border border-[#2a2a2a] overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
            <img src={market.image} alt="" className="w-full h-full object-cover" style={{ imageRendering: "auto" }} />
          </div>
        )}
      </div>
    </div>
  );
}
