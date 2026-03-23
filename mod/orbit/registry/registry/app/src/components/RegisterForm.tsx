'use client';

import { useState } from 'react';

interface RegisterFormProps {
  onSubmit: (name: string, data: string) => Promise<void>;
}

const PROVIDERS = ['ipfs', 'lighthouse', 'filecoin'] as const;
type StorageProvider = (typeof PROVIDERS)[number];

export default function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<StorageProvider>('ipfs');
  const [mode, setMode] = useState<'cid' | 'json'>('cid');
  const [cid, setCid] = useState('');
  const [json, setJson] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dataUri = `${provider}/${cid}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === 'cid' && !cid.trim()) return;

    setSubmitting(true);
    try {
      const data = mode === 'cid' ? `${provider}/${cid.trim()}` : json.trim();
      await onSubmit(name.trim(), data);
      setName('');
      setCid('');
      setJson('');
    } finally {
      setSubmitting(false);
    }
  };

  const providerColors: Record<StorageProvider, string> = {
    ipfs: '#3b82f6',
    lighthouse: '#a855f7',
    filecoin: '#06b6d4',
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-6 space-y-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <h3 className="text-lg font-semibold mb-2">Register Module</h3>

      {/* Name */}
      <div>
        <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          Module Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-module"
          required
        />
      </div>

      {/* Storage Provider */}
      <div>
        <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          Storage Provider
        </label>
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor:
                  provider === p ? providerColors[p] : 'var(--bg-surface)',
                color: provider === p ? '#ffffff' : 'var(--text-secondary)',
                border: `1px solid ${provider === p ? providerColors[p] : 'var(--border)'}`,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div>
        <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          Data Mode
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('cid')}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: mode === 'cid' ? 'var(--accent)' : 'var(--bg-surface)',
              color: mode === 'cid' ? '#000000' : 'var(--text-secondary)',
              border: `1px solid ${mode === 'cid' ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            CID
          </button>
          <button
            type="button"
            onClick={() => setMode('json')}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: mode === 'json' ? 'var(--accent)' : 'var(--bg-surface)',
              color: mode === 'json' ? '#000000' : 'var(--text-secondary)',
              border: `1px solid ${mode === 'json' ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            JSON
          </button>
        </div>
      </div>

      {/* CID Input */}
      {mode === 'cid' && (
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Content ID (CID)
          </label>
          <input
            type="text"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder="QmABC123..."
            required
          />
          {cid && (
            <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              {dataUri}
            </p>
          )}
        </div>
      )}

      {/* JSON Textarea */}
      {mode === 'json' && (
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            JSON Data
          </label>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"description": "...", "version": "1.0.0"}'
            rows={4}
            className="font-mono text-sm"
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{
          backgroundColor: 'var(--accent)',
          color: '#000000',
        }}
      >
        {submitting ? 'Registering...' : 'Register Module'}
      </button>
    </form>
  );
}
