import { PolymarketMarket, PolymarketTrade, PolymarketPosition } from "./types";

// ── Top Trader type ─────────────────────────────────────────────
export interface TopTrader {
  address: string;
  volume: number;        // total in-window USDC traded
  buyVolume: number;     // in-window USDC on BUYs
  sellVolume: number;    // in-window USDC on SELLs
  pnl: number;
  winRate: number;
  positions: number;
  marketTitles: string[];
  pnlCurve?: number[];   // ~12-point cumulative PnL over the window
}

// ── Formatting helpers ──────────────────────────────────────────

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

export function formatPnl(pnl: number): string {
  const prefix = pnl >= 0 ? "+$" : "-$";
  const abs = Math.abs(pnl);
  if (abs >= 1_000_000) return `${prefix}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}${abs.toFixed(2)}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  return `${days}D AGO`;
}

// ── API helpers ─────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function polyApi(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const qs = new URLSearchParams({ endpoint, ...params });
  const res = await fetch(`${BASE}/api/polymarket?${qs.toString()}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ── Categories ──────────────────────────────────────────────────

export const CATEGORIES = [
  { slug: "", label: "ALL" },
  { slug: "politics", label: "POLITICS" },
  { slug: "sports", label: "SPORTS" },
  { slug: "crypto", label: "CRYPTO" },
  { slug: "pop-culture", label: "CULTURE" },
  { slug: "business", label: "BUSINESS" },
  { slug: "science", label: "SCIENCE" },
  { slug: "tech", label: "TECH" },
  { slug: "ai", label: "AI" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: ["election", "president", "congress", "senate", "party", "trump", "biden", "vote", "governor", "republican", "democrat", "midterm", "political"],
  sports: ["nba", "nfl", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "tennis", "ufc", "championship", "playoffs", "super bowl", "world cup", "winner:", "score", "game handicap", "match", "beat the", "grand prix", "f1"],
  crypto: ["bitcoin", "btc", "eth", "ethereum", "solana", "sol", "crypto", "token", "altcoin", "defi", "nft", "bnb", "dogecoin", "xrp", "memecoin"],
  "pop-culture": ["movie", "album", "oscar", "grammy", "emmy", "celebrity", "kardashian", "taylor swift", "drake", "rihanna", "box office", "tv show", "streaming"],
  business: ["stock", "market cap", "revenue", "ipo", "company", "ceo", "acquisition", "earnings", "nasdaq", "s&p", "dow"],
  science: ["nasa", "space", "climate", "temperature", "earthquake", "hurricane", "sea ice", "starship", "asteroid", "disease"],
  tech: ["apple", "google", "meta", "microsoft", "openai", "ai model", "launch", "release date", "tesla"],
  ai: ["ai", "gpt", "claude", "openai", "llm", "artificial intelligence", "chatgpt", "gemini", "machine learning"],
};

export function matchTraderCategory(marketTitles: string[], category: string): boolean {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return false;
  const joined = marketTitles.join(" ").toLowerCase();
  return keywords.some((kw) => joined.includes(kw));
}

/** Match a trader against a free-text search query (address OR market titles). */
export function matchTraderSearch(t: TopTrader, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (t.address.toLowerCase().includes(q)) return true;
  return t.marketTitles.some((title) => title.toLowerCase().includes(q));
}

// ── Market fetching ─────────────────────────────────────────────

export async function fetchMarkets(
  limit: number = 40,
  order: string = "volume",
  fromDate?: string,
  toDate?: string,
): Promise<PolymarketMarket[]> {
  const params: Record<string, string> = {
    _limit: limit.toString(),
    active: "true",
    order,
    ascending: "false",
  };
  if (fromDate) params.end_date_min = new Date(fromDate).toISOString();
  if (toDate) params.end_date_max = new Date(toDate + "T23:59:59").toISOString();

  const raw = await polyApi("markets", params) as unknown[];
  return normalizeMarkets(raw);
}

export async function fetchMarketsByCategory(
  category: string,
  limit: number = 100,
  offset: number = 0,
): Promise<PolymarketMarket[]> {
  // Events API supports tag_slug filtering and contains embedded markets
  const raw = await polyApi("events", {
    tag_slug: category,
    _limit: limit.toString(),
    _offset: offset.toString(),
    active: "true",
  }) as unknown;

  const events = Array.isArray(raw) ? raw : [];
  const allMarkets: unknown[] = [];
  for (const evt of events) {
    const e = evt as Record<string, unknown>;
    const markets = e.markets as unknown[] | undefined;
    if (Array.isArray(markets)) {
      allMarkets.push(...markets);
    } else {
      allMarkets.push(e);
    }
  }

  return normalizeMarkets(allMarkets);
}

export async function searchMarkets(query: string, limit: number = 40): Promise<PolymarketMarket[]> {
  const raw = await polyApi(`public-search`, {
    q: query,
    _limit: limit.toString(),
  }) as Record<string, unknown>;

  // Search returns {events: [{..., markets: [...]}]}  — flatten to market list
  const events = Array.isArray(raw) ? raw : (raw?.events as unknown[] || []);
  const allMarkets: unknown[] = [];
  for (const evt of events) {
    const e = evt as Record<string, unknown>;
    const markets = e.markets as unknown[] | undefined;
    if (Array.isArray(markets)) {
      allMarkets.push(...markets);
    } else {
      // Event itself might be a market-like object
      allMarkets.push(e);
    }
  }

  return normalizeMarkets(allMarkets).slice(0, limit);
}

function normalizeMarkets(raw: unknown): PolymarketMarket[] {
  const items = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "id" in (raw as Record<string, unknown>)) ? [raw] : [];
  return items.map((m: Record<string, unknown>) => {
    let outcomePrices: number[] = [0.5, 0.5];
    try {
      if (typeof m.outcomePrices === "string") {
        outcomePrices = JSON.parse(m.outcomePrices as string).map(Number);
      } else if (Array.isArray(m.outcomePrices)) {
        outcomePrices = (m.outcomePrices as unknown[]).map(Number);
      } else if (typeof m.bestAsk === "number" || typeof m.bestBid === "number") {
        const yes = Number(m.bestAsk || m.bestBid || 0.5);
        outcomePrices = [yes, 1 - yes];
      }
    } catch {}

    let outcomes: string[] = ["Yes", "No"];
    if (Array.isArray(m.outcomes)) {
      outcomes = (m.outcomes as unknown[]).map(String);
    } else if (typeof m.outcomes === "string") {
      try { outcomes = JSON.parse(m.outcomes as string).map(String); } catch {}
    }

    let clobTokenIds: string[] | undefined;
    if (Array.isArray(m.clobTokenIds)) {
      clobTokenIds = (m.clobTokenIds as unknown[]).map(String);
    } else if (typeof m.clobTokenIds === "string") {
      try { clobTokenIds = JSON.parse(m.clobTokenIds as string).map(String); } catch {}
    }

    return {
      id: String(m.id || m.condition_id || m.conditionId || ""),
      conditionId: String(m.condition_id || m.conditionId || m.id || ""),
      question: String(m.question || m.title || ""),
      category: String(m.category || m.groupItemTitle || ""),
      endDate: String(m.end_date_iso || m.endDate || m.end_date || ""),
      volume: Number(m.volume || m.volumeNum || 0),
      liquidity: Number(m.liquidity || m.liquidityNum || 0),
      outcomePrices,
      outcomes,
      active: m.active !== false,
      image: m.image as string | undefined,
      description: m.description as string | undefined,
      slug: m.slug as string | undefined,
      clobTokenIds,
    };
  });
}

// ── Single-market + price-history fetching ──────────────────────

export async function fetchMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
  const raw = await polyApi("markets", { slug }) as unknown;
  const list = normalizeMarkets(raw);
  return list[0] || null;
}

export interface PricePoint { t: number; p: number; }

export async function fetchPriceHistory(
  tokenId: string,
  interval: "1h" | "6h" | "1d" | "1w" | "1m" | "max" = "1w",
  fidelity = 60,
): Promise<PricePoint[]> {
  const raw = await polyApi("prices-history", {
    market: tokenId,
    interval,
    fidelity: String(fidelity),
  }) as { history?: { t: number; p: number }[] };
  const arr = Array.isArray(raw?.history) ? raw.history : [];
  return arr.map((x) => ({ t: Number(x.t), p: Number(x.p) }));
}

// ── Trader / User data ──────────────────────────────────────────

export type ActiveTradersProgress =
  | { phase: "leaderboard"; done: number; total: number }
  | {
      phase: "enrich";
      done: number;
      total: number;
      kept: number;
      hoursScraped: number;
      hoursTarget: number;
    };

// Streaming variant: consumes the route's NDJSON stream and reports
// per-phase progress before returning the final trader list. The route
// also serves cache HITs through this same channel as a single result
// event, so the caller doesn't need a separate cached-vs-cold path.
//
// onPartial fires whenever the server pushes an in-progress snapshot
// of the leaderboard — used to populate the table while the rest of
// the pipeline is still running.
export async function fetchTopTradersStream(
  candidatePool: number,
  options: { daysWindow?: number; minTradesPerDay?: number },
  onProgress: (p: ActiveTradersProgress) => void,
  onPartial?: (traders: TopTrader[]) => void,
): Promise<{ traders: TopTrader[]; source: "memory" | "disk" | "fresh" }> {
  const { daysWindow = 7, minTradesPerDay = 1 } = options;
  const qs = new URLSearchParams({
    days: String(daysWindow),
    minPerDay: String(minTradesPerDay),
    pool: String(candidatePool),
    stream: "1",
  });
  const res = await fetch(`${BASE}/api/polymarket/active-traders?${qs}`);
  if (!res.ok || !res.body) throw new Error(`active-traders ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let traders: TopTrader[] = [];
  let source: "memory" | "disk" | "fresh" = "fresh";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let evt: Record<string, unknown>;
      try { evt = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
      if (evt.type === "progress") {
        onProgress(evt as unknown as ActiveTradersProgress);
      } else if (evt.type === "partial" || evt.type === "result") {
        const arr = Array.isArray(evt.traders) ? (evt.traders as Record<string, unknown>[]) : [];
        const mapped = arr.map((t) => ({
          address: String(t.address || ""),
          volume: Number(t.volume || 0),
          buyVolume: Number(t.buyVolume || 0),
          sellVolume: Number(t.sellVolume || 0),
          pnl: Number(t.pnl || 0),
          winRate: Number(t.winRate || 0),
          positions: Number(t.positions || 0),
          marketTitles: Array.isArray(t.marketTitles) ? (t.marketTitles as string[]) : [],
          pnlCurve: Array.isArray(t.pnlCurve) ? (t.pnlCurve as number[]) : undefined,
        }));
        if (evt.type === "partial") {
          onPartial?.(mapped);
        } else {
          traders = mapped;
          if (typeof evt.source === "string") {
            source = evt.source as "memory" | "disk" | "fresh";
          }
        }
      } else if (evt.type === "error") {
        throw new Error(String(evt.message || "stream error"));
      }
    }
  }
  return { traders, source };
}

export async function fetchTopTraders(
  candidatePool: number = 1000,
  options: { daysWindow?: number; minTradesPerDay?: number } = {},
): Promise<TopTrader[]> {
  // Delegates to the server-side route which paginates the WEEK leaderboard,
  // fetches each candidate's trades + positions, and filters by activity.
  const { daysWindow = 7, minTradesPerDay = 1 } = options;
  const qs = new URLSearchParams({
    days: String(daysWindow),
    minPerDay: String(minTradesPerDay),
    pool: String(candidatePool),
  });
  const res = await fetch(`${BASE}/api/polymarket/active-traders?${qs}`);
  if (!res.ok) throw new Error(`active-traders ${res.status}`);
  const data = await res.json();
  const traders = Array.isArray(data?.traders) ? data.traders : [];
  return traders.map((t: Record<string, unknown>) => ({
    address: String(t.address || ""),
    volume: Number(t.volume || 0),
    buyVolume: Number(t.buyVolume || 0),
    sellVolume: Number(t.sellVolume || 0),
    pnl: Number(t.pnl || 0),
    winRate: Number(t.winRate || 0),
    positions: Number(t.positions || 0),
    marketTitles: Array.isArray(t.marketTitles) ? (t.marketTitles as string[]) : [],
    pnlCurve: Array.isArray(t.pnlCurve) ? (t.pnlCurve as number[]) : undefined,
  }));
}

// Paginate /activity for a user until we've got trades older than untilTs
// (unix seconds) — i.e. until we've fully covered the requested time window.
// For super-active traders we cap at MAX_TRADES so we don't fan out forever.
//
// onProgress fires after each page so the UI can stream partial results
// and show how far back the data has reached.
export interface FetchTradesProgress {
  pages: number;
  totalTrades: number;
  oldestMs: number;        // 0 if we've not seen any trade yet
  done: boolean;
  partial: PolymarketTrade[];
}

export async function fetchWalletTradesUntil(
  address: string,
  untilTs: number,
  onProgress?: (info: FetchTradesProgress) => void,
  maxTrades = 10000,
): Promise<PolymarketTrade[]> {
  const PAGE = 1000;
  const out: PolymarketTrade[] = [];
  let oldestMs = 0;

  for (let offset = 0; offset < maxTrades; offset += PAGE) {
    const raw = await polyApi("activity", {
      user: address,
      limit: String(PAGE),
      offset: String(offset),
    }) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) {
      onProgress?.({
        pages: offset / PAGE,
        totalTrades: out.length,
        oldestMs,
        done: true,
        partial: out,
      });
      break;
    }
    const items = raw as Record<string, unknown>[];

    let oldestSec = Number.POSITIVE_INFINITY;
    for (const t of items) {
      const ts = Number(t.timestamp || 0);
      if (ts > 0 && ts < oldestSec) oldestSec = ts;
      if (t.type !== "TRADE") continue;
      const price = Number(t.price || 0);
      const size = Number(t.size || 0);
      const usdcSize = Number(t.usdcSize || price * size);
      const side = String(t.side || "BUY").toUpperCase() as "BUY" | "SELL";
      let timestamp = 0;
      if (typeof t.timestamp === "number") {
        timestamp = (t.timestamp as number) > 1e12
          ? (t.timestamp as number)
          : (t.timestamp as number) * 1000;
      }
      out.push({
        id: String(t.transactionHash || ""),
        market: String(t.title || t.slug || ""),
        conditionId: String(t.conditionId || t.asset || ""),
        side,
        price,
        size,
        pnl: side === "SELL" ? usdcSize * 0.1 : 0,
        timestamp,
        outcome: t.outcome as string | undefined,
      });
    }

    if (Number.isFinite(oldestSec)) oldestMs = oldestSec * 1000;

    const reachedCutoff =
      Number.isFinite(oldestSec) && oldestSec < untilTs;
    const exhausted = items.length < PAGE;
    const done = reachedCutoff || exhausted;

    onProgress?.({
      pages: offset / PAGE + 1,
      totalTrades: out.length,
      oldestMs,
      done,
      partial: out.slice(),
    });

    if (done) break;
  }
  return out;
}

export async function fetchWalletTrades(address: string, limit: number = 200): Promise<PolymarketTrade[]> {
  // Polymarket data API: /activity?user=<address>&limit=<n>
  const raw = await polyApi("activity", {
    user: address,
    limit: limit.toString(),
  }) as unknown;

  const trades = Array.isArray(raw) ? raw : [];

  return trades
    .filter((t: Record<string, unknown>) => t.type === "TRADE")
    .map((t: Record<string, unknown>) => {
      const price = Number(t.price || 0);
      const size = Number(t.size || 0);
      const usdcSize = Number(t.usdcSize || price * size);
      const side = String(t.side || "BUY").toUpperCase() as "BUY" | "SELL";

      // Estimate P&L from trade data
      const pnl = side === "SELL" ? usdcSize * 0.1 : 0;

      // Timestamp is unix seconds
      let timestamp = 0;
      if (typeof t.timestamp === "number") {
        timestamp = t.timestamp > 1e12 ? t.timestamp : t.timestamp * 1000;
      }

      return {
        id: String(t.transactionHash || ""),
        market: String(t.title || t.slug || ""),
        conditionId: String(t.conditionId || t.asset || ""),
        side,
        price,
        size,
        pnl,
        timestamp,
        outcome: t.outcome as string | undefined,
      };
    });
}

export async function fetchPositions(address: string): Promise<PolymarketPosition[]> {
  // Polymarket data API: /positions?user=<address>&sizeThreshold=.1
  const raw = await polyApi("positions", {
    user: address,
    sizeThreshold: ".1",
    limit: "100",
  }) as unknown;

  const positions = Array.isArray(raw) ? raw : [];

  return positions.map((p: Record<string, unknown>) => {
    const size = Number(p.size || 0);
    const avgPrice = Number(p.avgPrice || 0);
    const currentPrice = Number(p.curPrice || avgPrice);
    const value = Number(p.currentValue || size * currentPrice);
    const pnlUsd = Number(p.cashPnl || (currentPrice - avgPrice) * size);

    return {
      conditionId: String(p.conditionId || p.asset || ""),
      market: String(p.title || p.slug || ""),
      outcome: String(p.outcome || "Yes"),
      size,
      avgPrice,
      currentPrice,
      value,
      pnlUsd,
    };
  });
}
