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
      toast.error("Connect wallet or select proxy");
      return;
    }
    if (!targetAddress) {
      toast.error("Enter address to copy");
      return;
    }
    if (!budget || parseFloat(budget) <= 0) {
      toast.error("Enter valid budget");
      return;
    }

    setExecuting(true);
    try {
      toast.info(`Analyzing ${shortAddress(targetAddress)}...`);

      const payload: Record<string, any> = {
        action: "copy",
        target_coldkey: targetAddress,
        budget_tao: parseFloat(budget),
        strategy,
        wallet_address: wallet.address,
      };

      if (useProxy && selectedProxy) {
        payload.proxy_name = selectedProxy;
      }

      const resp = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Copy trade failed");
      }

      if (data.mock) {
        toast.warning(
          `Queued (offline): ${budget} TAO > ${shortAddress(targetAddress)}`
        );
      } else {
        toast.success(
          `Copy started: ${budget} TAO > ${shortAddress(targetAddress)}`
        );
      }
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Copy Trade Form */}
      <div className="pixel-box p-6">
        <h2 className="text-[9px] font-pixel text-bttext mb-4">COPY TRADE</h2>

        {/* Strategy */}
        <div className="mb-4">
          <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">
            STRATEGY
          </label>
          <div className="flex gap-0 border-2 border-btborder">
            <button
              onClick={() => setStrategy("mirror")}
              className={`flex-1 py-2 font-pixel text-[7px] ${
                strategy === "mirror"
                  ? "bg-btgreen text-black"
                  : "bg-btcard text-btmuted"
              }`}
            >
              MIRROR (1:1)
            </button>
            <button
              onClick={() => setStrategy("index")}
              className={`flex-1 py-2 font-pixel text-[7px] ${
                strategy === "index"
                  ? "bg-btblue text-white"
                  : "bg-btcard text-btmuted"
              }`}
            >
              INDEX (WGT)
            </button>
          </div>
        </div>

        {/* Target address */}
        <div className="mb-4">
          <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">
            TARGET COLDKEY
          </label>
          <input
            type="text"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            placeholder="5F3x..."
            className="w-full px-4 py-3"
          />
        </div>

        {/* Budget */}
        <div className="mb-4">
          <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">
            BUDGET (TAO)
          </label>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="50.0"
            className="w-full px-4 py-3"
          />
        </div>

        {/* Proxy toggle */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setUseProxy(!useProxy)}
            className={`px-3 py-1 font-pixel text-[7px] border-2 ${
              useProxy ? "bg-btgreen text-black border-btgreen" : "bg-btcard text-btmuted border-btborder"
            }`}
          >
            {useProxy ? "[ON]" : "[OFF]"}
          </button>
          <span className="text-[7px] font-pixel text-btmuted">USE PROXY</span>
        </div>

        {useProxy && proxyAccounts.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedProxy}
              onChange={(e) => setSelectedProxy(e.target.value)}
              className="w-full px-4 py-3"
            >
              <option value="">SELECT PROXY...</option>
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
          className="w-full py-3 pixel-btn bg-btblue text-white font-pixel text-[8px] border-btblue disabled:opacity-50"
        >
          {executing ? "EXECUTING..." : ">> START COPY <<"}
        </button>

        <p className="text-[6px] font-pixel text-btmuted mt-2 text-center">
          {strategy === "mirror"
            ? "MIRRORS EXACT ALLOCATION TO YOUR BUDGET"
            : "WEIGHTED INDEX FROM TARGET POSITIONS"}
        </p>
      </div>

      {/* Quick Copy from Leaderboard */}
      <div className="pixel-box p-6">
        <h2 className="text-[9px] font-pixel text-bttext mb-4">QUICK COPY</h2>

        {leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[8px] font-pixel text-btmuted mb-2">NO DATA</p>
            <p className="text-[7px] font-pixel text-btmuted">
              {">> REFRESH LEADERBOARD FIRST"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {leaderboard.slice(0, 10).map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center gap-3 p-3 bg-btdark border-2 border-btborder hover:border-btgreen cursor-pointer"
                onClick={() => setTargetAddress(entry.coldkey)}
              >
                <span
                  className={`text-[8px] font-pixel w-6 ${
                    entry.rank <= 3 ? "text-btyellow" : "text-btmuted"
                  }`}
                >
                  #{entry.rank}
                </span>
                <div className="flex-1">
                  <p className="text-[7px] font-pixel text-bttext">{shortAddress(entry.coldkey)}</p>
                  <p className="text-[6px] font-pixel text-btmuted">
                    {entry.top_subnets.length} SN | {entry.trade_count} TX
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-[7px] font-pixel ${
                      entry.roi_30d > 0 ? "text-btgreen" : "text-btred"
                    }`}
                  >
                    {entry.roi_30d > 0 ? "+" : ""}
                    {(entry.roi_30d * 100).toFixed(1)}%
                  </p>
                  <p className="text-[6px] font-pixel text-btmuted">
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
