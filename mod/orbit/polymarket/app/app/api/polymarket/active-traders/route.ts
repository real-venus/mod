import { NextRequest, NextResponse } from "next/server";

const DATA_API = "https://data-api.polymarket.com";
const PAGE = 50; // upstream caps each leaderboard page at 50

type LbEntry = { proxyWallet?: string; vol?: number; pnl?: number };
type Trade = { timestamp?: number };
type Position = { pnl?: number; market?: string };
type Trader = {
  address: string;
  volume: number;
  pnl: number;
  winRate: number;
  positions: number;
  marketTitles: string[];
  recentTrades: number;
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Run an array of async tasks with bounded concurrency.
async function pMap<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = Math.max(1, Math.min(30, Number(searchParams.get("days") || 7)));
  const minPerDay = Math.max(0, Number(searchParams.get("minPerDay") || 1));
  const pool = Math.max(50, Math.min(500, Number(searchParams.get("pool") || 250)));

  const minTrades = Math.ceil(days * minPerDay);
  const cutoffSec = Math.floor((Date.now() - days * 86400_000) / 1000);
  const pages = Math.ceil(pool / PAGE);

  // 1. Paginate WEEK leaderboard by both PNL and VOL.
  const lbReqs: Promise<LbEntry[] | null>[] = [];
  for (const orderBy of ["PNL", "VOL"] as const) {
    for (let p = 0; p < pages; p++) {
      lbReqs.push(
        getJson<LbEntry[]>(
          `${DATA_API}/v1/leaderboard?timePeriod=WEEK&orderBy=${orderBy}&limit=${PAGE}&offset=${p * PAGE}`,
        ),
      );
    }
  }
  const lbPages = await Promise.all(lbReqs);

  const candidates = new Map<string, Trader>();
  for (const page of lbPages) {
    if (!Array.isArray(page)) continue;
    for (const e of page) {
      const addr = String(e.proxyWallet || "").toLowerCase();
      if (!addr || addr === "undefined") continue;
      const existing = candidates.get(addr);
      const vol = Number(e.vol || 0);
      const pnl = Number(e.pnl || 0);
      if (existing) {
        existing.volume = Math.max(existing.volume, vol);
        if (Math.abs(pnl) > Math.abs(existing.pnl)) existing.pnl = pnl;
      } else {
        candidates.set(addr, {
          address: addr,
          volume: vol,
          pnl,
          winRate: 0,
          positions: 0,
          marketTitles: [],
          recentTrades: 0,
        });
      }
    }
  }

  // 2. For each candidate, fetch trades + positions with bounded concurrency.
  //    Filter to those with ≥ minTrades trades inside the window.
  const candArr = Array.from(candidates.values());
  const enriched = await pMap(candArr, 16, async (t) => {
    const [tradesRaw, positionsRaw] = await Promise.all([
      getJson<Trade[]>(`${DATA_API}/activity?user=${t.address}&type=TRADE&limit=200`),
      getJson<Position[]>(`${DATA_API}/positions?user=${t.address}&limit=200`),
    ]);

    const trades = Array.isArray(tradesRaw) ? tradesRaw : [];
    const recent = trades.filter((tr) => Number(tr.timestamp || 0) >= cutoffSec);
    if (recent.length < minTrades) return null;
    t.recentTrades = recent.length;

    const positions = Array.isArray(positionsRaw) ? positionsRaw : [];
    t.positions = positions.length;
    t.marketTitles = positions.map((p) => p.market || "").filter(Boolean).slice(0, 20);
    const withPnl = positions.filter((p) => Number(p.pnl || 0) !== 0);
    if (withPnl.length > 0) {
      t.winRate = Math.round(
        (withPnl.filter((p) => Number(p.pnl || 0) > 0).length / withPnl.length) * 100,
      );
    }
    return t;
  });

  const out = enriched
    .filter((t): t is Trader => t !== null)
    .sort((a, b) => b.volume - a.volume);

  return NextResponse.json({
    count: out.length,
    candidatePool: candArr.length,
    daysWindow: days,
    minTradesPerDay: minPerDay,
    traders: out,
  });
}
