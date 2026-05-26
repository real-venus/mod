"use client";

import { useCallback, useEffect, useState } from "react";
import { Bento, BentoGrid, CidChip, GlassButton } from "./Bento";

type VersionRecord = {
  cid: string;
  message: string;
  author: string;
  timestamp: number;
  parent: string | null;
};

type Props = {
  apiBase: string;
  module: string;
  authHeader?: Record<string, string>;
  onForked?: (newModule: string) => void;
};

function timeAgo(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const d = now - ts;
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function VersionsPanel({ apiBase, module, authHeader, onForked }: Props) {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapMsg, setSnapMsg] = useState("");
  const [snapBusy, setSnapBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/modules/${encodeURIComponent(module)}/versions`);
      const d = await r.json();
      setVersions(Array.isArray(d.versions) ? d.versions : []);
    } catch (e) {
      setError(`load failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBase, module]);

  useEffect(() => {
    if (module) load();
  }, [module, load]);

  const snapshot = async () => {
    setSnapBusy(true);
    setError(null);
    setStatus(null);
    try {
      const r = await fetch(`${apiBase}/modules/${encodeURIComponent(module)}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader || {}) },
        body: JSON.stringify({ message: snapMsg || "snapshot" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setStatus(`snapshot ${d.cid.slice(0, 10)}… (${d.file_count} files, ${d.store})`);
      setSnapMsg("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSnapBusy(false);
    }
  };

  const fork = async (cid: string) => {
    setError(null);
    setStatus(null);
    try {
      const r = await fetch(`${apiBase}/modules/${encodeURIComponent(module)}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader || {}) },
        body: JSON.stringify({ cid }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setStatus(`forked → ${d.target_module}`);
      onForked?.(d.target_module);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const restore = async (cid: string) => {
    if (!confirm(`Restore ${module} to ${cid.slice(0, 12)}…?\n\nCurrent state will be auto-snapshotted first.`)) return;
    setError(null);
    setStatus(null);
    try {
      const r = await fetch(`${apiBase}/modules/${encodeURIComponent(module)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader || {}) },
        body: JSON.stringify({ cid }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setStatus(`restored (${d.file_count} files written)`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const latest = versions[versions.length - 1];

  return (
    <BentoGrid>
      <Bento title="current version" accent>
        {latest ? (
          <>
            <CidChip cid={latest.cid} />
            <div className="bento-sub" style={{ marginTop: 8 }}>
              {latest.message || "(no message)"} · {timeAgo(latest.timestamp)}
            </div>
          </>
        ) : (
          <div className="bento-sub">no snapshots yet</div>
        )}
      </Bento>

      <Bento title="total versions">
        <div className="bento-value">{versions.length}</div>
        <div className="bento-sub">content-addressed via localfs</div>
      </Bento>

      <Bento title="storage">
        <div className="bento-value" style={{ fontSize: 18 }}>localfs</div>
        <div className="bento-sub">~/.mod/claude/blobs · pluggable</div>
      </Bento>

      <Bento title="snapshot now" span={3}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            value={snapMsg}
            onChange={(e) => setSnapMsg(e.target.value)}
            placeholder="describe this version…"
            style={{
              flex: 1,
              background: "var(--glass-bg-strong)",
              border: "1px solid var(--glass-border)",
              borderRadius: 10,
              padding: "10px 12px",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !snapBusy) snapshot();
            }}
          />
          <GlassButton variant="primary" onClick={snapshot} disabled={snapBusy}>
            {snapBusy ? "snapshotting…" : "snapshot"}
          </GlassButton>
        </div>
        {status && (
          <div className="bento-sub" style={{ marginTop: 8, color: "var(--crt-green)" }}>
            ✓ {status}
          </div>
        )}
        {error && (
          <div className="bento-sub" style={{ marginTop: 8, color: "var(--crt-red)" }}>
            ✗ {error}
          </div>
        )}
      </Bento>

      <Bento title="history" span={3}>
        {loading && <div className="bento-sub">loading…</div>}
        {!loading && versions.length === 0 && (
          <div className="bento-sub">no versions yet — snapshot above to start a history</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[...versions].reverse().map((v) => (
            <div key={v.cid + v.timestamp} className="version-row">
              <span className="dot" />
              <div style={{ minWidth: 0 }}>
                <div className="msg">{v.message || "(no message)"}</div>
                <div className="meta">
                  {timeAgo(v.timestamp)} ·{" "}
                  {v.author ? `${v.author.slice(0, 8)}…` : "local"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <CidChip cid={v.cid} />
                <GlassButton variant="ghost" onClick={() => fork(v.cid)} title="Fork this version into your portal">
                  fork
                </GlassButton>
                <GlassButton variant="ghost" onClick={() => restore(v.cid)} title="Restore the module tree to this version">
                  restore
                </GlassButton>
              </div>
            </div>
          ))}
        </div>
      </Bento>
    </BentoGrid>
  );
}
