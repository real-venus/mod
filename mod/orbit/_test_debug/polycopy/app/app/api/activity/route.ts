import { NextRequest, NextResponse } from "next/server";

const LLAMA_API = "https://api.llama.fi";
const GAMMA_API = "https://gamma-api.polymarket.com";

interface DailyDataPoint {
  date: string;
  timestamp: number;
  uniswapVolume: number;
  uniswapTrades: number;
  polymarketVolume: number;
  polymarketTrades: number;
}

const CHAIN_LLAMA_MAP: Record<number, string> = {
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  1: "Ethereum",
};

export async function GET(req: NextRequest) {
  const chainId = parseInt(req.nextUrl.searchParams.get("chainId") || "137");
  const chainName = CHAIN_LLAMA_MAP[chainId] || "Polygon";

  const [uniResult, polyResult] = await Promise.allSettled([
    fetchUniswapVolume(chainName),
    fetchPolymarketVolume(),
  ]);

  const uniMap = uniResult.status === "fulfilled" ? uniResult.value : new Map<string, number>();
  const polyMap =
    polyResult.status === "fulfilled"
      ? polyResult.value
      : new Map<string, { volume: number; trades: number }>();

  // Build 30-day date range
  const points: DailyDataPoint[] = [];
  const now = Date.now();
  for (let d = 29; d >= 0; d--) {
    const dayTs = now - d * 86400000;
    const date = new Date(dayTs).toISOString().split("T")[0];
    const polyDay = polyMap.get(date) || { volume: 0, trades: 0 };
    points.push({
      date,
      timestamp: new Date(date).getTime(),
      uniswapVolume: Math.round(uniMap.get(date) || 0),
      uniswapTrades: 0,
      polymarketVolume: Math.round(polyDay.volume),
      polymarketTrades: polyDay.trades,
    });
  }

  return NextResponse.json(points);
}

async function fetchUniswapVolume(chainName: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  try {
    const res = await fetch(
      `${LLAMA_API}/summary/dexs/uniswap-v3?dataType=dailyVolume`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return map;
    const data = await res.json();

    const breakdown: [number, Record<string, Record<string, number>>][] =
      data?.totalDataChartBreakdown || [];
    const cutoff = Date.now() - 30 * 86400 * 1000;

    for (const [ts, chains] of breakdown) {
      if (ts * 1000 < cutoff) continue;
      const date = new Date(ts * 1000).toISOString().split("T")[0];
      let vol = 0;
      for (const [chain, protocols] of Object.entries(chains)) {
        if (chain.toLowerCase() === chainName.toLowerCase()) {
          for (const v of Object.values(protocols)) {
            vol += typeof v === "number" ? v : 0;
          }
        }
      }
      if (vol > 0) map.set(date, vol);
    }

    // Fallback to total if no chain breakdown found
    if (map.size === 0) {
      const chart: [number, number][] = data?.totalDataChart || [];
      for (const [ts, vol] of chart) {
        if (ts * 1000 < cutoff) continue;
        const date = new Date(ts * 1000).toISOString().split("T")[0];
        map.set(date, vol);
      }
    }
  } catch {
    // silent
  }

  return map;
}

async function fetchPolymarketVolume(): Promise<Map<string, { volume: number; trades: number }>> {
  const map = new Map<string, { volume: number; trades: number }>();

  try {
    const res = await fetch(
      `${GAMMA_API}/markets?active=true&closed=false&limit=100&order=volume&ascending=false`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return map;
    const markets: { volume?: string; startDate?: string }[] = await res.json();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400 * 1000;

    for (const m of markets) {
      const totalVol = parseFloat(m.volume || "0");
      if (totalVol <= 0) continue;

      const start = m.startDate ? new Date(m.startDate).getTime() : thirtyDaysAgo;
      const effectiveStart = Math.max(start, thirtyDaysAgo);
      const daySpan = Math.max(1, Math.ceil((now - effectiveStart) / 86400000));
      const dailyVol = totalVol / daySpan;

      for (let d = 0; d < daySpan && d < 30; d++) {
        const dayTs = now - d * 86400000;
        const date = new Date(dayTs).toISOString().split("T")[0];
        const existing = map.get(date) || { volume: 0, trades: 0 };
        existing.volume += dailyVol;
        existing.trades += Math.max(1, Math.round(dailyVol / 50));
        map.set(date, existing);
      }
    }
  } catch {
    // silent
  }

  return map;
}
