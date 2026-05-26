"use client";

// One-time gate: until the user approves USDC.e + CTF shares to the
// Polymarket exchange + negRisk adapter, the CLOB's balance-allowance
// returns $0 regardless of wallet balance. This panel surfaces what's
// approved and runs any missing approvals via the connected wallet.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  ApprovalStatus,
  executeApprovals,
  readApprovals,
} from "../lib/polymarketApprovals";

interface Props {
  /** Called once approvals are confirmed complete, so the parent can
   *  refresh dependent state (CLOB balance, checklist, etc.). */
  onComplete?: () => void;
}

export default function EnableTradingPanel({ onComplete }: Props) {
  const { auth } = useAuth();
  const [status, setStatus] = useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.address) return;
    setLoading(true);
    try {
      const s = await readApprovals(auth.address);
      setStatus(s);
      if (s.allApproved) onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [auth.address, onComplete]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleEnable = async () => {
    if (!auth.address || !status) return;
    if (typeof window === "undefined" || !window.ethereum) {
      setError("NO_WALLET");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ethereum = window.ethereum as {
        request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      const updated = await executeApprovals(ethereum, auth.address, status, (p) => {
        setProgress(`${p.step}/${p.total} ${p.label}`);
      });
      setStatus(updated);
      setProgress(null);
      if (updated.allApproved) onComplete?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.toLowerCase().includes("user reject") ? "USER_REJECTED" : msg.slice(0, 160));
    } finally {
      setBusy(false);
    }
  };

  if (!auth.address) return null;

  // Hide the panel once everything is approved; keep DOM stable for the
  // first paint so the layout doesn't jump while we read allowances.
  if (status?.allApproved) {
    return (
      <div className="pixel-panel border-2 border-pixel-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-400" />
          <span className="text-[11px] text-pixel-white tracking-wider">TRADING ENABLED</span>
          <span className="text-[10px] text-pixel-gray">— USDC + shares approved for Polymarket</span>
        </div>
        <button
          onClick={() => { void refresh(); }}
          className="text-[10px] text-pixel-gray hover:text-pixel-white px-1"
          title="Re-check approvals"
        >
          ↻
        </button>
      </div>
    );
  }

  const totalMissing = status
    ? Object.values(status.usdc).filter((v) => v < (BigInt(1) << BigInt(128))).length +
      Object.values(status.ctf).filter((v) => !v).length
    : 0;

  return (
    <div className="pixel-panel border-2 border-amber-400/40 bg-amber-400/[0.03]">
      <div className="px-3 py-2 border-b border-amber-400/30">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-amber-400 animate-pulse" />
          <span className="text-[12px] text-amber-400 tracking-wider">ENABLE TRADING</span>
          {loading && <span className="text-[10px] text-pixel-gray animate-pulse">checking…</span>}
        </div>
        <p className="text-[11px] text-pixel-gray leading-relaxed">
          Polymarket needs one-time approval to pull USDC.e and outcome shares from your wallet when
          orders fill. {totalMissing > 0 && `${totalMissing} approval${totalMissing === 1 ? "" : "s"} pending.`}
        </p>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-pixel-gray font-mono">
          {busy && progress ? progress : busy ? "WORKING…" : `${totalMissing} TX${totalMissing === 1 ? "" : "S"} TO SIGN`}
        </span>
        <button
          onClick={() => { void handleEnable(); }}
          disabled={busy || !status || totalMissing === 0}
          className="pixel-btn text-[11px] px-3 py-1 border-amber-400 text-amber-400 hover:bg-amber-400/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {busy ? "APPROVING…" : "ENABLE TRADING"}
        </button>
      </div>
      {error && (
        <div className="px-3 py-1.5 border-t border-red-400/30 text-[10px] text-red-400 font-mono break-all">
          {error}
        </div>
      )}
    </div>
  );
}
