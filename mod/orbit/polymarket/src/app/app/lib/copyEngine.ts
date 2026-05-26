import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, type JsonRpcSigner } from "ethers";
import { ClobCredentials, IndexTrader } from "./types";
import { placeOrder, detectSigType, ClobOrderResult } from "./clobClient";
import { fetchWalletTradesUntil } from "./polymarket";
import { networkById, ensureChain, withRpcFallback } from "./networks";
import { getProxyAddress } from "./polymarketProxy";
import { USDC_E } from "./polymarketContracts";

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
const NEG_RISK_MAP_KEY = "poly_copy_negriskmap";

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

function loadNegRiskMap(): Map<string, boolean> {
  try {
    const raw = localStorage.getItem(NEG_RISK_MAP_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveNegRiskMap(map: Map<string, boolean>): void {
  try {
    localStorage.setItem(NEG_RISK_MAP_KEY, JSON.stringify(Object.fromEntries(map)));
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
  private negRiskMap: Map<string, boolean>;
  private running = false;
  // Cached signer; refreshed if the user switches account/chain in MetaMask.
  private signer: JsonRpcSigner | null = null;
  // Polymarket Proxy address for this user's EOA. Resolved lazily on first
  // cycle; persists for the engine's lifetime.
  private proxyAddress: string | null = null;
  // Auto-detected sigType for this user's apiKey binding. Resolved once
  // per engine session via detectSigType().
  private sigType: 0 | 1 | 2 = 2;

  constructor(config: CopyEngineConfig) {
    this.config = config;
    this.tokenMap = loadTokenMap();
    this.negRiskMap = loadNegRiskMap();
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
    this.signer = null;
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
      // Resolve the user's Polymarket Proxy address once. Polymarket binds
      // every newly-minted apiKey to this proxy — that's the address that
      // holds funds and signs orders, not the connected EOA.
      if (!this.proxyAddress) {
        this.proxyAddress = await getProxyAddress(this.config.address);
      }

      // Probe all three sig_types and pick whichever Polymarket reports a
      // non-zero balance for. The CLOB's apiKey binding is opaque from the
      // client side — best we can do is try and use the winner.
      const detected = await detectSigType(this.config.creds, this.config.address);
      this.sigType = detected.sigType;
      const bal = detected.bal;

      // Cross-check against the real on-chain USDC.e balance at the proxy.
      // Polymarket's CLOB only counts funds at a *deployed + approved*
      // proxy — for a brand-new user with USDC sitting at an undeployed
      // Safe address, this will be 0 even though funds exist. The proxy
      // deploys atomically on first order settlement, so we let the engine
      // try the trade as long as on-chain funds clear the capital gate.
      const polygon = networkById("polygon")!;
      let onchainProxyBal = 0;
      try {
        const raw = await withRpcFallback(polygon, async (url) => {
          const provider = new JsonRpcProvider(url);
          const c = new Contract(USDC_E, ["function balanceOf(address) view returns (uint256)"], provider);
          return (await c.balanceOf(this.proxyAddress!)) as bigint;
        });
        onchainProxyBal = Number(formatUnits(raw, 6));
      } catch {}

      // Trust whichever is larger — typically on-chain pre-deployment,
      // CLOB post-deployment once funds are "live."
      const effective = Math.max(bal.balance, onchainProxyBal);
      this.setState({ balance: effective });
      const balDetail =
        `$${effective.toFixed(2)} usable · proxy $${onchainProxyBal.toFixed(2)} on-chain · CLOB $${bal.balance.toFixed(2)} (sigType=${this.sigType})`;
      this.addLog({
        id: uid(),
        timestamp: Date.now(),
        type: "BALANCE",
        reason: balDetail,
      });

      if (effective < this.config.capital * 0.05) {
        const proxy = this.proxyAddress!;
        const proxyShort = `${proxy.slice(0, 6)}…${proxy.slice(-4)}`;
        const need = this.config.capital * 0.05;
        // Read the EOA balance so we can give a precise next-step in the
        // common case where the user funded the EOA but never deposited.
        let eoaBal = 0;
        try {
          const raw = await withRpcFallback(polygon, async (url) => {
            const provider = new JsonRpcProvider(url);
            const c = new Contract(USDC_E, ["function balanceOf(address) view returns (uint256)"], provider);
            return (await c.balanceOf(this.config.address)) as bigint;
          });
          eoaBal = Number(formatUnits(raw, 6));
        } catch {}
        const reason = eoaBal >= need
          ? `Polymarket trades from a proxy address, not your wallet. Your wallet has $${eoaBal.toFixed(2)} USDC.e but proxy ${proxyShort} has only $${onchainProxyBal.toFixed(2)}. Open POLYMARKET ACCOUNT → DEPOSIT to move at least $${need.toFixed(2)} from wallet → proxy, then press RUN.`
          : `Proxy ${proxyShort} has $${onchainProxyBal.toFixed(2)} (need ≥$${need.toFixed(2)} = 5% of capital). Wallet also has only $${eoaBal.toFixed(2)} — fund USDC.e to your wallet first, then DEPOSIT to proxy.`;
        this.addLog({
          id: uid(),
          timestamp: Date.now(),
          type: "ERROR",
          reason,
        });
        this.setState({ status: "error", error: "INSUFFICIENT_BALANCE" });
        return;
      }

      const enabledTraders = this.config.traders.filter((t) => t.enabled !== false);
      const totalWeight = enabledTraders.reduce((s, t) => s + t.weight, 0);
      if (totalWeight <= 0) return;

      let ordersThisCycle = 0;
      let pollFailures = 0;
      let tradersWithNewActivity = 0;
      let totalNewTradesSeen = 0;

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
          tradersWithNewActivity++;
          totalNewTradesSeen += newTrades.length;

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

            // Place order — maker is the Polymarket Proxy (funds live
            // there), signer is the connected EOA, signatureType matches
            // what Polymarket's apiKey is bound to (auto-detected above).
            try {
              const signer = await this.getSigner();
              const negRisk = await this.resolveNegRisk(trade.conditionId);
              const proxy = this.proxyAddress ?? (this.proxyAddress = await getProxyAddress(this.config.address));
              // For sigType=0 (EOA), maker = EOA. For 1/2, maker = proxy.
              const maker = this.sigType === 0 ? this.config.address : proxy;
              const result = await placeOrder(
                this.config.creds,
                signer,
                maker,
                {
                  tokenID: tokenId,
                  price: trade.price,
                  size: Math.round(mirrorSize * 100) / 100,
                  side: trade.side,
                  type: "FOK",
                  feeRateBps: TAKER_FEE_BPS,
                },
                negRisk,
                this.sigType,
              );

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
          pollFailures++;
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

      // Build a heartbeat summary so even quiet cycles (no trader activity)
      // produce a visible log line — otherwise the user sees long stretches
      // of "BAL → END 0 orders" with no signal that the engine is alive.
      const summaryParts = [
        `polled ${enabledTraders.length} traders`,
        `${tradersWithNewActivity} active`,
        `${totalNewTradesSeen} new trades`,
        `${ordersThisCycle} orders`,
      ];
      if (pollFailures > 0) summaryParts.push(`${pollFailures} fetch errors`);

      this.addLog({
        id: uid(),
        timestamp: Date.now(),
        type: "CYCLE_END",
        reason: summaryParts.join(" · "),
      });

      // Persist
      this.saveCursors();
      this.saveLog();
      this.pruneDedup();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // 401 from balance-allowance almost always means the in-memory CLOB
      // creds no longer match the active wallet (account switched in
      // MetaMask, or page was reloaded and only partial state restored).
      // Surface a clear "click AUTHENTICATE again" prompt instead of the
      // raw HTTP error, which doesn't tell the user what to do.
      const is401 = /HTTP 401|Unauthorized|Invalid api key/i.test(raw);
      const reason = is401
        ? `CLOB rejected the request (401). Your saved API key doesn't match the active wallet — disconnect & reconnect in MetaMask, then click AUTHENTICATE again to mint fresh creds.`
        : raw;
      this.setState({ status: "error", error: is401 ? "UNAUTHENTICATED" : raw });
      this.addLog({
        id: uid(),
        timestamp: Date.now(),
        type: "ERROR",
        reason,
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
        // Stash negRisk alongside tokenIds — saves a refetch when signing
        // each order against the right exchange contract.
        const negRisk = Boolean(m.negRisk ?? m.neg_risk);
        this.negRiskMap.set(conditionId, negRisk);
        saveNegRiskMap(this.negRiskMap);
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

  /** Negative-risk flag for a market, with localStorage cache. Defaults to
   *  false if unknown — a wrong default just produces a "bad signature"
   *  error on the order, which we surface in the log. */
  private async resolveNegRisk(conditionId: string): Promise<boolean> {
    const cached = this.negRiskMap.get(conditionId);
    if (cached !== undefined) return cached;
    // resolveTokenId populates negRiskMap as a side effect; reuse it.
    await this.resolveTokenId(conditionId, "Yes");
    return this.negRiskMap.get(conditionId) ?? false;
  }

  /** Lazily create (and cache) a JsonRpcSigner from window.ethereum,
   *  ensuring the wallet is on Polygon first. Re-created on every cycle
   *  start to handle account/chain changes in MetaMask. */
  private async getSigner(): Promise<JsonRpcSigner> {
    if (this.signer) return this.signer;
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("NO_WALLET — window.ethereum unavailable");
    }
    const polygon = networkById("polygon")!;
    await ensureChain(window.ethereum as never, polygon);
    const provider = new BrowserProvider(window.ethereum as never);
    this.signer = await provider.getSigner(this.config.address);
    return this.signer;
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
