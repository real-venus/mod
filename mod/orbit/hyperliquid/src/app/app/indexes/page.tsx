"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listIndexes, deleteIndex, Index, ago, shortAddr } from "../lib/api";

export default function IndexesPage() {
  const [items, setItems] = useState<Index[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setItems((await listIndexes()).indexes); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (id: string) => {
    if (!confirm("delete index?")) return;
    await deleteIndex(id); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl text-ink">indexes</h1>
          <p className="text-xs text-muted mt-1">
            Compose multiple traders into a weighted basket. Optionally back it with a private vault.
          </p>
        </div>
        <Link href="/indexes/new" className="btn-primary">new index</Link>
      </div>

      {items.length === 0 ? (
        <div className="panel p-6 text-xs text-muted">
          no indexes yet — <Link href="/indexes/new" className="text-accent2">build one →</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((idx) => (
            <div key={idx.id} className="panel p-4 panel-hover">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/indexes/${idx.id}`} className="text-ink hover:text-accent2 text-base">
                    {idx.name}
                  </Link>
                  <div className="text-[11px] text-muted mt-0.5">
                    by {shortAddr(idx.owner)} · {idx.legs.length} legs · {idx.days_window}d window · {ago(idx.created_ms)}
                  </div>
                </div>
                {idx.vault_address ? (
                  <span className="pill border-accent/40 text-accent">vault</span>
                ) : <span className="pill text-muted">no vault</span>}
              </div>
              {idx.description && (
                <div className="text-xs text-muted mt-2">{idx.description}</div>
              )}
              <div className="flex flex-wrap gap-1 mt-3">
                {idx.legs.slice(0, 6).map((l) => (
                  <span key={l.address} className="pill">
                    {shortAddr(l.address)} <span className="text-accent ml-1">{(l.weight * 100).toFixed(0)}%</span>
                  </span>
                ))}
                {idx.legs.length > 6 && <span className="pill text-muted">+{idx.legs.length - 6}</span>}
              </div>
              <div className="flex gap-2 mt-3">
                <Link href={`/indexes/${idx.id}`} className="btn">view</Link>
                <button className="btn-danger" onClick={() => onDelete(idx.id)}>delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
