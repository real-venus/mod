import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const DATA_API = "https://data-api.polymarket.com";
const PAGE = 50; // upstream caps each leaderboard page at 50

// Hourly aggregate cache. The pipeline takes 60-90s for pool=2000, so we
// run it at most once per hour per (days,minPerDay,pool) tuple. The cache
// is also persisted to disk so restarts/redeploys don't lose it and force
// every visitor to wait through a fresh run.
const AGG_TTL_MS = 60 * 60 * 1000;
const CACHE_DIR = path.join(os.tmpdir(), "polymarket-active-traders-cache");
const CACHE_DIR_READY = fs
  .mkdir(CACHE_DIR, { recursive: true })
  .catch(() => {});
type AggPayload = {
  count: number;
  candidatePool: number;
  daysWindow: number;
  minTradesPerDay: number;
  traders: Trader[];
};
type CacheEntry = { at: number; payload: AggPayload };
const aggCache = new Map<string, CacheEntry>();
const aggInFlight = new Map<string, Promise<AggPayload>>();

// Background scraper state. Tracked in module scope so we can expose
// status (current phase, last finished combo) to the client.
type WarmStatus = {
  running: boolean;
  startedAt: number;
  finishedAt: number;
  currentCombo: string | null;
  lastCombo: string | null;
  lastCount: number;
  // Per-combo last refresh time, so the UI can show "as of X minutes ago"
  perCombo: Record<string, number>;
  cycles: number;
};
declare global {
  // eslint-disable-next-line no-var
  var __polymarketWarmupState: WarmStatus | undefined;
  // eslint-disable-next-line no-var
  var __polymarketWarmupScheduled: boolean | undefined;
}
const warmStatus: WarmStatus =
  globalThis.__polymarketWarmupState ?? {
    running: false,
    startedAt: 0,
    finishedAt: 0,
    currentCombo: null,
    lastCombo: null,
    lastCount: 0,
    perCombo: {},
    cycles: 0,
  };
globalThis.__polymarketWarmupState = warmStatus;

function diskFileFor(key: string): string {
  // Bucket per (params + hour) so each hour gets its own file and the
  // previous hour's snapshot stays around for inspection/debugging.
  const hour = Math.floor(Date.now() / AGG_TTL_MS);
  return path.join(CACHE_DIR, `${encodeURIComponent(key)}.${hour}.json`);
}

async function loadFromDisk(key: string): Promise<CacheEntry | null> {
  await CACHE_DIR_READY;
  try {
    const raw = await fs.readFile(diskFileFor(key), "utf-8");
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || typeof entry.at !== "number" || !entry.payload) return null;
    if (Date.now() - entry.at >= AGG_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function saveToDisk(key: string, entry: CacheEntry): Promise<void> {
  await CACHE_DIR_READY;
  try {
    await fs.writeFile(diskFileFor(key), JSON.stringify(entry));
  } catch {
    // Best-effort — disk cache is an optimization, not load-bearing.
  }
}

type LbEntry = { proxyWallet?: string; vol?: number; pnl?: number };
type Trade = {
  timestamp?: number;
  usdcSize?: number;
  size?: number;
  price?: number;
  side?: string;
  type?: string;
  conditionId?: string;
  asset?: string;
};
type Position = {
  cashPnl?: number;
  realizedPnl?: number;
  pnl?: number;
  title?: string;
  market?: string;
};
type Trader = {
  address: string;
  volume: number;        // total in-window USDC traded (buys + sells)
  buyVolume: number;     // in-window USDC spent on BUYs
  sellVolume: number;    // in-window USDC received from SELLs
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

// Fetch a trader's recent activity up to maxPages of size PAGE.
// We deliberately go past the cutoff timestamp because the FIFO replay
// downstream needs cost-basis BUYs from BEFORE the window in order to
// score SELLs that LAND inside the window. Capped to keep the global
// fan-out bounded.
async function fetchTradeHistory(
  address: string,
  maxPages = 5,
): Promise<Trade[]> {
  const PAGE = 1000;
  const out: Trade[] = [];
  for (let offset = 0; offset < maxPages * PAGE; offset += PAGE) {
    const url = `${DATA_API}/activity?user=${address}&type=TRADE&limit=${PAGE}&offset=${offset}`;
    const batch = await getJson<Trade[]>(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

// Compute true window-bounded volume + realized pnl. Replays the
// trader's *full* available history (including pre-window BUYs) so we
// have correct cost basis when a window SELL closes a position that
// was opened earlier. Only profit/volume from trades whose timestamp
// falls inside the window is counted — earlier activity contributes
// only to cost basis, not to scores.
function computeWindowMetrics(
  trades: Trade[],
  cutoffSec: number,
): { volume: number; buyVolume: number; sellVolume: number; pnl: number; count: number } {
  const sorted = trades
    .filter((t) => (t.type ?? "TRADE") === "TRADE")
    .slice()
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  const book = new Map<string, { size: number; cost: number }>();
  let pnl = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let count = 0;
  for (const t of sorted) {
    const ts = Number(t.timestamp || 0);
    const inWindow = ts >= cutoffSec;
    const key = String(t.conditionId || t.asset || "");
    const price = Number(t.price || 0);
    const size = Number(t.size || 0);
    const usd = Number(t.usdcSize ?? price * size);
    const side = String(t.side || "").toUpperCase();
    const pos = book.get(key) || { size: 0, cost: 0 };

    if (side === "BUY") {
      pos.cost += price * size;
      pos.size += size;
    } else if (pos.size > 0) {
      const avg = pos.cost / pos.size;
      const sold = Math.min(size, pos.size);
      const realized = (price - avg) * sold;
      pos.cost -= avg * sold;
      pos.size -= sold;
      if (inWindow) pnl += realized;
    }
    book.set(key, pos);

    if (inWindow) {
      if (side === "BUY") buyVolume += usd;
      else if (side === "SELL") sellVolume += usd;
      count += 1;
    }
  }
  return { volume: buyVolume + sellVolume, buyVolume, sellVolume, pnl, count };
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

function jsonWithCache(payload: AggPayload, hit: boolean, ageMs: number, source: "memory" | "disk" | "fresh") {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      "X-Cache": hit ? "HIT" : "MISS",
      "X-Cache-Source": source,
      "X-Cache-Age": String(Math.floor(ageMs / 1000)),
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Status probe — returns the background scraper's state without
  // touching the (potentially long-running) pipeline.
  if (searchParams.get("status") === "1") {
    return NextResponse.json(warmStatus, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const days = Math.max(1, Math.min(30, Number(searchParams.get("days") || 7)));
  const minPerDay = Math.max(0, Number(searchParams.get("minPerDay") || 1));
  const pool = Math.max(50, Math.min(2000, Number(searchParams.get("pool") || 1000)));
  const stream = searchParams.get("stream") === "1";

  const cacheKey = `${days}:${minPerDay}:${pool}`;

  // 1. Memory cache — instant.
  const memHit = aggCache.get(cacheKey);
  if (memHit && Date.now() - memHit.at < AGG_TTL_MS) {
    if (stream) return streamCachedResult(memHit.payload, "memory");
    return jsonWithCache(memHit.payload, true, Date.now() - memHit.at, "memory");
  }

  // 2. Disk cache — survives restarts. Hydrate memory if found.
  const diskHit = await loadFromDisk(cacheKey);
  if (diskHit) {
    aggCache.set(cacheKey, diskHit);
    if (stream) return streamCachedResult(diskHit.payload, "disk");
    return jsonWithCache(diskHit.payload, true, Date.now() - diskHit.at, "disk");
  }

  // 3. Streaming cold miss: emit progress events while running the pipeline.
  if (stream) {
    return streamPipeline({ days, minPerDay, pool, cacheKey });
  }

  // 4. Non-streaming cold miss: coalesce concurrent callers and return JSON.
  const inFlight = aggInFlight.get(cacheKey);
  if (inFlight) {
    const payload = await inFlight;
    return jsonWithCache(payload, true, 0, "memory");
  }

  const work = (async (): Promise<AggPayload> => {
    const payload = await runPipeline({ days, minPerDay, pool });
    const entry: CacheEntry = { at: Date.now(), payload };
    aggCache.set(cacheKey, entry);
    await saveToDisk(cacheKey, entry);
    return payload;
  })();
  aggInFlight.set(cacheKey, work);
  try {
    const payload = await work;
    return jsonWithCache(payload, false, 0, "fresh");
  } finally {
    aggInFlight.delete(cacheKey);
  }
}

const ndjsonHeaders: HeadersInit = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
};

// Cache hits served via the stream API: emit a single result event so the
// client takes the same code path regardless of source.
function streamCachedResult(payload: AggPayload, source: "memory" | "disk"): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(JSON.stringify({ type: "result", source, ...payload }) + "\n"));
      c.close();
    },
  });
  return new Response(body, { headers: ndjsonHeaders });
}

function streamPipeline(args: {
  days: number; minPerDay: number; pool: number; cacheKey: string;
}): Response {
  const { days, minPerDay, pool, cacheKey } = args;
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const payload = await runPipeline(
          { days, minPerDay, pool },
          (info) => send({ type: "progress", ...info }),
          (traders) => send({ type: "partial", traders }),
        );
        const entry: CacheEntry = { at: Date.now(), payload };
        aggCache.set(cacheKey, entry);
        await saveToDisk(cacheKey, entry);
        send({ type: "result", source: "fresh", ...payload });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });
  return new Response(body, { headers: ndjsonHeaders });
}

type ProgressEvent =
  | { phase: "leaderboard"; done: number; total: number }
  | {
      phase: "enrich";
      done: number;
      total: number;
      kept: number;
      // Average "scrape depth" across enriched traders so far, in
      // hours back from now. Targets the requested window so the
      // client can show e.g. "120h / 168h scraped".
      hoursScraped: number;
      hoursTarget: number;
    };

async function runPipeline(
  args: { days: number; minPerDay: number; pool: number },
  onProgress?: (e: ProgressEvent) => void,
  onPartial?: (traders: Trader[]) => void,
): Promise<AggPayload> {
  const { days, minPerDay, pool } = args;
  const minTrades = Math.ceil(days * minPerDay);
  const cutoffSec = Math.floor((Date.now() - days * 86400_000) / 1000);
  const pages = Math.ceil(pool / PAGE);

  // 1. Paginate the leaderboard by both PNL and VOL using the upstream
  //    timePeriod that best matches the requested window. Without this
  //    the leaderboard pnl/vol numbers are always weekly, so the table
  //    looks identical for 1D, 7D, 14D, and 30D — that's the bug.
  const timePeriod: "DAY" | "WEEK" | "MONTH" | "ALL" =
    days <= 1 ? "DAY"
    : days <= 7 ? "WEEK"
    : days <= 30 ? "MONTH"
    : "ALL";
  const lbTotal = pages * 2;
  const lbPages: (LbEntry[] | null)[] = new Array(lbTotal);
  let lbDone = 0;
  onProgress?.({ phase: "leaderboard", done: 0, total: lbTotal });
  let slot = 0;
  const lbPromises: Promise<void>[] = [];
  for (const orderBy of ["PNL", "VOL"] as const) {
    for (let p = 0; p < pages; p++) {
      const idx = slot++;
      const url = `${DATA_API}/v1/leaderboard?timePeriod=${timePeriod}&orderBy=${orderBy}&limit=${PAGE}&offset=${p * PAGE}`;
      lbPromises.push(
        getJson<LbEntry[]>(url).then((r) => {
          lbPages[idx] = r;
          lbDone++;
          onProgress?.({ phase: "leaderboard", done: lbDone, total: lbTotal });
        }),
      );
    }
  }
  await Promise.all(lbPromises);

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
          buyVolume: 0,
          sellVolume: 0,
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
  //    Filter to those with ≥ minTrades trades inside the window. Emit
  //    progress events every few candidates so the client can show a real
  //    bar (this is the long phase — most of the wall-clock time is here).
  const candArr = Array.from(candidates.values());
  const enrichTotal = candArr.length;
  let enrichDone = 0;
  let enrichKept = 0;
  onProgress?.({ phase: "enrich", done: 0, total: enrichTotal, kept: 0 });
  const PROGRESS_EVERY = Math.max(1, Math.floor(enrichTotal / 50));
  // 64-way concurrency keeps upstream happy and finishes ~2× faster than
  // the prior 32. Polymarket's data API is lightweight per-call; the
  // bottleneck is just round-trips.
  // Track completed survivors so we can stream a sorted partial list to
  // the client every PROGRESS_EVERY ticks. The client uses this to
  // populate the leaderboard while the rest of the pipeline is still
  // running, instead of waiting for the final result event.
  const completed: Trader[] = [];

  // Per-trader scrape depth (oldest-trade age in seconds back from now).
  // We average these to produce a rough "hours scraped" metric for the
  // streaming progress bar — a depth of `days*24` h means full window
  // coverage on average.
  const oldestSecPerTrader: number[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const hoursTarget = days * 24;

  const tickProgress = () => {
    enrichDone++;
    if (enrichDone === enrichTotal || enrichDone % PROGRESS_EVERY === 0) {
      const avgOldestSec =
        oldestSecPerTrader.length === 0
          ? nowSec
          : oldestSecPerTrader.reduce((a, b) => a + b, 0) /
            oldestSecPerTrader.length;
      const hoursScraped = Math.max(0, (nowSec - avgOldestSec) / 3600);
      onProgress?.({
        phase: "enrich",
        done: enrichDone,
        total: enrichTotal,
        kept: enrichKept,
        hoursScraped,
        hoursTarget,
      });
      if (onPartial && completed.length > 0) {
        // Snapshot + sort by volume, same ordering as the final result.
        // Slice() so the consumer can't mutate our internal array.
        const snap = completed.slice().sort((a, b) => b.volume - a.volume);
        onPartial(snap);
      }
    }
  };

  const enriched = await pMap(candArr, 64, async (t) => {
    // Paginate /activity. We deliberately go past the window cutoff
    // so the FIFO replay has cost-basis BUYs for window SELLs that
    // closed positions opened earlier. Capped at 5 pages of 1000 so
    // mega-active traders can't stall the cycle.
    const [trades, positionsRaw] = await Promise.all([
      fetchTradeHistory(t.address, 5),
      getJson<Position[]>(`${DATA_API}/positions?user=${t.address}&limit=500`),
    ]);

    // Record this trader's deepest trade timestamp for the global
    // "hours scraped" progress aggregate. If they have no trades
    // (shouldn't happen for leaderboard candidates), skip.
    if (trades.length > 0) {
      let oldest = Number.POSITIVE_INFINITY;
      for (const tr of trades) {
        const ts = Number(tr.timestamp || 0);
        if (ts > 0 && ts < oldest) oldest = ts;
      }
      if (Number.isFinite(oldest)) oldestSecPerTrader.push(oldest);
    }

    // Strictly window-bounded volume + realized pnl. SELLs without a
    // matching BUY *inside the window* are skipped — their cost basis
    // belongs to an earlier period and counting them here would
    // attribute outside profit to this window.
    const m = computeWindowMetrics(trades, cutoffSec);
    if (m.count < minTrades) {
      tickProgress();
      return null;
    }
    t.recentTrades = m.count;
    t.volume = m.volume;
    t.buyVolume = m.buyVolume;
    t.sellVolume = m.sellVolume;
    t.pnl = m.pnl;

    const positions = Array.isArray(positionsRaw) ? positionsRaw : [];
    t.positions = positions.length;
    t.marketTitles = positions
      .map((p) => p.title || p.market || "")
      .filter(Boolean)
      .slice(0, 20);
    // Win rate: only count positions with realized (closed) P&L. cashPnl
    // would also include unrealized gains on open positions, which can
    // produce a 100% win rate on a trader who's actually deeply negative
    // for the period — the /positions endpoint only returns currently
    // OPEN positions, masking past losses.
    const realizedOf = (p: Position) => Number(p.realizedPnl ?? 0);
    const closed = positions.filter((p) => realizedOf(p) !== 0);
    if (closed.length > 0) {
      t.winRate = Math.round(
        (closed.filter((p) => realizedOf(p) > 0).length / closed.length) * 100,
      );
    } else {
      t.winRate = -1; // sentinel: no closed positions to score
    }
    enrichKept++;
    completed.push(t);
    tickProgress();
    return t;
  });

  const out = enriched
    .filter((t): t is Trader => t !== null)
    .sort((a, b) => b.volume - a.volume);

  return {
    count: out.length,
    candidatePool: candArr.length,
    daysWindow: days,
    minTradesPerDay: minPerDay,
    traders: out,
  };
}

// ── Background scraper ─────────────────────────────────────────────
//
// Continuously pre-warms the cache for the most common (days, pool)
// combos so visitors hit warm data on every page load. Runs once at
// module load, then again every hour. Disk-persisted so a restart
// doesn't reset the warm window.

const WARM_COMBOS: { days: number; minPerDay: number; pool: number }[] = [
  { days: 1,  minPerDay: 1, pool: 2000 },
  { days: 7,  minPerDay: 1, pool: 2000 },
  { days: 14, minPerDay: 1, pool: 2000 },
  { days: 30, minPerDay: 1, pool: 2000 },
];

async function warmupCycle(): Promise<void> {
  if (warmStatus.running) return;
  warmStatus.running = true;
  warmStatus.startedAt = Date.now();
  warmStatus.finishedAt = 0;
  try {
    for (const combo of WARM_COMBOS) {
      const key = `${combo.days}:${combo.minPerDay}:${combo.pool}`;
      warmStatus.currentCombo = key;
      // Skip if a fresh entry already exists — saves work on rapid restarts.
      const existing = aggCache.get(key) ?? (await loadFromDisk(key));
      if (existing && Date.now() - existing.at < AGG_TTL_MS) {
        aggCache.set(key, existing);
        warmStatus.perCombo[key] = existing.at;
        warmStatus.lastCombo = key;
        warmStatus.lastCount = existing.payload.count;
        continue;
      }
      try {
        const payload = await runPipeline(combo);
        const entry: CacheEntry = { at: Date.now(), payload };
        aggCache.set(key, entry);
        await saveToDisk(key, entry);
        warmStatus.perCombo[key] = entry.at;
        warmStatus.lastCombo = key;
        warmStatus.lastCount = payload.count;
      } catch {
        // Best-effort — failed combos retry next cycle.
      }
    }
  } finally {
    warmStatus.currentCombo = null;
    warmStatus.finishedAt = Date.now();
    warmStatus.cycles += 1;
    warmStatus.running = false;
  }
}

// Schedule once per process. Runtime imports the route module at first
// request (Next.js dev) or at startup (production); either way we want
// exactly one timer.
if (!globalThis.__polymarketWarmupScheduled) {
  globalThis.__polymarketWarmupScheduled = true;
  // Initial warm — give the server a few seconds after boot to settle.
  setTimeout(() => { void warmupCycle(); }, 5_000);
  setInterval(() => { void warmupCycle(); }, AGG_TTL_MS);
}

// Status endpoint — accessible via the same route with ?status=1.
// Surfaced so the UI can show "background scraper running, last
// updated X minutes ago" without polling N separate keys.
export function getWarmStatus(): WarmStatus {
  return warmStatus;
}
