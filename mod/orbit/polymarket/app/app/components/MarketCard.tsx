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
      className={`market-card group cursor-pointer ${
        selected ? "market-card-selected" : ""
      }`}
    >
      {/* Top section: category + end date */}
      <div className="flex items-center justify-between mb-3">
        {market.category && (
          <span className="text-[8px] tracking-[2px] text-pixel-gray-light uppercase">
            {market.category.slice(0, 14)}
          </span>
        )}
        <span className="text-[8px] text-pixel-gray font-mono ml-auto">{endDate}</span>
      </div>

      {/* Question */}
      <div className="text-[11px] text-pixel-white leading-[1.6] mb-4 line-clamp-3 min-h-[52px]">
        {market.question}
      </div>

      {/* Price display - hero section */}
      <div className="mb-3">
        {/* Full-width probability bar */}
        <div className="relative h-[32px] w-full bg-black/60 border border-[#333] overflow-hidden">
          {/* YES fill */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${yesPct}%`,
              background: `linear-gradient(90deg, rgba(74, 222, 128, 0.35) 0%, rgba(74, 222, 128, 0.15) 100%)`,
            }}
          />
          {/* Labels inside the bar */}
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono" style={{ color: "#4ade80" }}>YES</span>
              <span className="text-[13px] font-mono font-bold" style={{
                color: yesPct >= 50 ? "#4ade80" : "#888",
              }}>
                {yesPct}¢
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-bold" style={{
                color: noPct >= 50 ? "#f87171" : "#888",
              }}>
                {noPct}¢
              </span>
              <span className="text-[9px] font-mono" style={{ color: "#f87171" }}>NO</span>
            </div>
          </div>
        </div>

        {/* Conviction indicator */}
        {isHighConviction && (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="w-1.5 h-1.5" style={{
              background: yesPct >= 80 ? "#4ade80" : "#f87171",
            }} />
            <span className="text-[7px] tracking-wider" style={{
              color: yesPct >= 80 ? "#4ade80" : "#f87171",
            }}>
              {yesPct >= 80 ? "HIGH YES" : "HIGH NO"}
            </span>
          </div>
        )}
      </div>

      {/* Bottom stats row */}
      <div className="flex items-center justify-between pt-2 border-t border-[#222]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[7px] text-pixel-gray tracking-wider">VOL</span>
            <span className="text-[9px] text-pixel-white font-mono">{formatVolume(market.volume)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[7px] text-pixel-gray tracking-wider">LIQ</span>
            <span className="text-[9px] text-pixel-gray-light font-mono">{formatVolume(market.liquidity)}</span>
          </div>
        </div>
        {market.image && (
          <div className="w-5 h-5 border border-[#333] overflow-hidden opacity-60 group-hover:opacity-100 transition-opacity">
            <img src={market.image} alt="" className="w-full h-full object-cover" style={{ imageRendering: "auto" }} />
          </div>
        )}
      </div>
    </div>
  );
}
