"use client";

import { useState } from 'react';

interface CreateQuestFormProps {
  loading: boolean;
  onSubmit: (data: { title: string; description: string; reward: number; tags: string[] }) => Promise<void>;
}

export default function CreateQuestForm({ loading, onSubmit }: CreateQuestFormProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    reward: '',
    tags: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags.split(',').map(t => t.trim()).filter(t => t);
    await onSubmit({
      title: form.title,
      description: form.description,
      reward: parseFloat(form.reward),
      tags,
    });
    setForm({ title: '', description: '', reward: '', tags: '' });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-900">
        {/* Form header */}
        <div className="px-6 py-4 border-b border-neutral-800">
          <h2 className="text-[15px] font-medium text-neutral-100 tracking-tight">New Quest</h2>
          <p className="text-[12px] text-neutral-500 mt-0.5">Define a task and set a token reward for completion.</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 text-[14px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              placeholder="e.g., Build a landing page"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 text-[14px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none h-32 font-mono"
              placeholder="Detailed description of what needs to be done..."
              required
            />
          </div>

          {/* Reward */}
          <div>
            <label className="block text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-2">
              Reward (tokens)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.reward}
              onChange={e => setForm({ ...form, reward: e.target.value })}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 text-[14px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              placeholder="100.00"
              required
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-2">
              Tags
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 text-[14px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              placeholder="frontend, design, react"
            />
            <p className="text-[11px] text-neutral-600 mt-1">Comma separated</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-[13px] font-medium tracking-wide transition-colors"
          >
            {loading ? 'Creating...' : 'Create Quest'}
          </button>
        </div>
      </form>
    </div>
  );
}
