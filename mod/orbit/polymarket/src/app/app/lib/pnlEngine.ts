import { PolymarketTrade, PolymarketPosition } from "./types";
import { CurvePoint } from "../components/PnlChart";

export interface AnnotatedTrade extends PolymarketTrade {
  realized: number;
  hasBasis: boolean;
  buyPrice?: number;
  buyTimestamp?: number;
}

/**
 * Replay full trade history with FIFO bookkeeping.
 * Returns trades annotated with realized PnL per SELL.
 */
export function computeFifoTrades(
  trades: PolymarketTrade[],
  positions: PolymarketPosition[],
): AnnotatedTrade[] {
  const seedAvgPrice = new Map<string, number>();
  for (const p of positions) {
    const key = p.conditionId || p.market;
    if (key && p.avgPrice > 0) seedAvgPrice.set(key, p.avgPrice);
  }
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  type BuyLot = { price: number; size: number; ts: number };
  const book = new Map<string, BuyLot[]>();

  return sorted.map((t) => {
    const key = t.conditionId || t.market;
    if (!book.has(key)) book.set(key, []);
    const lots = book.get(key)!;

    let realized = 0;
    let hasBasis = true;
    let buyPrice: number | undefined;
    let buyTimestamp: number | undefined;

    if (t.side === "BUY") {
      lots.push({ price: t.price, size: t.size, ts: t.timestamp });
    } else {
      let remaining = t.size;
      let totalCost = 0;
      let totalFilled = 0;
      let earliestBuyTs = Infinity;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.size);
        totalCost += lot.price * take;
        totalFilled += take;
        if (lot.ts < earliestBuyTs) earliestBuyTs = lot.ts;
        lot.size -= take;
        remaining -= take;
        if (lot.size <= 1e-9) lots.shift();
      }

      if (totalFilled > 0) {
        const avgEntry = totalCost / totalFilled;
        realized = (t.price - avgEntry) * totalFilled;
        buyPrice = avgEntry;
        buyTimestamp = earliestBuyTs;
      } else if (seedAvgPrice.has(key)) {
        const seed = seedAvgPrice.get(key) || 0;
        realized = (t.price - seed) * t.size;
        buyPrice = seed;
      } else {
        hasBasis = false;
      }
    }

    return { ...t, realized, hasBasis, buyPrice, buyTimestamp };
  });
}

/**
 * Build MTM PnL curve for a single trader within a time window.
 */
export function buildPnlCurve(
  annotatedTrades: AnnotatedTrade[],
  positions: PolymarketPosition[],
  cutoffMs: number,
): CurvePoint[] {
  const windowTrades = annotatedTrades.filter((t) => t.timestamp >= cutoffMs);
  if (!windowTrades.length) return [];
  const sorted = [...windowTrades].sort((a, b) => a.timestamp - b.timestamp);

  const curByKey = new Map<string, number>();
  for (const p of positions) {
    const key = p.conditionId || p.market;
    if (key && p.currentPrice > 0) curByKey.set(key, p.currentPrice);
  }

  const inv = new Map<string, number>();
  const lastPx = new Map<string, number>();
  let cash = 0;
  const markFor = (key: string) => curByKey.get(key) ?? lastPx.get(key) ?? 0;

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const points: CurvePoint[] = sorted.map((t, i) => {
    const key = t.conditionId || t.market;
    if (t.side === "BUY") {
      cash -= t.price * t.size;
      inv.set(key, (inv.get(key) || 0) + t.size);
    } else {
      cash += t.price * t.size;
      inv.set(key, (inv.get(key) || 0) - t.size);
    }
    lastPx.set(key, t.price);

    let invValue = 0;
    for (const [k, s] of inv) {
      if (s !== 0) invValue += s * markFor(k);
    }
    const mtm = cash + invValue;

    return {
      i,
      ts: t.timestamp,
      date: fmtDate(t.timestamp),
      time: fmtTime(t.timestamp),
      pnl: Math.round(mtm * 100) / 100,
      side: t.side,
      realized: t.realized,
      market: t.market,
      size: t.size,
      price: t.price,
      buyPrice: t.buyPrice,
      buyTimestamp: t.buyTimestamp,
    };
  });

  // Append "NOW" mark for open inventory
  let nowInvValue = 0;
  let hasOpenInventory = false;
  for (const [k, s] of inv) {
    if (Math.abs(s) < 1e-9) continue;
    nowInvValue += s * markFor(k);
    hasOpenInventory = true;
  }
  if (hasOpenInventory) {
    const nowTs = Date.now();
    const nowMtm = cash + nowInvValue;
    points.push({
      i: points.length,
      ts: nowTs,
      date: fmtDate(nowTs),
      time: "NOW",
      pnl: Math.round(nowMtm * 100) / 100,
      side: "MARK",
      realized: 0,
      market: "",
      size: 0,
      price: 0,
    });
  }

  return points;
}

/**
 * Combine multiple traders' PnL curves into a single weighted index curve.
 *
 * Algorithm:
 *  1. Collect all timestamps across all traders
 *  2. Sort chronologically
 *  3. At each timestamp, step-interpolate each trader's PnL
 *  4. Combined PnL = sum(trader_pnl * weight)
 *  5. Downsample to maxPoints for SVG performance
 */
export function buildCombinedPnlCurve(
  traderCurves: { address: string; points: CurvePoint[]; weight: number }[],
  maxPoints = 300,
): CurvePoint[] {
  // Collect all unique timestamps
  const allTs = new Set<number>();
  for (const tc of traderCurves) {
    for (const p of tc.points) allTs.add(p.ts);
  }
  if (allTs.size === 0) return [];

  const sortedTs = Array.from(allTs).sort((a, b) => a - b);

  // For each timestamp, compute weighted sum of each trader's PnL
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const rawPoints: CurvePoint[] = sortedTs.map((ts, i) => {
    let combinedPnl = 0;
    for (const tc of traderCurves) {
      if (tc.points.length === 0) continue;
      // Step-interpolate: find last point at or before ts
      let traderPnl = 0;
      for (let j = tc.points.length - 1; j >= 0; j--) {
        if (tc.points[j].ts <= ts) {
          traderPnl = tc.points[j].pnl;
          break;
        }
      }
      combinedPnl += traderPnl * tc.weight;
    }

    return {
      i,
      ts,
      date: fmtDate(ts),
      time: fmtTime(ts),
      pnl: Math.round(combinedPnl * 100) / 100,
      side: "MARK" as const,
      realized: 0,
      market: "",
      size: 0,
      price: 0,
    };
  });

  // Downsample if too many points
  if (rawPoints.length <= maxPoints) return rawPoints;

  const step = rawPoints.length / maxPoints;
  const downsampled: CurvePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.floor(i * step), rawPoints.length - 1);
    downsampled.push({ ...rawPoints[idx], i });
  }
  // Always include the last point
  if (downsampled[downsampled.length - 1].ts !== rawPoints[rawPoints.length - 1].ts) {
    downsampled.push({ ...rawPoints[rawPoints.length - 1], i: downsampled.length });
  }

  return downsampled;
}
