import { PolymarketMarket, PolymarketTrade, PolymarketPosition } from "./types";

// ── Top Trader type ─────────────────────────────────────────────
export interface TopTrader {
  address: string;
  volume: number;
  pnl: number;
  winRate: number;
  positions: number;
  marketTitles: string[];
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
  const items = Array.isArray(raw) ? raw : [];
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

    return {
      id: String(m.id || m.condition_id || m.conditionId || ""),
      conditionId: String(m.condition_id || m.conditionId || m.id || ""),
      question: String(m.question || m.title || ""),
      category: String(m.category || m.groupItemTitle || ""),
      endDate: String(m.end_date_iso || m.endDate || m.end_date || ""),
      volume: Number(m.volume || m.volumeNum || 0),
      liquidity: Number(m.liquidity || m.liquidityNum || 0),
      outcomePrices,
      outcomes: Array.isArray(m.outcomes)
        ? (m.outcomes as string[])
        : ["Yes", "No"],
      active: m.active !== false,
      image: m.image as string | undefined,
      description: m.description as string | undefined,
      slug: m.slug as string | undefined,
    };
  });
}

// ── Trader / User data ──────────────────────────────────────────

export async function fetchTopTraders(
  candidatePool: number = 250,
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
    pnl: Number(t.pnl || 0),
    winRate: Number(t.winRate || 0),
    positions: Number(t.positions || 0),
    marketTitles: Array.isArray(t.marketTitles) ? (t.marketTitles as string[]) : [],
  }));
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
