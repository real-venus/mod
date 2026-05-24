"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  parseUnits,
  formatUnits,
  formatEther,
  isAddress,
} from "ethers";
import { useAuth } from "../context/AuthContext";
import { NETWORKS, NetworkConfig, NATIVE_TOKEN_ADDRESS, ensureChain, withRpcFallback, networkById } from "../lib/networks";
import { getLifiQuote, executeLifiBridge } from "../lib/lifi";

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const PRESETS = [10, 100, 1000, 5000, 10000];

const POLYGON = networkById("polygon")!;

type SrcAsset = "usdc" | "native";

interface Props {
  capital?: number;
  onCapitalChange?: (n: number) => void;
}

export default function WalletFundingPanel({ capital, onCapitalChange }: Props) {
  const { auth } = useAuth();
  const [srcId, setSrcId] = useState<string>("polygon");
  const [srcAsset, setSrcAsset] = useState<SrcAsset>("usdc");
  const [usdcBal, setUsdcBal] = useState<Record<string, number | null>>({});
  const [nativeBal, setNativeBal] = useState<Record<string, number | null>>({});
  const [recipient, setRecipient] = useState("");
  const [showRecipient, setShowRecipient] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [customCapital, setCustomCapital] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const src = useMemo<NetworkConfig>(
    () => NETWORKS.find((n) => n.id === srcId) || NETWORKS[0],
    [srcId],
  );
  // Destination is always Polygon USDC — that's where Polymarket settles.
  // Bridge fires when source isn't already Polygon USDC.
  const isBridge = src.id !== "polygon" || srcAsset !== "usdc";

  const fetchAllBalances = useCallback(async () => {
    if (!auth.address) return;
    await Promise.all(
      NETWORKS.map(async (net) => {
        try {
          const raw: bigint = await withRpcFallback(net, async (url) => {
            const provider = new JsonRpcProvider(url);
            const usdc = new Contract(net.usdc, USDC_ABI, provider);
            return usdc.balanceOf(auth.address!);
          });
          setUsdcBal((p) => ({ ...p, [net.id]: Number(formatUnits(raw, 6)) }));
        } catch {
          setUsdcBal((p) => ({ ...p, [net.id]: null }));
        }
        try {
          const raw: bigint = await withRpcFallback(net, async (url) => {
            const provider = new JsonRpcProvider(url);
            return provider.getBalance(auth.address!);
          });
          setNativeBal((p) => ({ ...p, [net.id]: Number(formatEther(raw)) }));
        } catch {
          setNativeBal((p) => ({ ...p, [net.id]: null }));
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

  useEffect(() => {
    if (auth.address && !recipient) setRecipient(auth.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.address]);

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
      setStatus("INVALID RECIPIENT");
      return;
    }
    const n = parseFloat(sendAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setStatus("ENTER AMOUNT > 0");
      return;
    }
    const srcBalances = srcAsset === "usdc" ? usdcBal : nativeBal;
    const bal = srcBalances[src.id];
    if (bal !== null && bal !== undefined && n > bal) {
      const sym = srcAsset === "usdc" ? "USDC" : src.nativeCurrency.symbol;
      setStatus(`INSUFFICIENT ${sym} — BAL ${bal.toFixed(srcAsset === "usdc" ? 2 : 4)}`);
      return;
    }

    setBusy(true);
    try {
      setStatus(`SWITCHING TO ${src.name}...`);
      await ensureChain(window.ethereum as never, src);
      const provider = new BrowserProvider(window.ethereum as never);
      const signer = await provider.getSigner(auth.address);

      if (isBridge) {
        setStatus("FETCHING LIFI QUOTE...");
        const fromToken = srcAsset === "native" ? NATIVE_TOKEN_ADDRESS : src.usdc;
        const fromDecimals = srcAsset === "native" ? 18 : 6;
        const fromAmountUnits = parseUnits(sendAmount, fromDecimals).toString();
        const quote = await getLifiQuote({
          fromChain: src.chainId,
          fromToken,
          toChain: POLYGON.chainId,
          toToken: POLYGON.usdc,
          fromAmount: fromAmountUnits,
          fromAddress: auth.address,
          toAddress: recipient,
        });
        const outAmt = Number(quote.estimate.toAmount) / 10 ** quote.action.toToken.decimals;
        const etaMin = Math.max(1, Math.round(quote.estimate.executionDuration / 60));
        setStatus(`QUOTE: ~${outAmt.toFixed(2)} USDC via ${quote.toolDetails.name} ~${etaMin}min`);
        const result = await executeLifiBridge(signer, quote, { onProgress: setStatus });
        if (!result.finalStatus || result.finalStatus.status !== "DONE") {
          setStatus(`BRIDGED ${result.txHash.slice(0, 10)}... — DEST PENDING`);
        }
        setSendAmount("");
        void fetchAllBalances();
        return;
      }

      setStatus("CONFIRM IN WALLET...");
      // Bypass Contract.transfer() — ethers v6.16.0 chokes parsing the
      // populated tx on some wallet/chain combos ("value.nonce" BigInt
      // error). Manual eth_sendTransaction lets the wallet own nonce/gas.
      const iface = new Interface(USDC_ABI);
      const data = iface.encodeFunctionData("transfer", [
        recipient,
        parseUnits(sendAmount, 6),
      ]);
      const ethereum = window.ethereum as {
        request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      const txHash = (await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: auth.address, to: src.usdc, data }],
      })) as string;
      setStatus(`SENT ${txHash.slice(0, 10)}... — WAITING CONFIRM`);
      const receipt = await provider.waitForTransaction(txHash);
      if (receipt && receipt.status === 0) {
        setStatus(`REVERTED ${txHash.slice(0, 10)}...`);
      } else {
        setStatus(`CONFIRMED ${txHash.slice(0, 10)}...`);
      }
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

  const shortAddr = `${auth.address.slice(0, 6)}...${auth.address.slice(-4)}`;
  const loaded = usdcBal["polygon"];
  const srcUsdc = usdcBal[src.id];
  const srcNative = nativeBal[src.id];
  const srcBal = srcAsset === "usdc" ? srcUsdc : srcNative;
  const srcSym = srcAsset === "usdc" ? "USDC" : src.nativeCurrency.symbol;
  const isSelfRecipient = auth.address && recipient.toLowerCase() === auth.address.toLowerCase();

  return (
    <div className="pixel-panel border-2 border-pixel-border overflow-hidden">
      {/* ── Header: address + copy + refresh ────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-pixel-black/60 border-b border-pixel-border/60">
        <div className="w-1.5 h-1.5 bg-green-400 shrink-0 animate-pulse" />
        <span className="text-[10px] text-pixel-gray tracking-wider">WALLET</span>
        <span
          className="text-[11px] text-pixel-white font-mono flex-1 truncate"
          title={auth.address}
        >
          {shortAddr}
        </span>
        <button onClick={handleCopy} title="Copy address" className="text-[11px] text-pixel-gray hover:text-green-400 px-1">
          {copied ? "✓" : "⧉"}
        </button>
        <button onClick={() => { void fetchAllBalances(); }} title="Refresh balances" className="text-[12px] text-pixel-gray hover:text-green-400 px-1">
          ↻
        </button>
      </div>

      {/* ── LOADED: tradeable Polygon USDC ──────────────────── */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-pixel-border/60 bg-gradient-to-r from-green-400/[0.03] to-transparent">
        <div className="flex items-center gap-3">
          <ChainBadge net={POLYGON} size={32} />
          <div>
            <div className="text-[9px] text-pixel-gray tracking-[0.15em]">LOADED · POLYGON</div>
            <div className="text-[10px] text-pixel-gray font-mono">USDC.e · Polymarket</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-mono text-green-400 leading-none">
            {loaded === null || loaded === undefined ? "..." : `$${loaded.toFixed(2)}`}
          </div>
          {loaded !== null && loaded !== undefined && loaded === 0 && (
            <div className="text-[8px] text-amber-400/80 tracking-wider mt-1">FUND BELOW ↓</div>
          )}
        </div>
      </div>

      {/* ── Fund section ────────────────────────────────────── */}
      <div className="px-3 py-3 space-y-2.5 bg-pixel-black/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-pixel-white tracking-[0.15em]">FUND POLYGON USDC</span>
          <span className={`text-[9px] font-mono ${isBridge ? "text-amber-400" : "text-pixel-gray"}`}>
            {isBridge ? "bridge · via li.fi" : "direct transfer"}
          </span>
        </div>

        {/* FROM row */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-pixel-gray tracking-[0.15em] w-12 shrink-0">FROM</span>
          <div className="relative flex-1">
            <div className="flex items-center gap-2 border border-pixel-border bg-pixel-black px-2.5 h-[30px] hover:border-pixel-white/40 transition-colors">
              <ChainBadge net={src} size={18} />
              <span className="text-[11px] text-pixel-white font-mono flex-1 truncate">{src.name}</span>
              <span className="text-[10px] text-green-400/70 font-mono">
                {srcUsdc === null || srcUsdc === undefined ? "..." : `$${srcUsdc.toFixed(2)}`}
              </span>
              <span className="text-[10px] text-pixel-gray ml-0.5">▼</span>
            </div>
            <select
              value={src.id}
              onChange={(e) => setSrcId(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {NETWORKS.map((n) => {
                const u = usdcBal[n.id];
                const v = nativeBal[n.id];
                const uS = u === null || u === undefined ? "..." : `$${u.toFixed(2)}`;
                const vS = v === null || v === undefined ? "..." : `${v.toFixed(3)} ${n.nativeCurrency.symbol}`;
                return (
                  <option key={n.id} value={n.id}>
                    {n.glyph} {n.name} — {uS} USDC / {vS}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* ASSET row */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-pixel-gray tracking-[0.15em] w-12 shrink-0">ASSET</span>
          <div className="inline-flex border border-pixel-border bg-pixel-black h-[28px]">
            <button
              onClick={() => setSrcAsset("usdc")}
              className={`px-3 text-[10px] font-mono transition-colors ${
                srcAsset === "usdc"
                  ? "bg-green-400/15 text-green-400"
                  : "text-pixel-gray hover:text-pixel-white"
              }`}
            >
              USDC
            </button>
            <button
              onClick={() => setSrcAsset("native")}
              className={`px-3 text-[10px] font-mono transition-colors border-l border-pixel-border ${
                srcAsset === "native"
                  ? "bg-green-400/15 text-green-400"
                  : "text-pixel-gray hover:text-pixel-white"
              }`}
            >
              {src.nativeCurrency.symbol}
            </button>
          </div>
          <span className="text-[10px] text-pixel-gray font-mono flex-1 text-right">
            balance{" "}
            <span className={(srcBal ?? 0) > 0 ? "text-pixel-white" : "text-pixel-gray"}>
              {srcBal === null || srcBal === undefined
                ? "..."
                : srcAsset === "usdc"
                  ? `$${srcBal.toFixed(2)}`
                  : `${srcBal.toFixed(4)} ${src.nativeCurrency.symbol}`}
            </span>
          </span>
        </div>

        {/* AMOUNT row */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-pixel-gray tracking-[0.15em] w-12 shrink-0">AMT</span>
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="pixel-input-sm w-full font-mono text-[13px] pr-14 h-[30px]"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-pixel-gray font-mono pointer-events-none">
                {srcSym}
              </span>
            </div>
          </div>
          {/* Quick-amount chips (% of source balance) */}
          {srcBal !== null && srcBal !== undefined && srcBal > 0 && (
            <div className="flex items-center gap-1 pl-14">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const v = srcBal * pct;
                    // 4 decimals for native (ETH), 2 for USDC.
                    setSendAmount(srcAsset === "usdc" ? v.toFixed(2) : v.toFixed(4));
                  }}
                  className="text-[9px] px-2 h-[20px] inline-flex items-center justify-center border border-pixel-border bg-pixel-black text-pixel-gray hover:text-green-400 hover:border-green-400 font-mono tracking-wider transition-colors"
                >
                  {pct === 1 ? "MAX" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action button — full width, prominent */}
        <button
          onClick={() => { void handleSend(); }}
          disabled={busy || !sendAmount || !recipient}
          className={`w-full pixel-btn text-[12px] py-2 font-mono tracking-wider disabled:opacity-30 disabled:cursor-not-allowed ${
            isBridge
              ? "border-amber-400 text-amber-400 hover:bg-amber-400/10"
              : "border-green-400 text-green-400 hover:bg-green-400/10"
          }`}
        >
          {busy
            ? "WORKING..."
            : isBridge
              ? `BRIDGE ${sendAmount || "—"} ${srcSym} → POLYGON USDC`
              : `SEND ${sendAmount ? `$${sendAmount} USDC` : "—"}`}
        </button>

        {/* Status */}
        {status && (
          <div className={`text-[10px] font-mono break-all px-1 py-1 border-l-2 ${
            status.startsWith("ERROR") || status.startsWith("INVALID") || status.startsWith("INSUFFICIENT") || status.includes("REJECTED")
              ? "text-red-400 border-red-400"
              : status.startsWith("CONFIRMED") || status.startsWith("SENT") || status.startsWith("BRIDGED")
                ? "text-green-400 border-green-400"
                : "text-amber-400 border-amber-400"
          }`}>
            {status}
          </div>
        )}

        {/* Recipient — collapsed by default when ME */}
        {!showRecipient && isSelfRecipient ? (
          <button
            onClick={() => setShowRecipient(true)}
            className="text-[9px] text-pixel-gray hover:text-pixel-white font-mono tracking-[0.15em] underline-offset-2 hover:underline"
          >
            ⌄ SEND TO A DIFFERENT ADDRESS
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-pixel-gray tracking-[0.15em] w-12 shrink-0">TO</span>
            <input
              type="text"
              placeholder="RECIPIENT 0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className={`pixel-input-sm flex-1 font-mono text-[10px] ${
                isSelfRecipient ? "text-green-400" : ""
              }`}
              spellCheck={false}
            />
            <button
              onClick={() => { if (auth.address) { setRecipient(auth.address); setShowRecipient(false); } }}
              title="Send to self (collapse)"
              className="pixel-btn text-[10px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-green-400 hover:border-green-400 shrink-0"
            >
              ME
            </button>
          </div>
        )}
      </div>

      {/* ── Capital cap (LIVE tab only) ─────────────────────── */}
      {capital !== undefined && onCapitalChange && (
        <div className="px-3 py-2 border-t border-pixel-border/60">
          <div className="flex items-center justify-between mb-1.5">
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
            {loaded !== null && loaded !== undefined && loaded > 0 && (
              <button
                onClick={() => { onCapitalChange(Math.floor(loaded)); setCustomCapital(""); }}
                className="pixel-btn text-[10px] px-1.5 py-0.5 border-pixel-border text-pixel-gray hover:text-amber-400 hover:border-amber-400"
                title="Use full Polygon USDC balance"
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
    </div>
  );
}

// ── ChainBadge ──────────────────────────────────────────────────

function ChainBadge({ net, size = 22 }: { net: NetworkConfig; size?: number }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center font-mono leading-none"
      style={{
        width: size,
        height: size,
        background: `${net.color}1f`,
        border: `1px solid ${net.color}`,
        color: net.color,
        boxShadow: `0 0 6px ${net.color}55`,
        fontSize: Math.floor(size * 0.55),
      }}
      aria-label={net.name}
    >
      {net.glyph}
    </div>
  );
}
