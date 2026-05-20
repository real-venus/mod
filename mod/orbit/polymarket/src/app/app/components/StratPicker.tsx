"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { loadIndexes, saveIndex, deleteIndex, updateIndex, getActiveIndexId, setActiveIndexId } from "../lib/indexStore";
import { pushStrat, deleteServerStrat, syncStrats } from "../lib/stratSync";
import { useAuth } from "../context/AuthContext";
import type { SavedIndex } from "../lib/types";

interface StratPickerProps {
  onStratChange?: () => void;
}

type SyncState = "idle" | "syncing" | "synced" | "error";
type SortKey = "name" | "pnl" | "roi";

const REBALANCE_OPTIONS = [
  { label: "OFF", value: 0 },
  { label: "15M", value: 15 },
  { label: "1H", value: 60 },
  { label: "4H", value: 240 },
  { label: "1D", value: 1440 },
];

function formatPnlShort(v: number | undefined): string {
  if (v === undefined) return "—";
  const sign = v >= 0 ? "+" : "";
  if (Math.abs(v) >= 1000) return `${sign}${(v / 1000).toFixed(1)}k`;
  return `${sign}${v.toFixed(0)}`;
}

export default function StratPicker({ onStratChange }: StratPickerProps) {
  const { localToken } = useAuth();
  const [indexes, setIndexes] = useState<SavedIndex[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [initialSynced, setInitialSynced] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [editingRebalance, setEditingRebalance] = useState<string | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!creatingNew) return;
    const onDocClick = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreatingNew(false);
        setNewName("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCreatingNew(false); setNewName(""); }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [creatingNew]);

  // Refresh indexes from localStorage periodically (backtest snapshots update there)
  useEffect(() => {
    const interval = setInterval(() => setIndexes(loadIndexes()), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const local = loadIndexes();
    setIndexes(local);
    setActiveId(getActiveIndexId());

    if (localToken && !initialSynced) {
      setInitialSynced(true);
      syncStrats(local, localToken.token).then((merged) => {
        for (const s of merged) {
          const existing = local.find((l) => l.id === s.id);
          if (!existing) saveIndex(s);
        }
        setIndexes(loadIndexes());
        const allSynced: Record<string, SyncState> = {};
        for (const s of merged) allSynced[s.id] = "synced";
        setSyncStates(allSynced);
      });
    }
  }, [localToken, initialSynced]);

  const select = (id: string) => {
    setActiveIndexId(id);
    setActiveId(id);
    onStratChange?.();
  };

  const pushToServer = useCallback(async (idx: SavedIndex) => {
    if (!localToken) return;
    setSyncStates((prev) => ({ ...prev, [idx.id]: "syncing" }));
    const ok = await pushStrat(idx, localToken.token);
    setSyncStates((prev) => ({ ...prev, [idx.id]: ok ? "synced" : "error" }));
  }, [localToken]);

  const create = () => {
    const name = newName.trim() || "Untitled";
    const now = Date.now();
    const idx: SavedIndex = {
      id: now.toString(36),
      name,
      traders: [],
      backtestDays: 7,
      rebalanceMinutes: 0,
      createdAt: now,
      updatedAt: now,
    };
    saveIndex(idx);
    setActiveIndexId(idx.id);
    setActiveId(idx.id);
    setIndexes(loadIndexes());
    setCreatingNew(false);
    setNewName("");
    onStratChange?.();
    pushToServer(idx);
  };

  const remove = (id: string) => {
    deleteIndex(id);
    const remaining = loadIndexes();
    setIndexes(remaining);
    if (activeId === id) {
      const next = remaining[0] || null;
      setActiveId(next?.id ?? null);
      setActiveIndexId(next?.id ?? null);
    }
    onStratChange?.();
    if (localToken) {
      deleteServerStrat(id, localToken.token);
      setSyncStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const setRebalance = (id: string, minutes: number) => {
    updateIndex(id, { rebalanceMinutes: minutes, updatedAt: Date.now() });
    setIndexes(loadIndexes());
    setEditingRebalance(null);
    const updated = loadIndexes().find((i) => i.id === id);
    if (updated) pushToServer(updated);
  };

  // Sort strats for leaderboard
  const sorted = [...indexes].sort((a, b) => {
    if (sortKey === "pnl") return (b.lastPnlAfterCosts ?? -Infinity) - (a.lastPnlAfterCosts ?? -Infinity);
    if (sortKey === "roi") return (b.lastRoi1k ?? -Infinity) - (a.lastRoi1k ?? -Infinity);
    return a.name.localeCompare(b.name);
  });

  const syncBadge = (id: string) => {
    const state = syncStates[id];
    if (!localToken) return null;
    switch (state) {
      case "syncing": return <span className="text-[5px] text-amber-400 animate-pulse">↑</span>;
      case "synced": return <span className="text-[5px] text-green-400">✓</span>;
      case "error": return <span className="text-[5px] text-red-400">!</span>;
      default: return null;
    }
  };

  return (
    <div className="pixel-panel border-2 border-pixel-border bg-pixel-black">
      {/* Header */}
      <div className="px-2 py-1 border-b-2 border-pixel-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-pixel-gray tracking-wider">STRATS</span>
          <div className="flex items-center gap-0.5">
            {(["pnl", "roi", "name"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`text-[6px] px-1 py-0.5 transition-colors ${
                  sortKey === k ? "text-green-400" : "text-pixel-gray hover:text-pixel-white"
                }`}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="relative" ref={createMenuRef}>
          <button
            onClick={() => setCreatingNew(!creatingNew)}
            className={`pixel-btn font-mono leading-none px-3 py-1.5 text-[14px] border-pixel-border transition-colors ${
              creatingNew
                ? "text-green-400 border-green-400 bg-green-400/10"
                : "text-pixel-gray hover:text-green-400 hover:border-green-400"
            }`}
            title="New strat"
            aria-expanded={creatingNew}
            aria-haspopup="menu"
          >
            +
          </button>

          {creatingNew && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-20 min-w-[180px] pixel-panel border-2 border-pixel-border bg-pixel-black shadow-lg"
            >
              <div className="px-2 py-1 border-b border-pixel-border/50 text-[6px] tracking-wider text-pixel-gray">
                NEW STRAT
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                  }}
                  placeholder="NAME (OPTIONAL)"
                  className="pixel-input-sm w-full font-mono text-[8px]"
                  autoFocus
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={create}
                    className="pixel-btn flex-1 text-[7px] px-1.5 py-1 border-green-400 text-green-400 hover:bg-green-400/10"
                  >
                    CREATE
                  </button>
                  <button
                    onClick={() => { setCreatingNew(false); setNewName(""); }}
                    className="pixel-btn text-[7px] px-1.5 py-1 border-pixel-border text-pixel-gray hover:text-pixel-white"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard header */}
      {indexes.length > 0 && (
        <div className="px-2 py-0.5 border-b border-pixel-border/50 flex items-center justify-between text-[6px] text-pixel-gray tracking-wider">
          <span className="flex-1">NAME</span>
          <span className="w-10 text-right">P&L</span>
          <span className="w-10 text-right">ROI</span>
          <span className="w-8 text-right">TXS</span>
          <span className="w-8 text-right">REB</span>
          <span className="w-6" />
        </div>
      )}

      {/* Strat list / leaderboard */}
      <div className="max-h-[200px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-2 py-3 text-center text-[8px] text-pixel-gray">
            NO STRATS YET — CREATE ONE TO START TESTING
          </div>
        ) : (
          sorted.map((idx, rank) => {
            const isActive = idx.id === activeId;
            const hasPnl = idx.lastPnlAfterCosts !== undefined;
            const pnlColor = (idx.lastPnlAfterCosts ?? 0) >= 0 ? "text-green-400" : "text-red-400";
            const roiColor = (idx.lastRoi1k ?? 0) >= 0 ? "text-green-400" : "text-red-400";
            const rebLabel = REBALANCE_OPTIONS.find((o) => o.value === (idx.rebalanceMinutes ?? 0))?.label ?? "OFF";

            return (
              <div key={idx.id}>
                <div
                  className={`px-2 py-1 flex items-center justify-between border-b border-pixel-border/30 cursor-pointer hover:bg-pixel-white/5 transition-colors ${
                    isActive ? "bg-pixel-white/10" : ""
                  }`}
                  onClick={() => select(idx.id)}
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-[6px] text-pixel-gray w-3 shrink-0">{rank + 1}.</span>
                    {isActive && <div className="w-1 h-1 bg-green-400 shrink-0" />}
                    <span className={`text-[8px] font-mono truncate ${isActive ? "text-green-400" : "text-pixel-white"}`}>
                      {idx.name}
                    </span>
                    <span className="text-[6px] text-pixel-gray shrink-0">{idx.traders.length}T</span>
                    {idx.liveEnabled && <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="LIVE" />}
                    {syncBadge(idx.id)}
                  </div>
                  <div className="flex items-center shrink-0">
                    <span className={`w-10 text-right text-[8px] font-mono ${hasPnl ? pnlColor : "text-pixel-gray"}`}>
                      {formatPnlShort(idx.lastPnlAfterCosts)}
                    </span>
                    <span className={`w-10 text-right text-[8px] font-mono ${hasPnl ? roiColor : "text-pixel-gray"}`}>
                      {formatPnlShort(idx.lastRoi1k)}
                    </span>
                    <span className="w-8 text-right text-[7px] text-pixel-gray font-mono">
                      {idx.lastTradeCount ?? "—"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRebalance(editingRebalance === idx.id ? null : idx.id);
                      }}
                      className={`w-8 text-right text-[7px] font-mono transition-colors ${
                        (idx.rebalanceMinutes ?? 0) > 0
                          ? "text-green-400 hover:text-amber-400"
                          : "text-pixel-gray hover:text-pixel-white"
                      }`}
                      title="Rebalance period"
                    >
                      {rebLabel}
                    </button>
                    <div className="w-6 flex items-center justify-end gap-0.5">
                      {localToken && syncStates[idx.id] !== "synced" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); pushToServer(idx); }}
                          className="text-[5px] text-amber-400 hover:text-green-400"
                          title="Save to server"
                        >
                          ↑
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(idx.id); }}
                        className="text-[7px] text-pixel-gray hover:text-red-400"
                      >
                        x
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rebalance period selector */}
                {editingRebalance === idx.id && (
                  <div className="px-2 py-1 border-b border-pixel-border/30 bg-pixel-black/80 flex items-center gap-1">
                    <span className="text-[6px] text-pixel-gray mr-1">REBALANCE:</span>
                    {REBALANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={(e) => { e.stopPropagation(); setRebalance(idx.id, opt.value); }}
                        className={`text-[7px] px-1.5 py-0.5 transition-colors ${
                          (idx.rebalanceMinutes ?? 0) === opt.value
                            ? "text-green-400 bg-green-400/10"
                            : "text-pixel-gray hover:text-pixel-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
