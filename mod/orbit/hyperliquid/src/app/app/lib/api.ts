// Thin client over the Rust /hl/* proxy.

export type TopTrader = {
  address: string;
  volume: number;
  pnl: number;
  win_rate: number;
  trades: number;
  coins: string[];
  avg_trade_usd: number;
  sharpe: number;
  last_active: number;
};

export type Follow = {
  id: string;
  follower: string;
  leader: string;
  size_pct: number;
  max_per_trade_usd: number;
  coins_allow: string[];
  coins_deny: string[];
  created_ms: number;
  last_seen_tid: number;
  paused: boolean;
  vault_address?: string | null;
};

export type IndexLeg = { address: string; weight: number };

export type Index = {
  id: string;
  name: string;
  owner: string;
  description: string;
  legs: IndexLeg[];
  days_window: number;
  created_ms: number;
  vault_address: string | null;
  max_leverage: number;
  notional_pct: number;
};

export type Signal = {
  id: string;
  follow_id: string;
  follower: string;
  leader: string;
  coin: string;
  side: string;
  leader_px: number;
  leader_sz: number;
  copy_sz: number;
  leader_tid: number;
  ts_ms: number;
  vault_address?: string | null;
  status: string;
};

// When the app is served behind a basePath (e.g. /hyperliquid via a reverse
// proxy), `/hl/*` won't reach Next. We have two rewrites — `/hl/*` for the
// no-basePath case, and `/api${basePath}/*` for the basePath case. Pick at
// runtime so the same client works in both deployments.
const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";
const BASE = BP ? `/api${BP}` : "/hl";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text().catch(() => "")}`);
  return r.json() as Promise<T>;
}

// ── traders ──
export const fetchTopTraders = (days: number, minPerDay = 1, pool = 150, seed?: string[]) =>
  j<{ traders: TopTrader[]; days: number; pool: number }>(
    `/traders/top?days=${days}&min_per_day=${minPerDay}&pool=${pool}` +
    (seed?.length ? `&seed=${encodeURIComponent(seed.join(","))}` : "")
  );

export const analyzeTrader = (addr: string, days: number) =>
  j<any>(`/trader/${addr}/analyze?days=${days}`);

// ── follows ──
export const listFollows = (follower?: string) =>
  j<{ follows: Follow[] }>(`/follows${follower ? `?follower=${follower}` : ""}`);

export const createFollow = (b: Partial<Follow> & { follower: string; leader: string }) =>
  j<Follow>(`/follows`, { method: "POST", body: JSON.stringify(b) });

export const updateFollow = (id: string, b: Partial<Follow>) =>
  j<Follow>(`/follows/${id}`, { method: "PATCH", body: JSON.stringify(b) });

export const deleteFollow = (id: string) =>
  j<{ deleted: boolean }>(`/follows/${id}`, { method: "DELETE" });

export const pauseFollow = (id: string) =>
  j<Follow>(`/follows/${id}/pause`, { method: "POST" });
export const resumeFollow = (id: string) =>
  j<Follow>(`/follows/${id}/resume`, { method: "POST" });

export const listSignals = (follower?: string, limit = 100) =>
  j<{ signals: Signal[] }>(
    `/signals?limit=${limit}${follower ? `&follower=${follower}` : ""}`
  );

// ── indexes ──
export const listIndexes = () =>
  j<{ indexes: Index[] }>(`/indexes`);

export const getIndex = (id: string) => j<Index>(`/indexes/${id}`);

export const createIndex = (b: Partial<Index> & { name: string; owner: string; legs: IndexLeg[] }) =>
  j<Index>(`/indexes`, { method: "POST", body: JSON.stringify(b) });

export const updateIndex = (id: string, b: Partial<Index>) =>
  j<Index>(`/indexes/${id}`, { method: "PATCH", body: JSON.stringify(b) });

export const deleteIndex = (id: string) =>
  j<{ deleted: boolean }>(`/indexes/${id}`, { method: "DELETE" });

export const indexPerf = (id: string, days?: number) =>
  j<any>(`/indexes/${id}/perf${days ? `?days=${days}` : ""}`);

export const autoIndex = (b: { days?: number; top?: number; min_per_day?: number; pool?: number }) =>
  j<{ days: number; top: number; legs: IndexLeg[]; candidates: TopTrader[] }>(
    `/indexes/auto`, { method: "POST", body: JSON.stringify(b) }
  );

// ── vaults ──
export const listVaults = () => j<any>(`/vaults`);
export const vaultDetails = (addr: string) => j<any>(`/vaults/${addr}`);
export const vaultPerf = (addr: string) => j<any>(`/vaults/${addr}/perf`);
export const vaultIntent = (id: string, initial_usd: number) =>
  j<any>(`/indexes/${id}/vault/intent`, {
    method: "POST",
    body: JSON.stringify({ initial_usd }),
  });

// ── formatting helpers ──
export const fmtUsd = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M`
    : a >= 1e3 ? `${(a / 1e3).toFixed(2)}K`
    : a.toFixed(2);
  return `${n < 0 ? "-" : ""}$${s}`;
};

export const fmtPnl = (n: number) => `${n >= 0 ? "+" : "-"}${fmtUsd(Math.abs(n))}`;

export const fmtPct = (n: number, digits = 1) => `${(n).toFixed(digits)}%`;

export const shortAddr = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export const ago = (ms: number) => {
  if (!ms) return "—";
  const d = Date.now() - ms;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
