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
      className={`pixel-panel p-4 cursor-pointer transition-all group ${
        selected
          ? "border-pixel-white !shadow-[inset_3px_3px_0_#666,inset_-3px_-3px_0_#000,0_0_0_1px_#fff]"
          : "hover:border-pixel-gray-light"
      }`}
    >
      {/* Row layout: question | bars | stats */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Left: Question + Meta */}
        <div className="flex-1 min-w-0">
          <div className="text-pixel-white text-[12px] leading-relaxed mb-2 line-clamp-2">
            {market.question}
          </div>
          <div className="flex items-center gap-2">
            {market.category && (
              <span className="pixel-badge border-pixel-border text-pixel-gray-light">
                {market.category.toUpperCase().slice(0, 12)}
              </span>
            )}
            <span className="text-[9px] text-pixel-gray">{endDate}</span>
          </div>
        </div>

        {/* Center: YES / NO bars */}
        <div className="hidden sm:block w-48 md:w-64 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-pixel-gray-light w-7">YES</span>
            <div className="pixel-bar flex-1">
              <div
                className="pixel-bar-fill bg-pixel-white/80"
                style={{ width: `${yesPct}%` }}
              />
            </div>
            <span className="text-[11px] text-pixel-white w-10 text-right font-mono">
              {yesPct}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-pixel-gray w-7">NO</span>
            <div className="pixel-bar flex-1">
              <div
                className="pixel-bar-fill bg-pixel-gray/50"
                style={{ width: `${noPct}%` }}
              />
            </div>
            <span className="text-[11px] text-pixel-gray w-10 text-right font-mono">
              {noPct}%
            </span>
          </div>
        </div>

        {/* Mobile: compact percentage */}
        <div className="sm:hidden shrink-0 text-center">
          <div className="text-sm text-pixel-white font-mono">{yesPct}%</div>
          <div className="text-[9px] text-pixel-gray">YES</div>
        </div>

        {/* Right: Stats */}
        <div className="shrink-0 text-right space-y-1 min-w-[80px]">
          <div className="text-[11px] text-pixel-white sprite-coin">{formatVolume(market.volume)}</div>
          <div className="text-[9px] text-pixel-gray">LIQ {formatVolume(market.liquidity)}</div>
        </div>
      </div>
    </div>
  );
}
