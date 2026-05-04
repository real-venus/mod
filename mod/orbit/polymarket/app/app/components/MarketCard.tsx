"use client";

import { useRouter } from "next/navigation";
import { PolymarketMarket } from "../lib/types";
import { formatVolume } from "../lib/polymarket";

interface Props {
  market: PolymarketMarket;
  onSelect?: (market: PolymarketMarket) => void;
  selected?: boolean;
}

export default function MarketCard({ market, onSelect, selected }: Props) {
  const router = useRouter();
  const yesPrice = market.outcomePrices[0] || 0;
  const noPrice = market.outcomePrices[1] || 1 - yesPrice;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

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

  const isHighConviction = yesPct >= 80 || yesPct <= 20;

  return (
    <div
      onClick={handleClick}
      className={`market-card group cursor-pointer flex flex-col ${
        selected ? "market-card-selected" : ""
      }`}
    >
      {/* Top: category + end date */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] tracking-[2px] text-pixel-gray uppercase">
          {market.category ? market.category.slice(0, 14) : "\u00A0"}
        </span>
        <span className="text-[9px] text-pixel-gray font-mono">{endDate}</span>
      </div>

      {/* Question — flex-1 so cards align */}
      <div className="text-[12px] text-pixel-white leading-[1.7] mb-4 line-clamp-3 flex-1">
        {market.question}
      </div>

      {/* Probability bar */}
      <div className="mb-3">
        <div className="relative h-[36px] w-full bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden">
          {/* YES fill */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${yesPct}%`,
              background: "linear-gradient(90deg, rgba(74, 222, 128, 0.3) 0%, rgba(74, 222, 128, 0.1) 100%)",
            }}
          />
          {/* NO fill (from right) */}
          <div
            className="absolute inset-y-0 right-0 transition-all duration-500"
            style={{
              width: `${noPct}%`,
              background: "linear-gradient(270deg, rgba(248, 113, 113, 0.15) 0%, transparent 100%)",
            }}
          />
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono" style={{ color: "#4ade80" }}>YES</span>
              <span className="text-[14px] font-mono" style={{
                color: yesPct >= 50 ? "#4ade80" : "#555",
              }}>
                {yesPct}¢
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-mono" style={{
                color: noPct >= 50 ? "#f87171" : "#555",
              }}>
                {noPct}¢
              </span>
              <span className="text-[10px] font-mono" style={{ color: "#f87171" }}>NO</span>
            </div>
          </div>
        </div>

        {/* Conviction indicator */}
        {isHighConviction && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5" style={{
              background: yesPct >= 80 ? "#4ade80" : "#f87171",
            }} />
            <span className="text-[8px] tracking-wider" style={{
              color: yesPct >= 80 ? "#4ade80" : "#f87171",
            }}>
              {yesPct >= 80 ? "HIGH YES" : "HIGH NO"}
            </span>
          </div>
        )}
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between pt-3 border-t border-[#1e1e1e]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-pixel-gray tracking-wider">VOL</span>
            <span className="text-[10px] text-pixel-white font-mono">{formatVolume(market.volume)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-pixel-gray tracking-wider">LIQ</span>
            <span className="text-[10px] text-pixel-gray-light font-mono">{formatVolume(market.liquidity)}</span>
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
