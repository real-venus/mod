import { ClobCredentials, IndexTrader } from "./types";
import { placeOrder, getBalance, ClobOrderResult } from "./clobClient";
import { fetchWalletTradesUntil } from "./polymarket";

// ── Types ──────────────────────────────────────────────────────

export type CopyEngineStatus = "stopped" | "starting" | "running" | "paused" | "error";

export interface ExecutionLogEntry {
  id: string;
  timestamp: number;
  type: "COPY_BUY" | "COPY_SELL" | "SKIP" | "ERROR" | "BALANCE" | "CYCLE_START" | "CYCLE_END";
  traderAddress?: string;
  market?: string;
  conditionId?: string;
  tokenId?: string;
  side?: "BUY" | "SELL";
  traderSize?: number;
  mirrorSize?: number;
  mirrorNotional?: number;
  price?: number;
  orderResult?: ClobOrderResult;
  reason?: string;
}

export interface CopyEngineState {
  status: CopyEngineStatus;
  lastCycleAt: number | null;
  nextCycleAt: number | null;
  cycleCount: number;
  totalOrdersPlaced: number;
  totalOrdersFailed: number;
  totalVolumeMirrored: number;
  balance: number | null;
  log: ExecutionLogEntry[];
  error: string | null;
  traderCursors: Record<string, number>;
}

export interface CopyEngineConfig {
  strategyId: string;
  traders: IndexTrader[];
  capital: number;
  intervalMs: number;
  creds: ClobCredentials;
  address: string;
  minOrderSize: number;
  maxSlippageBps: number;
}

const MAX_LOG_ENTRIES = 200;
const MAX_ORDERS_PER_CYCLE = 20;
const ORDER_DELAY_MS = 500;
const TAKER_FEE_BPS = 200;

// ── Token ID Cache ─────────────────────────────────────────────

const TOKEN_MAP_KEY = "poly_copy_tokenmap";

function loadTokenMap(): Map<string, string[]> {
  try {
    const raw = localStorage.getItem(TOKEN_MAP_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveTokenMap(map: Map<string, string[]>): void {
  try {
    const obj = Object.fromEntries(map);
    localStorage.setItem(TOKEN_MAP_KEY, JSON.stringify(obj));
  } catch {}
}

// ── Helpers ────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Engine ─────────────────────────────────────────────────────

export class CopyEngine {
  private config: CopyEngineConfig;
  private state: CopyEngineState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(s: CopyEngineState) => void>();
  private copiedIds = new Set<string>();
  private tokenMap: Map<string, string[]>;
  private running = false;

  constructor(config: CopyEngineConfig) {
    this.config = config;
    this.tokenMap = loadTokenMap();
    this.state = {
      status: "stopped",
      lastCycleAt: null,
      nextCycleAt: null,
      cycleCount: 0,
      totalOrdersPlaced: 0,
      totalOrdersFailed: 0,
      totalVolumeMirrored: 0,
      balance: null,
      log: [],
      error: null,
      traderCursors: {},
    };
    this.loadPersisted();
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.setState({ status: "starting", error: null });

    // First cycle: set cursors to now (don't retroactively copy old trades)
    const hasCursors = Object.keys(this.state.traderCursors).length > 0;
    if (!hasCursors) {
      const now = Date.now();
      const cursors: Record<string, number> = {};
      for (const t of this.config.traders) {
        if (t.enabled !== false) cursors[t.address.toLowerCase()] = now;
      }
      this.setState({ traderCursors: cursors });
      this.saveCursors();
    }

    // Run first cycle immediately then schedule
    this.executeCycle().then(() => {
      if (!this.running) return;
      this.timer = setInterval(() => {
        if (this.state.status === "running") {
          this.executeCycle();
        }
      }, this.config.intervalMs);
      const nextAt = Date.now() + this.config.intervalMs;
      this.setState({ status: "running", nextCycleAt: nextAt });
    });
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setState({ status: "stopped", nextCycleAt: null });
    this.saveLog();
    this.saveCursors();
  }

  pause(): void {
    this.setState({ status: "paused" });
  }

  resume(): void {
    if (this.state.status !== "paused") return;
    this.setState({ status: "running" });
  }

  getState(): CopyEngineState {
    return { ...this.state };
  }

  subscribe(fn: (s: CopyEngineState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Core Cycle ───────────────────────────────────────────────

  private async executeCycle(): Promise<void> {
    const cycleId = uid();
    this.addLog({
      id: cycleId,
      timestamp: Date.now(),
      type: "CYCLE_START",
    });

    try {
      // Check balance
      const bal = await getBalance(this.config.creds, this.config.address);
      this.setState({ balance: bal.balance });
      this.addLog({
        id: uid(),
        timestamp: Date.now(),
        type: "BALANCE",
        reason: `$${bal.balance.toFixed(2)} USDC`,
      });

      if (bal.balance < this.config.capital * 0.05) {
        this.addLog({
          id: uid(),
          timestamp: Date.now(),
          type: "ERROR",
          reason: `Balance $${bal.balance.toFixed(2)} below 5% of capital $${this.config.capital}`,
        });
        this.setState({ status: "error", error: "INSUFFICIENT_BALANCE" });
        return;
      }

      const enabledTraders = this.config.traders.filter((t) => t.enabled !== false);
      const totalWeight = enabledTraders.reduce((s, t) => s + t.weight, 0);
      if (totalWeight <= 0) return;

      let ordersThisCycle = 0;

      for (const trader of enabledTraders) {
        if (ordersThisCycle >= MAX_ORDERS_PER_CYCLE) break;
        if (!this.running) break;

        const addr = trader.address.toLowerCase();
        const cursor = this.state.traderCursors[addr] || Date.now();
        // Fetch trades since cursor with 60s overlap
        const untilTs = Math.floor((cursor - 60_000) / 1000);

        try {
          const trades = await fetchWalletTradesUntil(
            trader.address,
            untilTs,
          );

          // Filter to new trades only
          const newTrades = trades.filter(
            (t) => t.timestamp > cursor && !this.copiedIds.has(t.id),
          );

          if (newTrades.length === 0) continue;

          // Compute trader's buy volume for sizing
          const traderBuyVol = trades
            .filter((t) => t.side === "BUY")
            .reduce((s, t) => s + t.price * t.size, 0);

          const capitalAlloc = this.config.capital * (trader.weight / totalWeight);
          const copyRatio = traderBuyVol > 0 ? capitalAlloc / traderBuyVol : 0;

          for (const trade of newTrades) {
            if (ordersThisCycle >= MAX_ORDERS_PER_CYCLE) break;
            if (!this.running) break;

            const traderNotional = trade.price * trade.size;
            const mirrorNotional = traderNotional * copyRatio;
            const mirrorSize = trade.size * copyRatio;

            // Skip if below minimum
            if (mirrorNotional < this.config.minOrderSize) {
              this.addLog({
                id: uid(),
                timestamp: Date.now(),
                type: "SKIP",
                traderAddress: trader.address,
                market: trade.market,
                conditionId: trade.conditionId,
                side: trade.side,
                traderSize: trade.size,
                mirrorNotional,
                reason: "BELOW_MIN_SIZE",
              });
              this.copiedIds.add(trade.id);
              continue;
            }

            // Resolve token ID
            const tokenId = await this.resolveTokenId(
              trade.conditionId,
              trade.outcome || "Yes",
            );
            if (!tokenId) {
              this.addLog({
                id: uid(),
                timestamp: Date.now(),
                type: "SKIP",
                traderAddress: trader.address,
                market: trade.market,
                conditionId: trade.conditionId,
                side: trade.side,
                reason: "TOKEN_ID_NOT_FOUND",
              });
              this.copiedIds.add(trade.id);
              continue;
            }

            // Place order
            try {
              const result = await placeOrder(this.config.creds, this.config.address, {
                tokenID: tokenId,
                price: trade.price,
                size: Math.round(mirrorSize * 100) / 100,
                side: trade.side,
                type: "FOK",
                feeRateBps: TAKER_FEE_BPS,
              });

              const logType = result.success
                ? (trade.side === "BUY" ? "COPY_BUY" : "COPY_SELL")
                : "ERROR";

              this.addLog({
                id: uid(),
                timestamp: Date.now(),
                type: logType as ExecutionLogEntry["type"],
                traderAddress: trader.address,
                market: trade.market,
                conditionId: trade.conditionId,
                tokenId,
                side: trade.side,
                traderSize: trade.size,
                mirrorSize: Math.round(mirrorSize * 100) / 100,
                mirrorNotional: Math.round(mirrorNotional * 100) / 100,
                price: trade.price,
                orderResult: result,
              });

              if (result.success) {
                this.setState({
                  totalOrdersPlaced: this.state.totalOrdersPlaced + 1,
                  totalVolumeMirrored: this.state.totalVolumeMirrored + mirrorNotional,
                });
              } else {
                this.setState({
                  totalOrdersFailed: this.state.totalOrdersFailed + 1,
                });
              }

              this.copiedIds.add(trade.id);
              ordersThisCycle++;

              // Rate limit between orders
              await delay(ORDER_DELAY_MS);
            } catch (e) {
              this.addLog({
                id: uid(),
                timestamp: Date.now(),
                type: "ERROR",
                traderAddress: trader.address,
                market: trade.market,
                reason: e instanceof Error ? e.message : String(e),
              });
            }
          }

          // Update cursor to latest trade
          const latestTs = Math.max(...newTrades.map((t) => t.timestamp));
          if (latestTs > cursor) {
            this.state.traderCursors[addr] = latestTs;
          }
        } catch (e) {
          this.addLog({
            id: uid(),
            timestamp: Date.now(),
            type: "ERROR",
            traderAddress: trader.address,
            reason: `FETCH_FAILED: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      this.setState({
        lastCycleAt: Date.now(),
        cycleCount: this.state.cycleCount + 1,
        nextCycleAt: Date.now() + this.config.intervalMs,
      });

      this.addLog({
        id: uid(),
        timestamp: Date.now(),
        type: "CYCLE_END",
        reason: `${ordersThisCycle} orders`,
      });

      // Persist
      this.saveCursors();
      this.saveLog();
      this.pruneDedup();
    } catch (e) {
      this.setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      this.addLog({
        id: uid(),
        timestamp: Date.now(),
        type: "ERROR",
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ── Token ID Resolution ──────────────────────────────────────

  private async resolveTokenId(conditionId: string, outcome: string): Promise<string | null> {
    const cached = this.tokenMap.get(conditionId);
    if (cached && cached.length >= 2) {
      const idx = outcome.toLowerCase() === "no" ? 1 : 0;
      return cached[idx] || null;
    }

    // Try fetching market data from API
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/polymarket";
      const res = await fetch(`${API_URL}?endpoint=markets&condition_id=${conditionId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const markets = Array.isArray(data) ? data : [data];
      for (const m of markets) {
        let tokenIds: string[] = [];
        if (Array.isArray(m.clobTokenIds)) {
          tokenIds = m.clobTokenIds.map(String);
        } else if (typeof m.clobTokenIds === "string") {
          try { tokenIds = JSON.parse(m.clobTokenIds).map(String); } catch {}
        }
        if (tokenIds.length >= 2) {
          this.tokenMap.set(conditionId, tokenIds);
          saveTokenMap(this.tokenMap);
          const idx = outcome.toLowerCase() === "no" ? 1 : 0;
          return tokenIds[idx] || null;
        }
      }
    } catch {}

    return null;
  }

  // ── State Management ─────────────────────────────────────────

  private setState(patch: Partial<CopyEngineState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) {
      try { fn(this.getState()); } catch {}
    }
  }

  private addLog(entry: ExecutionLogEntry): void {
    const log = [entry, ...this.state.log].slice(0, MAX_LOG_ENTRIES);
    this.setState({ log });
  }

  // ── Persistence ──────────────────────────────────────────────

  private saveCursors(): void {
    try {
      localStorage.setItem(
        `poly_copy_cursors_${this.config.strategyId}`,
        JSON.stringify(this.state.traderCursors),
      );
    } catch {}
  }

  private saveLog(): void {
    try {
      localStorage.setItem(
        `poly_copy_log_${this.config.strategyId}`,
        JSON.stringify(this.state.log.slice(0, 50)),
      );
    } catch {}
  }

  private loadPersisted(): void {
    try {
      const cursors = localStorage.getItem(`poly_copy_cursors_${this.config.strategyId}`);
      if (cursors) this.state.traderCursors = JSON.parse(cursors);
    } catch {}
    try {
      const log = localStorage.getItem(`poly_copy_log_${this.config.strategyId}`);
      if (log) this.state.log = JSON.parse(log);
    } catch {}
    try {
      const dedup = localStorage.getItem(`poly_copy_dedup_${this.config.strategyId}`);
      if (dedup) {
        const arr = JSON.parse(dedup);
        if (Array.isArray(arr)) for (const id of arr) this.copiedIds.add(id);
      }
    } catch {}
  }

  private pruneDedup(): void {
    // Keep only last 1000 copied trade IDs
    if (this.copiedIds.size > 1000) {
      const arr = Array.from(this.copiedIds);
      this.copiedIds = new Set(arr.slice(arr.length - 1000));
    }
    try {
      localStorage.setItem(
        `poly_copy_dedup_${this.config.strategyId}`,
        JSON.stringify(Array.from(this.copiedIds)),
      );
    } catch {}
  }
}
