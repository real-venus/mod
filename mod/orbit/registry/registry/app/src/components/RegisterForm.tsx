'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (name: string, data: string) => Promise<void>;
}

export default function RegisterForm({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const [data, setData] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !data.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), data.trim());
      setName('');
      setData('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 rounded-xl"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <h2 className="text-lg font-semibold mb-4">Register Module</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-module"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Data (JSON or CID URI)
          </label>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder='{"version": "1.0.0", "description": "..."}'
            rows={4}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#000000',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </div>
    </form>
  );
}
