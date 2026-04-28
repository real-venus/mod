"use client";

import { PolymarketMarket } from "../lib/types";
import { formatVolume } from "../lib/polymarket";

interface Props {
  market: PolymarketMarket;
  onSelect?: (market: PolymarketMarket) => void;
  selected?: boolean;
}

export default function MarketCard({ market, onSelect, selected }: Props) {
  const yesPrice = market.outcomePrices[0] || 0;
  const noPrice = market.outcomePrices[1] || 1 - yesPrice;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  const endDate = market.endDate
    ? new Date(market.endDate).toLocaleDateString([], { month: "short", day: "numeric" })
    : "---";

  return (
    <div
      onClick={() => onSelect?.(market)}
      className={`pixel-panel p-3 cursor-pointer transition-all hover:border-pixel-green/60 ${
        selected ? "border-pixel-cyan !shadow-[0_0_0_1px_#00ffff44,inset_0_0_30px_#00ffff08]" : ""
      }`}
    >
      {/* Category + End Date */}
      <div className="flex items-center justify-between mb-2">
        {market.category && (
          <span className="pixel-badge border-pixel-blue text-pixel-blue">
            {market.category.toUpperCase().slice(0, 12)}
          </span>
        )}
        <span className="text-[6px] text-pixel-gray">{endDate}</span>
      </div>

      {/* Question */}
      <div className="text-pixel-white text-[7px] leading-relaxed mb-3 line-clamp-2 min-h-[2rem]">
        {market.question}
      </div>

      {/* YES / NO pixel bars - Mario power-up style */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[6px] text-pixel-white w-5">YES</span>
          <div className="pixel-bar flex-1">
            <div
              className="pixel-bar-fill bg-pixel-white/90"
              style={{ width: `${yesPct}%` }}
            />
          </div>
          <span className="text-[7px] text-pixel-white glow-green w-10 text-right font-mono">
            {yesPct}⭐
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[6px] text-pixel-gray w-5">NO</span>
          <div className="pixel-bar flex-1">
            <div
              className="pixel-bar-fill bg-pixel-gray/60"
              style={{ width: `${noPct}%` }}
            />
          </div>
          <span className="text-[7px] text-pixel-gray glow-red w-10 text-right font-mono">
            {noPct}⭐
          </span>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-[6px] text-pixel-gray-light pt-2 border-t border-pixel-border/40">
        <span className="sprite-coin">{formatVolume(market.volume)}</span>
        <span>LIQ {formatVolume(market.liquidity)}</span>
      </div>
    </div>
  );
}
