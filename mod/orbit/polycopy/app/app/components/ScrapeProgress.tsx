"use client";

import { ScrapeProgress as ScrapeProgressType } from "../lib/dex-data";

interface Props {
  progress: ScrapeProgressType;
  chainName: string;
}

export default function ScrapeProgress({ progress, chainName }: Props) {
  const { phase, currentBlock, startBlock, endBlock, chunkIndex, totalChunks, swapsFound, v3Swaps, v2Swaps, pct } = progress;

  if (phase === "done") return null;

  const phaseLabel = phase === "init" ? "INITIALIZING" : phase === "v3" ? "UNISWAP V3" : "UNISWAP V2";
  const blockRange = endBlock - startBlock;
  const blocksScanned = currentBlock - startBlock;

  return (
    <div className="panel-glow bg-ibm-panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ibm-green animate-pulse" />
          <span className="text-[11px] text-ibm-green tracking-widest font-semibold glow-text">
            SCANNING {chainName}
          </span>
        </div>
        <span className="text-[11px] text-ibm-amber font-mono glow-amber">
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-ibm-black/60 border border-ibm-border/30 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: phase === "v3"
              ? "linear-gradient(90deg, #42be65, #08bdba)"
              : "linear-gradient(90deg, #0f62fe, #4589ff)",
          }}
        />
        {/* Scanline effect */}
        <div
          className="absolute inset-y-0 w-8 animate-pulse opacity-40"
          style={{
            left: `${pct}%`,
            background: "linear-gradient(90deg, transparent, #42be65, transparent)",
          }}
        />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-[9px] text-ibm-gray tracking-wider">PHASE</div>
          <div className={`text-[11px] font-mono font-medium ${phase === "v3" ? "text-ibm-green" : "text-ibm-blue"}`}>
            {phaseLabel}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-ibm-gray tracking-wider">BLOCK</div>
          <div className="text-[11px] font-mono text-ibm-white">
            {currentBlock.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-ibm-gray tracking-wider">CHUNK</div>
          <div className="text-[11px] font-mono text-ibm-gray-light">
            {chunkIndex + 1} / {totalChunks}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-ibm-gray tracking-wider">SWAPS FOUND</div>
          <div className="text-[11px] font-mono text-ibm-amber glow-amber">
            {swapsFound.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Block range visualization */}
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-ibm-gray">{startBlock.toLocaleString()}</span>
        <div className="flex-1 relative h-1 bg-ibm-black/40">
          <div
            className="absolute inset-y-0 left-0 bg-ibm-green/30"
            style={{ width: `${blockRange > 0 ? (blocksScanned / blockRange) * 100 : 0}%` }}
          />
        </div>
        <span className="text-ibm-gray">{endBlock.toLocaleString()}</span>
      </div>

      {/* Swap counts */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-ibm-green" />
          <span className="text-ibm-gray-light">V3: <span className="text-ibm-green font-mono">{v3Swaps}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-ibm-blue" />
          <span className="text-ibm-gray-light">V2: <span className="text-ibm-blue font-mono">{v2Swaps}</span></span>
        </div>
        <div className="text-ibm-gray ml-auto">
          {blockRange} BLOCKS TOTAL
        </div>
      </div>
    </div>
  );
}
