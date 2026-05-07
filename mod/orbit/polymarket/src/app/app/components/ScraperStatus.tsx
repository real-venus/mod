"use client";

import { useEffect, useState } from "react";

type WarmStatus = {
  running: boolean;
  startedAt: number;
  finishedAt: number;
  currentCombo: string | null;
  lastCombo: string | null;
  lastCount: number;
  perCombo: Record<string, number>;
  cycles: number;
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function ago(ts: number): string {
  if (!ts) return "—";
  const ms = Date.now() - ts;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

// Compact strip showing the background scraper state. Polls every 5s
// while it's actively running (so the user sees the bar move) and
// every 30s otherwise. Doesn't make HTTP requests if the user navigates
// away because we clean up the interval.
export default function ScraperStatus() {
  const [status, setStatus] = useState<WarmStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`${BASE}/api/polymarket/active-traders?status=1`);
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as WarmStatus;
        if (!cancelled) setStatus(j);
        if (!cancelled) {
          timer = setTimeout(tick, j.running ? 5_000 : 30_000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 30_000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!status) {
    return (
      <div className="pixel-panel p-2 text-[9px] text-pixel-gray font-mono flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-pixel-gray animate-pulse" />
        SCRAPER ?
      </div>
    );
  }

  const combos = Object.entries(status.perCombo).sort();
  return (
    <div className="pixel-panel p-2 text-[9px] font-mono flex items-center gap-3 flex-wrap">
      {status.running ? (
        <div className="flex items-center gap-1.5 text-pixel-green">
          <div className="w-1.5 h-1.5 bg-pixel-green animate-pulse" />
          <span className="glow-green">SCRAPING</span>
          {status.currentCombo && (
            <span className="text-pixel-gray-light">· {status.currentCombo}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-pixel-gray">
          <div className="w-1.5 h-1.5 bg-pixel-gray-light" />
          <span>IDLE</span>
        </div>
      )}
      <span className="text-pixel-gray">·</span>
      <span className="text-pixel-gray">CYCLES {status.cycles}</span>
      {status.finishedAt > 0 && (
        <>
          <span className="text-pixel-gray">·</span>
          <span className="text-pixel-gray">LAST CYCLE {ago(status.finishedAt)}</span>
        </>
      )}
      {combos.length > 0 && (
        <>
          <span className="text-pixel-gray">·</span>
          <div className="flex items-center gap-2 flex-wrap">
            {combos.map(([k, ts]) => (
              <span key={k} className="text-pixel-gray-light">
                {k.split(":")[0]}D <span className="text-pixel-gray">({ago(ts)})</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
