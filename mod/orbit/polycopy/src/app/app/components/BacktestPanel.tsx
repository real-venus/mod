"use client";

import { useState, useCallback, useEffect } from "react";
import ScoreEditor from "./ScoreEditor";
import BacktestResults from "./BacktestResults";
import { BacktestResult, BacktestConfig, Trade } from "../lib/types";
import { DEFAULT_SCORE_FN, runBacktest } from "../lib/backtest";
import { fetchAllChainSwaps } from "../lib/dex-data";

export default function BacktestPanel() {
  const [code, setCode] = useState(DEFAULT_SCORE_FN);
  const [threshold, setThreshold] = useState(60);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [positionPct, setPositionPct] = useState(10);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [blockCount, setBlockCount] = useState(500);

  const loadTrades = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    try {
      const data = await fetchAllChainSwaps(blockCount);
      setTrades(data);
      setDataLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setDataLoading(false);
  }, [blockCount]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const handleRun = useCallback(() => {
    if (!trades.length) {
      setError("No trade data loaded. Fetch on-chain data first.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);

    setTimeout(() => {
      try {
        const config: BacktestConfig = {
          scoreFn: code,
          threshold,
          startDate: Date.now() - 30 * 86400000,
          endDate: Date.now(),
          initialCapital,
          positionPct,
        };
        const res = runBacktest(trades, config);
        setResult(res);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setRunning(false);
    }, 100);
  }, [code, threshold, initialCapital, positionPct, trades]);

  return (
    <div className="space-y-4">
      {/* Config bar */}
      <div className="panel-glow bg-ibm-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] text-ibm-gray-light tracking-widest">
            BACKTEST ENGINE
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-ibm-gray">
              {dataLoaded
                ? `${trades.length} TRADES LOADED`
                : dataLoading
                ? "FETCHING..."
                : "NO DATA"}
            </span>
            <button
              onClick={loadTrades}
              disabled={dataLoading}
              className="px-3 py-1 text-[10px] border border-ibm-border/40 text-ibm-gray-light hover:text-ibm-green hover:border-ibm-green/40 transition-colors tracking-wider disabled:opacity-50"
            >
              {dataLoading ? "LOADING..." : "RELOAD DATA"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-[9px] text-ibm-gray-light tracking-wider block mb-1">
              BLOCK RANGE (PER CHAIN)
            </label>
            <input
              type="number"
              value={blockCount}
              onChange={(e) => setBlockCount(Number(e.target.value))}
              min={50}
              max={5000}
              className="w-full bg-ibm-black/50 border border-ibm-border/40 px-3 py-1.5 text-[10px] text-ibm-green font-mono focus:outline-none focus:border-ibm-green/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[9px] text-ibm-gray-light tracking-wider block mb-1">
              SCORE THRESHOLD
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              min={0}
              max={100}
              className="w-full bg-ibm-black/50 border border-ibm-border/40 px-3 py-1.5 text-[11px] text-ibm-amber font-mono focus:outline-none focus:border-ibm-green/40"
            />
          </div>
          <div>
            <label className="text-[9px] text-ibm-gray-light tracking-wider block mb-1">
              INITIAL CAPITAL ($)
            </label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              min={100}
              className="w-full bg-ibm-black/50 border border-ibm-border/40 px-3 py-1.5 text-[11px] text-ibm-white font-mono focus:outline-none focus:border-ibm-green/40"
            />
          </div>
          <div>
            <label className="text-[9px] text-ibm-gray-light tracking-wider block mb-1">
              POSITION SIZE (%)
            </label>
            <input
              type="number"
              value={positionPct}
              onChange={(e) => setPositionPct(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full bg-ibm-black/50 border border-ibm-border/40 px-3 py-1.5 text-[11px] text-ibm-cyan font-mono focus:outline-none focus:border-ibm-green/40"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={running || !dataLoaded}
              className={`w-full py-2 text-[11px] font-semibold tracking-widest transition-all ${
                running || !dataLoaded
                  ? "bg-ibm-gray/20 text-ibm-gray border border-ibm-border/40 cursor-wait"
                  : "bg-ibm-green/20 text-ibm-green border border-ibm-green/60 hover:bg-ibm-green/30 hover:shadow-[0_0_15px_#42be6522]"
              }`}
            >
              {running ? "RUNNING..." : "RUN BACKTEST"}
            </button>
          </div>
        </div>
      </div>

      {/* Score function editor */}
      <ScoreEditor value={code} onChange={setCode} error={error} />

      {/* Results */}
      {result && <BacktestResults result={result} />}
    </div>
  );
}
