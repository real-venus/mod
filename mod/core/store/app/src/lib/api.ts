const BASE = "/api/store";

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface NonceResponse {
  address: string;
  nonce: string;
  domain: string;
  origin: string;
}

export interface VerifyResponse {
  address: string;
  token: string;
  expires_in: number;
}

export interface PutResponse {
  owner: string;
  backend: string;
  results: Record<string, { cid?: string; error?: string; size?: number; backend?: string }>;
}

export interface StoredObject {
  cid: string;
  backend: string;
  owner: string | null;
  key: string | null;
  size: number | null;
  timestamp: number;
  meta: string | null;
}

export const api = {
  async health() {
    return json<{ ok: boolean; service: string }>(await fetch(`${BASE}/health`));
  },
  async status() {
    return json<Record<string, unknown>>(await fetch(`${BASE}/status`));
  },
  async backends() {
    return json<{ backends: string[] }>(await fetch(`${BASE}/backends`));
  },
  async nonce(address: string) {
    return json<NonceResponse>(await fetch(`${BASE}/nonce?address=${address}`));
  },
  async verify(message: string, signature: string) {
    return json<VerifyResponse>(
      await fetch(`${BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      })
    );
  },
  async me(token: string) {
    return json<{ address: string }>(
      await fetch(`${BASE}/me`, { headers: authHeaders(token) })
    );
  },
  async put(token: string, file: File, backend: string, key?: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("backend", backend);
    if (key) fd.append("key", key);
    return json<PutResponse>(
      await fetch(`${BASE}/put`, {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
      })
    );
  },
  async list(token: string, backend?: string) {
    const q = backend ? `?backend=${backend}` : "";
    return json<{ owner: string; objects: StoredObject[] }>(
      await fetch(`${BASE}/list${q}`, { headers: authHeaders(token) })
    );
  },
  async pin(token: string, cid: string, backend: string) {
    return json<Record<string, unknown>>(
      await fetch(`${BASE}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ cid, backend }),
      })
    );
  },
  getUrl(cid: string, backend?: string) {
    const q = backend ? `&backend=${backend}` : "";
    return `${BASE}/get?cid=${cid}${q}`;
  },
};
