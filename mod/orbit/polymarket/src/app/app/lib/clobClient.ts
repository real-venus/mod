import { ClobCredentials } from "./types";

// L2 calls (order, balance, orders, cancel) can't go to clob.polymarket.com
// directly from the browser — no CORS on these endpoints. Caddy at
// /api/polymarket-l2/* strips the prefix and reverse-proxies to the upstream
// (see docker-entrypoint.dev.sh / Caddyfile).
const CLOB_BASE = "/api/polymarket-l2";

// ── L2 Header Signing ──────────────────────────────────────────

// Polymarket's CLOB issues the API secret as base64url (RFC 4648 §5) — uses
// `-`/`_` and omits padding. atob() only accepts standard base64, so we
// translate first. The HMAC signature must also be base64url to match what
// their server verifies (see py-clob-client/clob-client TS lib).
function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  if (!s) throw new Error("CLOB secret is empty — re-authenticate");
  const clean = s.replace(/\s+/g, "").replace(/=+$/, "");
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) {
    const bad = (clean.match(/[^A-Za-z0-9_-]/g) || []).slice(0, 5).join("");
    throw new Error(`CLOB secret has non-base64url chars (${bad}) — re-authenticate`);
  }
  let b64 = clean.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad === 1) {
    throw new Error(`CLOB secret has invalid base64url length=${clean.length} — re-authenticate`);
  }
  try {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch (e) {
    throw new Error(
      `CLOB secret base64url decode failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const keyBytes = b64urlDecode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return b64urlEncode(new Uint8Array(sig));
}

async function buildL2Headers(
  creds: ClobCredentials,
  address: string,
  method: string,
  requestPath: string,
  body: string = "",
): Promise<Record<string, string>> {
  if (!creds?.apiKey || !creds?.secret || !creds?.passphrase) {
    throw new Error("CLOB credentials missing — re-authenticate");
  }
  // py-clob-client L2 headers do NOT include POLY_NONCE — that's only for the
  // L1 EIP-712 ClobAuth flow. The HMAC message is timestamp+method+path+body.
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + requestPath + body;
  const signature = await hmacSign(creds.secret, message);

  return {
    "POLY_ADDRESS": address,
    "POLY_SIGNATURE": signature,
    "POLY_TIMESTAMP": timestamp,
    "POLY_API_KEY": creds.apiKey,
    "POLY_PASSPHRASE": creds.passphrase,
    "Content-Type": "application/json",
  };
}

// ── Types ──────────────────────────────────────────────────────

export interface ClobOrder {
  tokenID: string;
  price: number;
  size: number;
  side: "BUY" | "SELL";
  type: "GTC" | "FOK";
  feeRateBps?: number;
}

export interface ClobOrderResult {
  success: boolean;
  orderID?: string;
  status?: string;
  errorMsg?: string;
  transactionsHashes?: string[];
}

export interface ClobBalance {
  balance: number;
}

export interface ClobOpenOrder {
  id: string;
  status: string;
  tokenID: string;
  side: string;
  price: string;
  size: string;
  createdAt: string;
}

// ── API Methods ────────────────────────────────────────────────

// Polymarket order placement requires the order *body* to be EIP-712 signed
// by the maker's private key (or a delegated signer) and POSTed as a fully
// signed Order struct (maker/signer/taker/tokenId/makerAmount/takerAmount/
// side/expiration/nonce/feeRateBps/signatureType/signature). HMAC L2 only
// authenticates the API call itself — not the order intent. We don't yet
// have signer infrastructure for per-order signing, so return a clear error
// instead of POSTing a malformed body. See @polymarket/clob-client +
// @polymarket/order-utils for the signing logic when this is wired up.
export async function placeOrder(
  _creds: ClobCredentials,
  _address: string,
  _order: ClobOrder,
): Promise<ClobOrderResult> {
  return {
    success: false,
    errorMsg: "ORDER_SIGNING_NOT_IMPLEMENTED — needs EIP-712 per-order maker signature",
  };
}

export async function getBalance(
  creds: ClobCredentials,
  address: string,
): Promise<ClobBalance> {
  // Polymarket exposes balance + allowance together. asset_type=COLLATERAL is
  // USDC; signature_type=0 is EOA. Balance is returned as a string of base
  // units (USDC has 6 decimals). The HMAC must be over the *full* path
  // including the query string, matching py-clob-client.
  const path = "/balance-allowance?asset_type=COLLATERAL&signature_type=0";
  const headers = await buildL2Headers(creds, address, "GET", path);
  const res = await fetch(`${CLOB_BASE}${path}`, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`balance-allowance HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data.balance ?? data.availableBalance ?? "0";
  const balance = Number(raw) / 1_000_000;
  return { balance: Number.isFinite(balance) ? balance : 0 };
}

export async function getOpenOrders(
  creds: ClobCredentials,
  address: string,
): Promise<ClobOpenOrder[]> {
  const path = "/data/orders";
  const headers = await buildL2Headers(creds, address, "GET", path);
  const res = await fetch(`${CLOB_BASE}${path}`, { method: "GET", headers });
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.data || data.orders || [];
}

export async function cancelOrder(
  creds: ClobCredentials,
  address: string,
  orderID: string,
): Promise<boolean> {
  // py-clob-client uses DELETE /order with the order id in the JSON body.
  const path = "/order";
  const body = JSON.stringify({ orderID });
  const headers = await buildL2Headers(creds, address, "DELETE", path, body);
  const res = await fetch(`${CLOB_BASE}${path}`, { method: "DELETE", headers, body });
  return res.ok;
}
