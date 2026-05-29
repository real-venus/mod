"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCopy } from "../lib/api";

export default function CopyForm({
  defaultTarget,
}: {
  defaultTarget?: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(defaultTarget || "");
  const [hotkey, setHotkey] = useState("");
  const [maxPerTx, setMaxPerTx] = useState("10");
  const [dailyLimit, setDailyLimit] = useState("100");
  const [threshold, setThreshold] = useState("5");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createCopy({
        target_ss58: target,
        our_hotkey: hotkey,
        max_tao_per_tx: parseFloat(maxPerTx),
        daily_limit_tao: parseFloat(dailyLimit),
        rebalance_threshold_pct: parseFloat(threshold),
      });
      router.push("/copy");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm text-muted mb-1">
          Target SS58 Address
        </label>
        <input
          required
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="5..."
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm text-muted mb-1">
          Your Hotkey SS58
        </label>
        <input
          required
          value={hotkey}
          onChange={(e) => setHotkey(e.target.value)}
          placeholder="5..."
          className="w-full"
        />
        <p className="text-xs text-muted mt-1">
          The hotkey you want to stake through
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-muted mb-1">Max TAO/tx</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={maxPerTx}
            onChange={(e) => setMaxPerTx(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Daily limit</label>
          <input
            type="number"
            step="1"
            min="0"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Threshold %</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {error && <p className="text-negative text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary"
      >
        {submitting ? "Creating..." : "Start Copy Trading"}
      </button>
    </form>
  );
}
