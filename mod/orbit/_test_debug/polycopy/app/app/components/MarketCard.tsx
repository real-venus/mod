"use client";

import { PolymarketMarket } from "../lib/types";

interface Props {
  market: PolymarketMarket;
}

export default function MarketCard({ market }: Props) {
  const yesPrice = market.outcomePrices[0] || 0;
  const noPrice = market.outcomePrices[1] || 1 - yesPrice;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);
  const vol = market.volume >= 1000000
    ? `$${(market.volume / 1000000).toFixed(1)}M`
    : market.volume >= 1000
    ? `$${(market.volume / 1000).toFixed(0)}K`
    : `$${market.volume.toFixed(0)}`;

  const endDate = market.endDate
    ? new Date(market.endDate).toLocaleDateString([], { month: "short", day: "numeric" })
    : "—";

  return (
    <div className="panel-glow bg-ibm-panel p-4 hover:bg-ibm-dark transition-all cursor-pointer">
      {/* Category + End Date */}
      <div className="flex items-center justify-between mb-2">
        {market.category && (
          <span className="text-[9px] px-1.5 py-0.5 border border-ibm-blue/30 text-ibm-blue tracking-wider uppercase">
            {market.category}
          </span>
        )}
        <span className="text-[9px] text-ibm-gray">{endDate}</span>
      </div>

      {/* Question */}
      <div className="text-ibm-white text-[11px] font-medium leading-snug mb-3 line-clamp-2 min-h-[2.5rem]">
        {market.question}
      </div>

      {/* YES / NO bars */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-ibm-green w-6">YES</span>
          <div className="flex-1 h-4 bg-ibm-black/50 relative overflow-hidden">
            <div
              className="h-full bg-ibm-green/30 transition-all"
              style={{ width: `${yesPct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-ibm-green font-medium">
              {yesPct}¢
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-ibm-red w-6">NO</span>
          <div className="flex-1 h-4 bg-ibm-black/50 relative overflow-hidden">
            <div
              className="h-full bg-ibm-red/20 transition-all"
              style={{ width: `${noPct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-ibm-red font-medium">
              {noPct}¢
            </span>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-[9px] text-ibm-gray-light pt-2 border-t border-ibm-border/20">
        <span>VOL {vol}</span>
        <span>LIQ ${(market.liquidity / 1000).toFixed(0)}K</span>
      </div>
    </div>
  );
}
