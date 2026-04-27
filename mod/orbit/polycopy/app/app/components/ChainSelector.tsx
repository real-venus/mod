"use client";

import { CHAINS, SUPPORTED_CHAIN_IDS } from "../lib/chains";

interface Props {
  selected: number | null;
  onSelect: (chainId: number | null) => void;
}

export default function ChainSelector({ selected, onSelect }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSelect(null)}
        className={`px-2 py-1 text-[10px] tracking-wider transition-colors ${
          selected === null
            ? "bg-ibm-green/20 text-ibm-green border border-ibm-green/40"
            : "text-ibm-gray-light hover:text-ibm-white border border-transparent"
        }`}
      >
        ALL
      </button>
      {SUPPORTED_CHAIN_IDS.filter((id) => id !== 1).map((chainId) => {
        const chain = CHAINS[chainId];
        return (
          <button
            key={chainId}
            onClick={() => onSelect(chainId)}
            className={`px-2 py-1 text-[10px] tracking-wider transition-colors ${
              selected === chainId
                ? "border text-ibm-white"
                : "text-ibm-gray-light hover:text-ibm-white border border-transparent"
            }`}
            style={
              selected === chainId
                ? { borderColor: chain.color + "66", backgroundColor: chain.color + "15" }
                : {}
            }
          >
            {chain.shortName}
          </button>
        );
      })}
    </div>
  );
}
