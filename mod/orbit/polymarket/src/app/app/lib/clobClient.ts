import { ClobCredentials } from "./types";

const CLOB_BASE = "https://clob.polymarket.com";

// ── L2 Header Signing ──────────────────────────────────────────

async function hmacSign(secret: string, message: string): Promise<string> {
  // secret is base64-encoded — decode to raw bytes
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
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
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function buildL2Headers(
  creds: ClobCredentials,
  address: string,
  method: string,
  requestPath: string,
  body: string = "",
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.floor(Math.random() * 999999).toString();
  const message = timestamp + method.toUpperCase() + requestPath + body;
  const signature = await hmacSign(creds.secret, message);

  return {
    "POLY_ADDRESS": address,
    "POLY_SIGNATURE": signature,
    "POLY_TIMESTAMP": timestamp,
    "POLY_NONCE": nonce,
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

export async function placeOrder(
  creds: ClobCredentials,
  address: string,
  order: ClobOrder,
): Promise<ClobOrderResult> {
  const path = "/order";
  const body = JSON.stringify({
    order: {
      tokenID: order.tokenID,
      price: order.price.toFixed(2),
      size: order.size.toFixed(2),
      side: order.side,
      type: order.type,
      feeRateBps: String(order.feeRateBps ?? 200),
    },
  });

  const headers = await buildL2Headers(creds, address, "POST", path, body);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { success: false, errorMsg: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json();
  return {
    success: data.success !== false,
    orderID: data.orderID || data.id,
    status: data.status,
    errorMsg: data.errorMsg || data.error,
    transactionsHashes: data.transactionsHashes,
  };
}

export async function getBalance(
  creds: ClobCredentials,
  address: string,
): Promise<ClobBalance> {
  const path = "/balance";
  const headers = await buildL2Headers(creds, address, "GET", path);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    return { balance: 0 };
  }

  const data = await res.json();
  return { balance: Number(data.balance || data.availableBalance || 0) };
}

export async function getOpenOrders(
  creds: ClobCredentials,
  address: string,
): Promise<ClobOpenOrder[]> {
  const path = "/orders";
  const headers = await buildL2Headers(creds, address, "GET", path);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data) ? data : (data.orders || []);
}

export async function cancelOrder(
  creds: ClobCredentials,
  address: string,
  orderID: string,
): Promise<boolean> {
  const path = `/order/${orderID}`;
  const headers = await buildL2Headers(creds, address, "DELETE", path);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}
