"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { toast } from "react-toastify";
import { shortAddress } from "@/lib/wallet";

export default function CopyTrade() {
  const { leaderboard, wallet, proxyAccounts } = useStore();
  const [targetAddress, setTargetAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [useProxy, setUseProxy] = useState(false);
  const [selectedProxy, setSelectedProxy] = useState("");
  const [executing, setExecuting] = useState(false);
  const [strategy, setStrategy] = useState<"mirror" | "index">("mirror");

  async function handleCopyTrade() {
    if (!wallet.connected && !useProxy) {
      toast.error("Connect wallet or select a proxy account");
      return;
    }
    if (!targetAddress) {
      toast.error("Enter an address to copy");
      return;
    }
    if (!budget || parseFloat(budget) <= 0) {
      toast.error("Enter a valid budget");
      return;
    }

    setExecuting(true);
    try {
      toast.info(`Analyzing ${shortAddress(targetAddress)} positions...`);
      await new Promise((r) => setTimeout(r, 2000));

      // In production: calls Python backend which runs TaoCopy.follow()
      toast.success(
        `Copy trade initiated: ${budget} TAO → mirroring ${shortAddress(targetAddress)}`
      );
    } catch (err: any) {
      toast.error(`Copy trade failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Copy Trade Form */}
      <div className="bg-btcard border border-btborder rounded-xl p-6">
        <h2 className="text-sm font-bold mb-4">Copy Trade</h2>

        {/* Strategy */}
        <div className="mb-4">
          <label className="text-[10px] text-btmuted uppercase tracking-wider mb-1 block">
            Strategy
          </label>
          <div className="flex gap-1 bg-btdark rounded-lg p-1">
            <button
              onClick={() => setStrategy("mirror")}
              className={`flex-1 py-2 rounded-md text-xs transition-all ${
                strategy === "mirror"
                  ? "bg-btgreen/20 text-btgreen"
                  : "text-btmuted"
              }`}
            >
              Mirror (1:1 copy)
            </button>
            <button
              onClick={() => setStrategy("index")}
              className={`flex-1 py-2 rounded-md text-xs transition-all ${
                strategy === "index"
                  ? "bg-btblue/20 text-btblue"
                  : "text-btmuted"
              }`}
            >
              Index (weighted)
            </button>
          </div>
        </div>

        {/* Target address */}
        <div className="mb-4">
          <label className="text-[10px] text-btmuted uppercase tracking-wider mb-1 block">
            Target Address (coldkey to copy)
          </label>
          <input
            type="text"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            placeholder="5F3x..."
            className="w-full bg-btdark border border-btborder rounded-lg px-4 py-3 text-xs text-white font-mono placeholder:text-btmuted focus:border-btgreen/50 focus:outline-none"
          />
        </div>

        {/* Budget */}
        <div className="mb-4">
          <label className="text-[10px] text-btmuted uppercase tracking-wider mb-1 block">
            Budget (TAO)
          </label>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="50.0"
            className="w-full bg-btdark border border-btborder rounded-lg px-4 py-3 text-sm text-white font-mono placeholder:text-btmuted focus:border-btgreen/50 focus:outline-none"
          />
        </div>

        {/* Proxy toggle */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setUseProxy(!useProxy)}
            className={`w-8 h-4 rounded-full transition-all ${
              useProxy ? "bg-btgreen" : "bg-btborder"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                useProxy ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs text-btmuted">Use proxy account</span>
        </div>

        {useProxy && proxyAccounts.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedProxy}
              onChange={(e) => setSelectedProxy(e.target.value)}
              className="w-full bg-btdark border border-btborder rounded-lg px-4 py-3 text-xs text-white focus:border-btgreen/50 focus:outline-none"
            >
              <option value="">Select proxy...</option>
              {proxyAccounts
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({shortAddress(p.coldkey)}) - {p.budget_tao} TAO
                  </option>
                ))}
            </select>
          </div>
        )}

        <button
          onClick={handleCopyTrade}
          disabled={executing}
          className="w-full py-3 bg-btblue text-white rounded-lg text-sm font-bold hover:bg-btblue/80 transition-all disabled:opacity-50"
        >
          {executing ? "Executing..." : "Start Copy Trade"}
        </button>

        {strategy === "mirror" && (
          <p className="text-[10px] text-btmuted mt-2 text-center">
            Mirrors exact subnet allocation proportionally to your budget
          </p>
        )}
        {strategy === "index" && (
          <p className="text-[10px] text-btmuted mt-2 text-center">
            Creates a weighted index from target&apos;s top positions
          </p>
        )}
      </div>

      {/* Quick Copy from Leaderboard */}
      <div className="bg-btcard border border-btborder rounded-xl p-6">
        <h2 className="text-sm font-bold mb-4">Quick Copy from Leaderboard</h2>

        {leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-btmuted mb-2">No leaderboard data</p>
            <p className="text-[10px] text-btmuted">
              Go to Leaderboard tab and refresh to scan top performers
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {leaderboard.slice(0, 10).map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center gap-3 p-3 bg-btdark rounded-lg border border-btborder/50 hover:border-btgreen/30 transition-all cursor-pointer"
                onClick={() => setTargetAddress(entry.coldkey)}
              >
                <span
                  className={`text-xs font-bold w-6 ${
                    entry.rank <= 3 ? "text-btyellow" : "text-btmuted"
                  }`}
                >
                  #{entry.rank}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-mono">{shortAddress(entry.coldkey)}</p>
                  <p className="text-[10px] text-btmuted">
                    {entry.top_subnets.length} subnets | {entry.trade_count} trades
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-mono font-bold ${
                      entry.roi_30d > 0 ? "text-btgreen" : "text-btred"
                    }`}
                  >
                    {entry.roi_30d > 0 ? "+" : ""}
                    {(entry.roi_30d * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-btmuted">
                    {entry.total_value_tao.toFixed(1)} TAO
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
