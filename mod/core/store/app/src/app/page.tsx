"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildSiweMessage,
  connectMetaMask,
  hasMetaMask,
  personalSign,
  shortAddress,
} from "@/lib/wallet";
import { api, StoredObject } from "@/lib/api";

const TOKEN_KEY = "store:token";
const ADDR_KEY = "store:addr";

export default function Page() {
  const [hasWallet, setHasWallet] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [objects, setObjects] = useState<StoredObject[]>([]);
  const [backend, setBackend] = useState<"filecoin" | "hippius" | "both">("filecoin");
  const [file, setFile] = useState<File | null>(null);
  const [serviceStatus, setServiceStatus] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setHasWallet(hasMetaMask());
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const a = typeof window !== "undefined" ? localStorage.getItem(ADDR_KEY) : null;
    if (t && a) {
      api.me(t).then((r) => {
        setToken(t);
        setAddress(r.address);
      }).catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ADDR_KEY);
      });
    }
    api.status().then(setServiceStatus).catch(() => {});
  }, []);

  const refreshList = useCallback(async (t: string) => {
    try {
      const r = await api.list(t);
      setObjects(r.objects);
    } catch (e) {
      setError(`list failed: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    if (token) refreshList(token);
  }, [token, refreshList]);

  const connect = async () => {
    setError(null);
    setBusy("connecting wallet…");
    try {
      const { address, chainId } = await connectMetaMask();
      setAddress(address);
      setChainId(chainId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const signIn = async () => {
    if (!address || chainId === null) return;
    setError(null);
    setBusy("requesting nonce…");
    try {
      const { nonce, domain, origin } = await api.nonce(address);
      setBusy("waiting for signature…");
      const msg = buildSiweMessage({ domain, address, origin, nonce, chainId });
      const sig = await personalSign(msg, address);
      setBusy("verifying…");
      const { token: t, address: a } = await api.verify(msg, sig);
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(ADDR_KEY, a);
      setToken(t);
      setAddress(a);
      setSuccess("signed in");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADDR_KEY);
    setToken(null);
    setObjects([]);
  };

  const upload = async () => {
    if (!file || !token) return;
    setError(null);
    setSuccess(null);
    setBusy(`uploading to ${backend}…`);
    try {
      const r = await api.put(token, file, backend);
      const cids = Object.entries(r.results)
        .map(([b, v]) => v.cid ? `${b}: ${v.cid}` : `${b}: error — ${v.error}`)
        .join("  •  ");
      setSuccess(`uploaded: ${cids}`);
      setFile(null);
      await refreshList(token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pin = async (cid: string, b: string) => {
    if (!token) return;
    setBusy(`pinning ${cid.slice(0, 12)}…`);
    try {
      await api.pin(token, cid, b);
      setSuccess(`pinned ${cid.slice(0, 12)}…`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wrap">
      <header className="header">
        <div>
          <span className="brand">store</span>
          <span className="brand-sub">filecoin + hippius • mod protocol</span>
        </div>
        <div>
          {!hasWallet && <span className="muted">MetaMask not detected</span>}
          {hasWallet && !address && (
            <button className="primary" onClick={connect} disabled={!!busy}>
              Connect MetaMask
            </button>
          )}
          {hasWallet && address && !token && (
            <div className="row">
              <span className="muted">{shortAddress(address)}</span>
              <button className="primary" onClick={signIn} disabled={!!busy}>
                Sign in with Ethereum
              </button>
            </div>
          )}
          {token && address && (
            <div className="row">
              <span className="pill">SIWE</span>
              <span>{shortAddress(address)}</span>
              <button onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      {busy && <div className="success-box">⟳ {busy}</div>}
      {error && <div className="error-box">✕ {error}</div>}
      {success && !busy && <div className="success-box">✓ {success}</div>}

      <div className="panel">
        <h2 className="panel-title">Upload</h2>
        {!token && <p className="muted">Sign in to upload.</p>}
        {token && (
          <div className="row">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={!!busy}
            />
            <select value={backend} onChange={(e) => setBackend(e.target.value as never)} disabled={!!busy}>
              <option value="filecoin">filecoin</option>
              <option value="hippius">hippius</option>
              <option value="both">both</option>
            </select>
            <button className="primary" onClick={upload} disabled={!file || !!busy}>
              Upload
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">Your objects</h2>
        {!token && <p className="muted">Sign in to see your objects.</p>}
        {token && objects.length === 0 && <p className="muted">No objects yet.</p>}
        {token && objects.length > 0 && (
          <ul className="objects">
            {objects.map((o) => (
              <li key={`${o.cid}-${o.backend}-${o.timestamp}`}>
                <div>
                  <span className={`pill ${o.backend}`}>{o.backend}</span>
                  <span className="cid">{o.cid}</span>
                  {o.key && <div className="muted" style={{ fontSize: 11 }}>{o.key}</div>}
                </div>
                <div className="row">
                  <a href={api.getUrl(o.cid, o.backend)} target="_blank" rel="noreferrer">download</a>
                  <button onClick={() => pin(o.cid, o.backend)} disabled={!!busy}>pin</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">Service status</h2>
        <pre style={{ margin: 0, fontSize: 11, color: "#888", overflow: "auto" }}>
          {serviceStatus ? JSON.stringify(serviceStatus, null, 2) : "loading…"}
        </pre>
      </div>
    </div>
  );
}
