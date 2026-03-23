'use client';

import { useState } from 'react';
import { ModEntry, parseDataUri, gatewayUrl } from '@/network/registry';

interface ModCardProps {
  mod: ModEntry;
  isOwner: boolean;
  onRemove: (modId: number) => Promise<void>;
  onUpdate: (modId: number, data: string) => Promise<void>;
}

export default function ModCard({ mod, isOwner, onRemove, onUpdate }: ModCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(mod.data);
  const [busy, setBusy] = useState(false);

  const { provider } = parseDataUri(mod.data);
  const gateway = gatewayUrl(mod.data);
  const truncatedOwner = `${mod.owner.slice(0, 6)}...${mod.owner.slice(-4)}`;

  const providerColors: Record<string, { bg: string; text: string }> = {
    ipfs: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    lighthouse: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
    filecoin: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
  };

  const badge = providerColors[provider] || { bg: 'rgba(160, 160, 160, 0.15)', text: '#a0a0a0' };

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setBusy(true);
    try {
      await onRemove(mod.id);
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) {
      setEditing(true);
      setEditData(mod.data);
      return;
    }
    if (editData.trim() === mod.data) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onUpdate(mod.id, editData.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-semibold truncate">{mod.name}</h3>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
            #{mod.id}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {provider}
        </span>
      </div>

      {/* Owner */}
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Owner:
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--text-secondary)' }}
        >
          {truncatedOwner}
        </span>
      </div>

      {/* Data */}
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={editData}
            onChange={(e) => setEditData(e.target.value)}
            className="text-sm font-mono"
            style={{ padding: '8px 10px' }}
          />
        </div>
      ) : (
        <a
          href={gateway}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono truncate block transition-colors hover:underline"
          style={{ color: 'var(--accent)' }}
          title={mod.data}
        >
          {mod.data}
        </a>
      )}

      {/* Owner Actions */}
      {isOwner && (
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleUpdate}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: editing ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {editing ? 'Save' : 'Update'}
          </button>

          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleRemove}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: confirmRemove ? '#dc2626' : 'var(--bg-surface)',
              border: `1px solid ${confirmRemove ? '#dc2626' : 'var(--border)'}`,
              color: confirmRemove ? '#ffffff' : '#dc2626',
            }}
          >
            {busy ? '...' : confirmRemove ? 'Confirm Remove' : 'Remove'}
          </button>
        </div>
      )}
    </div>
  );
}
