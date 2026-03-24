'use client';

import { useState } from 'react';
import { ModEntry, parseDataUri, gatewayUrl } from '@/network/registry';

interface Props {
  mod: ModEntry;
  isOwner: boolean;
  onRemove: (modId: number) => Promise<void>;
  onUpdate: (modId: number, data: string) => Promise<void>;
}

export default function ModCard({ mod, isOwner, onRemove, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [newData, setNewData] = useState(mod.data);
  const [busy, setBusy] = useState(false);

  const { provider, cid } = parseDataUri(mod.data);
  const isUri = provider !== 'unknown';

  const handleUpdate = async () => {
    setBusy(true);
    try {
      await onUpdate(mod.id, newData);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await onRemove(mod.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="p-5 rounded-xl transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-base">{mod.name}</h3>
          <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-secondary)' }}>
            #{mod.id} &middot; {mod.owner.slice(0, 6)}...{mod.owner.slice(-4)}
          </p>
        </div>

        {isUri && (
          <span
            className="text-xs px-2 py-1 rounded-md font-mono"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
            }}
          >
            {provider}
          </span>
        )}
      </div>

      {/* Data */}
      {editing ? (
        <div className="space-y-2 mt-3">
          <textarea
            value={newData}
            onChange={(e) => setNewData(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              disabled={busy}
              className="px-3 py-1 rounded-md text-xs font-medium"
              style={{ backgroundColor: 'var(--accent)', color: '#000' }}
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setNewData(mod.data);
              }}
              className="px-3 py-1 rounded-md text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {isUri ? (
            <a
              href={gatewayUrl(mod.data)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono break-all hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {cid.length > 32 ? cid.slice(0, 16) + '...' + cid.slice(-16) : cid}
            </a>
          ) : (
            <p
              className="text-sm font-mono break-all"
              style={{ color: 'var(--text-secondary)' }}
            >
              {mod.data.length > 120 ? mod.data.slice(0, 120) + '...' : mod.data}
            </p>
          )}
        </div>
      )}

      {/* Owner actions */}
      {isOwner && !editing && (
        <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1 rounded-md text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            Edit
          </button>
          <button
            onClick={handleRemove}
            disabled={busy}
            className="px-3 py-1 rounded-md text-xs font-medium"
            style={{
              backgroundColor: 'transparent',
              color: '#ff4444',
              border: '1px solid #ff4444',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Removing...' : 'Remove'}
          </button>
        </div>
      )}
    </div>
  );
}
