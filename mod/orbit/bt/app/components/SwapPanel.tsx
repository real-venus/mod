"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { toast } from "react-toastify";

export default function SwapPanel() {
  const { subnets, wallet } = useStore();
  const [mode, setMode] = useState<"buy" | "sell" | "swap">("buy");
  const [fromNetuid, setFromNetuid] = useState<number>(0);
  const [toNetuid, setToNetuid] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [executing, setExecuting] = useState(false);

  const fromSubnet = useMemo(() => subnets.find((s) => s.netuid === fromNetuid), [subnets, fromNetuid]);
  const toSubnet = useMemo(() => subnets.find((s) => s.netuid === toNetuid), [subnets, toNetuid]);

  const estimatedOutput = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    if (mode === "buy" && toSubnet) {
      return toSubnet.price > 0 ? amt / toSubnet.price : 0;
    }
    if (mode === "sell" && fromSubnet) {
      return amt * fromSubnet.price;
    }
    if (mode === "swap" && fromSubnet && toSubnet) {
      const taoValue = amt * fromSubnet.price;
      return toSubnet.price > 0 ? taoValue / toSubnet.price : 0;
    }
    return 0;
  }, [amount, mode, fromSubnet, toSubnet]);

  async function handleExecute() {
    if (!wallet.connected) {
      toast.error("Connect wallet first");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setExecuting(true);
    try {
      // This would call the Python backend / Rust engine
      // For now, simulate the transaction
      toast.info(
        `${mode.toUpperCase()}: ${amt} TAO ${mode === "buy" ? `→ SN${toNetuid}` : mode === "sell" ? `from SN${fromNetuid}` : `SN${fromNetuid} → SN${toNetuid}`}`
      );

      // In production: call the API endpoint that triggers bt.BtTrader
      const endpoint = mode === "buy" ? "/api/trade/buy" : mode === "sell" ? "/api/trade/sell" : "/api/trade/swap";

      await new Promise((r) => setTimeout(r, 1500));
      toast.success("Transaction submitted (pending finalization)");
      setAmount("");
    } catch (err: any) {
      toast.error(`Trade failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="bg-btcard border border-btborder rounded-xl p-6 max-w-lg mx-auto">
      {/* Mode selector */}
      <div className="flex gap-1 mb-6 bg-btdark rounded-lg p-1">
        {(["buy", "sell", "swap"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
              mode === m
                ? m === "buy"
                  ? "bg-btgreen/20 text-btgreen"
                  : m === "sell"
                  ? "bg-btred/20 text-btred"
                  : "bg-btblue/20 text-btblue"
                : "text-btmuted hover:text-white"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* From section (for sell/swap) */}
      {(mode === "sell" || mode === "swap") && (
        <div className="mb-4">
          <label className="text-[10px] text-btmuted uppercase tracking-wider mb-1 block">
            {mode === "swap" ? "From Subnet" : "Sell From"}
          </label>
          <select
            value={fromNetuid}
            onChange={(e) => setFromNetuid(Number(e.target.value))}
            className="w-full bg-btdark border border-btborder rounded-lg px-4 py-3 text-sm text-white focus:border-btgreen/50 focus:outline-none"
          >
            {subnets.map((s) => (
              <option key={s.netuid} value={s.netuid}>
                SN{s.netuid} - {s.name} ({s.price.toFixed(6)} TAO)
              </option>
            ))}
          </select>
          {fromSubnet && (
            <p className="text-[10px] text-btmuted mt-1">
              Pool: {fromSubnet.tao_in.toFixed(2)} TAO | Price: {fromSubnet.price.toFixed(6)} TAO/alpha
            </p>
          )}
        </div>
      )}

      {/* Swap arrow */}
      {mode === "swap" && (
        <div className="flex justify-center my-2">
          <button
            onClick={() => {
              const tmp = fromNetuid;
              setFromNetuid(toNetuid);
              setToNetuid(tmp);
            }}
            className="w-8 h-8 rounded-full bg-btdark border border-btborder flex items-center justify-center text-btmuted hover:text-btgreen hover:border-btgreen/50 transition-all"
          >
            ↕
          </button>
        </div>
      )}

      {/* To section (for buy/swap) */}
      {(mode === "buy" || mode === "swap") && (
        <div className="mb-4">
          <label className="text-[10px] text-btmuted uppercase tracking-wider mb-1 block">
            {mode === "swap" ? "To Subnet" : "Buy Into"}
          </label>
          <select
            value={toNetuid}
            onChange={(e) => setToNetuid(Number(e.target.value))}
            className="w-full bg-btdark border border-btborder rounded-lg px-4 py-3 text-sm text-white focus:border-btgreen/50 focus:outline-none"
          >
            {subnets.map((s) => (
              <option key={s.netuid} value={s.netuid}>
                SN{s.netuid} - {s.name} ({s.price.toFixed(6)} TAO)
              </option>
            ))}
          </select>
          {toSubnet && (
            <p className="text-[10px] text-btmuted mt-1">
              Pool: {toSubnet.tao_in.toFixed(2)} TAO | Price: {toSubnet.price.toFixed(6)} TAO/alpha
            </p>
          )}
        </div>
      )}

      {/* Amount */}
      <div className="mb-4">
        <label className="text-[10px] text-btmuted uppercase tracking-wider mb-1 block">
          Amount ({mode === "sell" ? "Alpha" : "TAO"})
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-btdark border border-btborder rounded-lg px-4 py-3 text-lg text-white font-mono focus:border-btgreen/50 focus:outline-none"
          />
          {wallet.connected && (
            <button
              onClick={() => setAmount(String(wallet.balance))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-btgreen hover:underline"
            >
              MAX
            </button>
          )}
        </div>
      </div>

      {/* Estimate */}
      {parseFloat(amount) > 0 && (
        <div className="mb-4 bg-btdark rounded-lg p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-btmuted">Estimated Output</span>
            <span className="text-white font-mono">
              {estimatedOutput.toFixed(4)}{" "}
              {mode === "sell" ? "TAO" : "alpha"}
            </span>
          </div>
          {mode === "swap" && fromSubnet && toSubnet && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-btmuted">Rate</span>
              <span className="text-white font-mono">
                1 SN{fromNetuid} = {(fromSubnet.price / toSubnet.price).toFixed(4)} SN{toNetuid}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Execute */}
      <button
        onClick={handleExecute}
        disabled={executing || !amount}
        className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          mode === "buy"
            ? "bg-btgreen text-black hover:bg-btgreen/80"
            : mode === "sell"
            ? "bg-btred text-white hover:bg-btred/80"
            : "bg-btblue text-white hover:bg-btblue/80"
        }`}
      >
        {executing ? "Submitting..." : !wallet.connected ? "Connect Wallet" : `${mode.toUpperCase()} ${mode === "swap" ? "Swap" : ""}`}
      </button>

      {!wallet.connected && (
        <p className="text-[10px] text-btmuted text-center mt-2">
          Connect your SubWallet to trade
        </p>
      )}
    </div>
  );
}
