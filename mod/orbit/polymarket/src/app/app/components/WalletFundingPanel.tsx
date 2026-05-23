"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, parseUnits, formatUnits, isAddress } from "ethers";
import { useAuth } from "../context/AuthContext";
import { NETWORKS, NetworkConfig, ensureChain } from "../lib/networks";

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const PRESETS = [10, 100, 1000, 5000, 10000];

interface Props {
  capital?: number;
  onCapitalChange?: (n: number) => void;
}

export default function WalletFundingPanel({ capital, onCapitalChange }: Props) {
  const { auth } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("polygon");
  // Destination defaults to Polygon — that's where Polymarket settles. When
  // src != dst, the send is routed through Jumper (LiFi) as a bridge.
  const [dstId, setDstId] = useState<string>("polygon");
  // Per-network USDC balance cache. null = pending, number = fetched.
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [customCapital, setCustomCapital] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = useMemo<NetworkConfig>(() => {
    return NETWORKS.find((n) => n.id === selectedId) || NETWORKS[0];
  }, [selectedId]);
  const dst = useMemo<NetworkConfig>(() => {
    return NETWORKS.find((n) => n.id === dstId) || NETWORKS[0];
  }, [dstId]);
  const isBridge = selected.id !== dst.id;

  const fetchAllBalances = useCallback(async () => {
    if (!auth.address) return;
    // Fan out across networks via their public RPCs so we can show balances
    // without making the user switch chains in their wallet.
    setBalances((prev) => {
      const next = { ...prev };
      for (const n of NETWORKS) if (next[n.id] === undefined) next[n.id] = null;
      return next;
    });
    await Promise.all(
      NETWORKS.map(async (net) => {
        try {
          const provider = new JsonRpcProvider(net.rpcUrl);
          const usdc = new Contract(net.usdc, USDC_ABI, provider);
          const raw: bigint = await usdc.balanceOf(auth.address!);
          setBalances((prev) => ({ ...prev, [net.id]: Number(formatUnits(raw, 6)) }));
        } catch {
          setBalances((prev) => ({ ...prev, [net.id]: null }));
        }
      }),
    );
  }, [auth.address]);

  useEffect(() => { void fetchAllBalances(); }, [fetchAllBalances]);

  useEffect(() => {
    if (!auth.address) return;
    const t = setInterval(() => { void fetchAllBalances(); }, 30_000);
    return () => clearInterval(t);
  }, [auth.address, fetchAllBalances]);

  const handleCopy = async () => {
    if (!auth.address) return;
    try {
      await navigator.clipboard.writeText(auth.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleSend = async () => {
    setStatus(null);
    if (!auth.address || typeof window === "undefined" || !window.ethereum) {
      setStatus("NO WALLET");
      return;
    }
    if (!isAddress(recipient)) {
      setStatus("INVALID RECIPIENT ADDRESS");
      return;
    }
    const n = parseFloat(sendAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setStatus("ENTER AMOUNT > 0");
      return;
    }
    const bal = balances[selected.id];
    if (bal !== null && bal !== undefined && n > bal) {
      setStatus(`INSUFFICIENT ON ${selected.name} — BALANCE $${bal.toFixed(2)}`);
      return;
    }

    // Cross-chain → hand off to Jumper (LiFi). We pre-fill source/dst/amount/
    // recipient so the user just clicks one button there. Done in a new tab
    // so the polymarket app keeps its state.
    if (isBridge) {
      const url =
        `https://jumper.exchange/?fromChain=${selected.chainId}` +
        `&fromToken=${selected.usdc}` +
        `&toChain=${dst.chainId}` +
        `&toToken=${dst.usdc}` +
        `&fromAmount=${encodeURIComponent(sendAmount)}` +
        `&toAddress=${encodeURIComponent(recipient)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setStatus(`OPENED JUMPER — BRIDGE ${selected.name} → ${dst.name} IN NEW TAB`);
      return;
    }

    setBusy(true);
    try {
      setStatus(`SWITCHING WALLET TO ${selected.name}...`);
      await ensureChain(window.ethereum as never, selected);
      setStatus("CONFIRM IN WALLET...");
      const provider = new BrowserProvider(window.ethereum as never);
      const signer = await provider.getSigner(auth.address);
      const usdc = new Contract(selected.usdc, USDC_ABI, signer);
      const tx = await usdc.transfer(recipient, parseUnits(sendAmount, 6));
      setStatus(`SENT ${tx.hash.slice(0, 10)}... — WAITING FOR CONFIRM`);
      await tx.wait();
      setStatus(`CONFIRMED ${tx.hash.slice(0, 10)}... ON ${selected.name}`);
      setSendAmount("");
      void fetchAllBalances();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`ERROR: ${msg.slice(0, 200)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!auth.address) {
    return (
      <div className="pixel-panel border-2 border-pixel-border px-3 py-3 text-center">
        <span className="text-[11px] tracking-wider text-pixel-gray">CONNECT WALLET TO VIEW FUNDS</span>
      </div>
    );
  }

  const selectedBalance = balances[selected.id];

  return (
    <div className="pixel-panel border-2 border-pixel-border px-3 py-2 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-pixel-gray tracking-wider">WALLET</span>
        <button
          onClick={() => { void fetchAllBalances(); }}
          title="Refresh balances"
          className="text-[10px] text-pixel-gray hover:text-green-400 px-1"
        >
          ↻
        </button>
      </div>

      {/* Address */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-pixel-white font-mono break-all flex-1">
          {auth.address}
        </span>
        <button
          onClick={handleCopy}
          className="pixel-btn text-[10px] px-1.5 py-0.5 border-pixel-border text-pixel-gray hover:text-pixel-white shrink-0"
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>

      {/* Source network dropdown + balance */}
      <div className="border-t border-pixel-border/40 pt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-pixel-gray tracking-wider">FROM NETWORK</span>
          <span className="text-[14px] text-green-400 font-mono">
            {selectedBalance === null || selectedBalance === undefined
              ? "..."
              : `$${selectedBalance.toFixed(2)}`}
          </span>
        </div>
        <select
          value={selected.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="pixel-input-sm w-full font-mono text-[11px] cursor-pointer"
          style={{ appearance: "menulist" }}
        >
          {NETWORKS.map((n) => {
            const bal = balances[n.id];
            const balLabel = bal === null || bal === undefined ? "..." : `$${bal.toFixed(2)}`;
            return (
              <option key={n.id} value={n.id}>
                {n.name} — {balLabel}
              </option>
            );
          })}
        </select>
      </div>

      {/* Destination network dropdown (cross-chain → bridges via Jumper) */}
      <div className="border-t border-pixel-border/40 pt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-pixel-gray tracking-wider">TO NETWORK</span>
          {isBridge && (
            <span className="text-[10px] text-amber-400 font-mono">BRIDGE VIA JUMPER</span>
          )}
        </div>
        <select
          value={dst.id}
          onChange={(e) => setDstId(e.target.value)}
          className="pixel-input-sm w-full font-mono text-[11px] cursor-pointer"
          style={{ appearance: "menulist" }}
        >
          {NETWORKS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}{n.id === selected.id ? " (same chain — direct send)" : " (bridge)"}
            </option>
          ))}
        </select>
      </div>

      {/* Capital cap (only on LIVE tab — caller supplies handlers) */}
      {capital !== undefined && onCapitalChange && (
        <div className="border-t border-pixel-border/40 pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-pixel-gray tracking-wider">CAPITAL CAP</span>
            <span className="text-[12px] text-pixel-white font-mono">${capital.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => { onCapitalChange(p); setCustomCapital(""); }}
                className={`pixel-btn text-[10px] px-1.5 py-0.5 transition-colors ${
                  capital === p
                    ? "border-green-400 text-green-400 bg-green-400/10"
                    : "border-pixel-border text-pixel-gray hover:text-pixel-white"
                }`}
              >
                ${p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
            {selectedBalance !== null && selectedBalance !== undefined && selectedBalance > 0 && (
              <button
                onClick={() => { onCapitalChange(Math.floor(selectedBalance)); setCustomCapital(""); }}
                className="pixel-btn text-[10px] px-1.5 py-0.5 border-pixel-border text-pixel-gray hover:text-amber-400 hover:border-amber-400"
                title={`Use full ${selected.name} balance`}
              >
                MAX
              </button>
            )}
            <input
              type="text"
              inputMode="numeric"
              value={customCapital}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setCustomCapital(v);
                const num = Number(v);
                if (num > 0) onCapitalChange(num);
              }}
              placeholder="CUSTOM"
              className="pixel-input-sm w-16 font-mono text-[10px] text-center"
            />
          </div>
        </div>
      )}

      {/* Send / Bridge */}
      <div className="border-t border-pixel-border/40 pt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-pixel-gray tracking-wider">
            {isBridge ? "BRIDGE USDC" : "SEND USDC"}
          </span>
          <span className="text-[10px] text-pixel-gray font-mono">
            {selected.name} → {dst.name}
          </span>
        </div>
        <input
          type="text"
          placeholder="RECIPIENT 0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="pixel-input-sm w-full font-mono text-[10px]"
          spellCheck={false}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            placeholder="AMOUNT (USDC)"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="pixel-input-sm flex-1 font-mono text-[11px]"
          />
          <button
            onClick={() => { void handleSend(); }}
            disabled={busy || !sendAmount || !recipient}
            className={`pixel-btn text-[11px] px-3 py-1 disabled:opacity-30 disabled:cursor-not-allowed ${
              isBridge
                ? "border-amber-400 text-amber-400 hover:bg-amber-400/10"
                : "border-green-400 text-green-400 hover:bg-green-400/10"
            }`}
          >
            {busy
              ? "SENDING..."
              : isBridge
                ? `BRIDGE${sendAmount ? ` $${sendAmount}` : ""} →`
                : `SEND${sendAmount ? ` $${sendAmount}` : ""}`}
          </button>
        </div>
        {status && (
          <div className={`text-[10px] font-mono break-all ${
            status.startsWith("ERROR") || status.startsWith("INVALID") || status.startsWith("INSUFFICIENT") || status.includes("REJECTED")
              ? "text-red-400"
              : status.startsWith("CONFIRMED") || status.startsWith("SENT")
                ? "text-green-400"
                : "text-amber-400"
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
