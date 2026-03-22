"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { toast } from "react-toastify";
import { scanAllSubnets } from "@/lib/bittensor";

export default function SwapPanel() {
  const { subnets, setSubnets, wallet, subnetsLoading, setSubnetsLoading } = useStore();
  const [mode, setMode] = useState<"buy" | "sell" | "swap">("buy");
  const [fromNetuid, setFromNetuid] = useState<number | null>(null);
  const [toNetuid, setToNetuid] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (subnets.length === 0 && !subnetsLoading) {
      setSubnetsLoading(true);
      scanAllSubnets()
        .then((data) => setSubnets(data))
        .catch(() => {})
        .finally(() => setSubnetsLoading(false));
    }
  }, []);

  useEffect(() => {
    if (subnets.length > 0) {
      if (fromNetuid === null || !subnets.find((s) => s.netuid === fromNetuid)) {
        setFromNetuid(subnets[0].netuid);
      }
      if (toNetuid === null || !subnets.find((s) => s.netuid === toNetuid)) {
        setToNetuid(subnets.length > 1 ? subnets[1].netuid : subnets[0].netuid);
      }
    }
  }, [subnets]);

  const fromSubnet = useMemo(
    () => subnets.find((s) => s.netuid === fromNetuid),
    [subnets, fromNetuid]
  );
  const toSubnet = useMemo(
    () => subnets.find((s) => s.netuid === toNetuid),
    [subnets, toNetuid]
  );

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
      const payload: Record<string, any> = {
        action: mode,
        amount_tao: amt,
        wallet_address: wallet.address,
      };

      if (mode === "buy") {
        payload.netuid = toNetuid;
      } else if (mode === "sell") {
        payload.netuid = fromNetuid;
      } else {
        payload.from_netuid = fromNetuid;
        payload.to_netuid = toNetuid;
      }

      toast.info(
        `${mode.toUpperCase()}: ${amt} TAO ${mode === "buy" ? `> SN${toNetuid}` : mode === "sell" ? `from SN${fromNetuid}` : `SN${fromNetuid} > SN${toNetuid}`}`
      );

      const resp = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Trade request failed");
      }

      if (data.mock) {
        toast.warning("Backend offline - trade queued (mock)");
      } else {
        toast.success("TX submitted (pending)");
      }
      setAmount("");
    } catch (err: any) {
      toast.error(`Trade failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  }

  if (subnets.length === 0) {
    return (
      <div className="pixel-box p-6 max-w-lg mx-auto text-center">
        <p className="text-[8px] font-pixel text-btmuted mb-2">
          {subnetsLoading ? "LOADING SUBNETS..." : "NO SUBNET DATA"}
        </p>
        {!subnetsLoading && (
          <p className="text-[7px] font-pixel text-btmuted">
            {">> GO TO SUBNETS TAB AND REFRESH"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="pixel-box p-6 max-w-lg mx-auto">
      {/* Mode selector */}
      <div className="flex gap-1 mb-6 bg-btdark p-1 border-2 border-btborder">
        {(["buy", "sell", "swap"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 font-pixel text-[8px] transition-all ${
              mode === m
                ? m === "buy"
                  ? "bg-btgreen text-black"
                  : m === "sell"
                  ? "bg-btred text-white"
                  : "bg-btblue text-white"
                : "text-btmuted hover:text-bttext"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* From section */}
      {(mode === "sell" || mode === "swap") && (
        <div className="mb-4">
          <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">
            {mode === "swap" ? "FROM SUBNET" : "SELL FROM"}
          </label>
          <select
            value={fromNetuid ?? ""}
            onChange={(e) => setFromNetuid(Number(e.target.value))}
            className="w-full px-4 py-3"
          >
            {subnets.map((s) => (
              <option key={s.netuid} value={s.netuid}>
                SN{s.netuid} - {s.name} ({s.price.toFixed(6)} TAO)
              </option>
            ))}
          </select>
          {fromSubnet && (
            <p className="text-[6px] font-pixel text-btmuted mt-1">
              POOL: {fromSubnet.tao_in.toFixed(2)} TAO | PRICE: {fromSubnet.price.toFixed(6)}
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
            className="pixel-btn bg-btcard px-3 py-1 font-pixel text-[10px] text-btmuted hover:text-btgreen"
          >
            [SWAP]
          </button>
        </div>
      )}

      {/* To section */}
      {(mode === "buy" || mode === "swap") && (
        <div className="mb-4">
          <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">
            {mode === "swap" ? "TO SUBNET" : "BUY INTO"}
          </label>
          <select
            value={toNetuid ?? ""}
            onChange={(e) => setToNetuid(Number(e.target.value))}
            className="w-full px-4 py-3"
          >
            {subnets.map((s) => (
              <option key={s.netuid} value={s.netuid}>
                SN{s.netuid} - {s.name} ({s.price.toFixed(6)} TAO)
              </option>
            ))}
          </select>
          {toSubnet && (
            <p className="text-[6px] font-pixel text-btmuted mt-1">
              POOL: {toSubnet.tao_in.toFixed(2)} TAO | PRICE: {toSubnet.price.toFixed(6)}
            </p>
          )}
        </div>
      )}

      {/* Amount */}
      <div className="mb-4">
        <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">
          AMOUNT ({mode === "sell" ? "ALPHA" : "TAO"})
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 text-[10px]"
          />
          {wallet.connected && wallet.balance > 0 && (
            <button
              onClick={() => setAmount(String(wallet.balance))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[7px] font-pixel text-btgreen hover:underline"
            >
              [MAX]
            </button>
          )}
        </div>
      </div>

      {/* Estimate */}
      {parseFloat(amount) > 0 && (
        <div className="mb-4 bg-btdark p-3 border-2 border-btborder">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-pixel text-btmuted">EST. OUTPUT</span>
            <span className="text-[8px] font-pixel text-bttext">
              {estimatedOutput.toFixed(4)}{" "}
              {mode === "sell" ? "TAO" : "ALPHA"}
            </span>
          </div>
          {mode === "swap" && fromSubnet && toSubnet && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[7px] font-pixel text-btmuted">RATE</span>
              <span className="text-[8px] font-pixel text-bttext">
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
        className={`w-full py-3 font-pixel text-[9px] pixel-btn disabled:opacity-50 ${
          mode === "buy"
            ? "bg-btgreen text-black border-btgreen"
            : mode === "sell"
            ? "bg-btred text-white border-btred"
            : "bg-btblue text-white border-btblue"
        }`}
      >
        {executing ? "SUBMITTING..." : !wallet.connected ? "CONNECT WALLET" : `>> ${mode.toUpperCase()} <<`}
      </button>

      {!wallet.connected && (
        <p className="text-[6px] font-pixel text-btmuted text-center mt-2">
          CONNECT SUBWALLET TO TRADE
        </p>
      )}
    </div>
  );
}
