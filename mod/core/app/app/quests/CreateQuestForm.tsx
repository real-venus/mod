"use client";

import { useState } from 'react';

interface CreateQuestFormProps {
  loading: boolean;
  onSubmit: (data: { title: string; description: string; reward: number; tags: string[] }) => Promise<void>;
  userBalance?: number | null;
}

export default function CreateQuestForm({ loading, onSubmit, userBalance }: CreateQuestFormProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    reward: '',
    tags: '',
  });

  const rewardNum = parseFloat(form.reward) || 0;
  const insufficientBalance = userBalance !== null && userBalance !== undefined && rewardNum > 0 && rewardNum > userBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (insufficientBalance || !form.description.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(t => t);
    const title = form.title.trim() || form.description.trim().slice(0, 80) + (form.description.trim().length > 80 ? '...' : '');
    await onSubmit({
      title,
      description: form.description,
      reward: parseFloat(form.reward),
      tags,
    });
    setForm({ title: '', description: '', reward: '', tags: '' });
  };

  return (
    <div className="max-w-2xl mx-auto font-mono">
      <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-primary)', border: '4px solid var(--border-color)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
          <span className="text-[14px] font-extrabold uppercase tracking-[0.15em]" style={{ color: 'rgb(16 185 129)' }}>&gt;_</span>
          <span className="text-[14px] font-extrabold uppercase tracking-[0.15em]" style={{ color: 'var(--text-primary)' }}>New Quest</span>
          <span className="text-[12px] ml-auto font-bold" style={{ color: 'var(--text-tertiary)' }}>FORM.CREATE</span>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Description */}
          <div>
            <label className="block text-[12px] font-extrabold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
              DESCRIPTION
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 text-[15px] focus:outline-none transition-colors resize-none h-36 font-mono font-medium"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '4px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              placeholder="Describe what needs to be done..."
              required
            />
          </div>

          {/* Title (optional) */}
          <div>
            <label className="block text-[12px] font-extrabold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
              TITLE <span style={{ color: 'var(--text-tertiary)' }}>(OPTIONAL)</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 text-[15px] focus:outline-none transition-colors font-mono font-bold"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '4px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              placeholder="Auto-generated from description if left blank"
            />
          </div>

          {/* Reward */}
          <div>
            <label className="block text-[12px] font-extrabold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
              REWARD (TOKENS)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.reward}
              onChange={e => setForm({ ...form, reward: e.target.value })}
              className="w-full px-4 py-3 text-[15px] focus:outline-none transition-colors font-mono font-extrabold"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '4px solid var(--border-color)',
                color: 'rgb(16 185 129)',
              }}
              placeholder="100.00"
              required
            />
            {userBalance !== null && userBalance !== undefined && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                  YOUR BALANCE: <span className={`font-extrabold`} style={{ color: insufficientBalance ? 'rgb(239 68 68)' : 'rgb(16 185 129)' }}>{userBalance.toLocaleString()} USDC</span>
                </span>
                {insufficientBalance && (
                  <span className="text-[12px] font-extrabold uppercase tracking-wider" style={{ color: 'rgb(239 68 68)' }}>
                    INSUFFICIENT FUNDS
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[12px] font-extrabold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-secondary)' }}>
              TAGS
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              className="w-full px-4 py-3 text-[15px] focus:outline-none transition-colors font-mono font-medium"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '4px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              placeholder="frontend, design, react"
            />
            <p className="text-[12px] mt-1.5 ml-0.5 font-bold" style={{ color: 'var(--text-tertiary)' }}>Comma separated</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: 'var(--border-color)' }}>
          <button
            type="submit"
            disabled={loading || insufficientBalance}
            className="px-6 py-2.5 text-[14px] font-extrabold uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: insufficientBalance ? 'rgb(239 68 68 / 0.2)' : 'rgb(59 130 246)',
              color: insufficientBalance ? 'rgb(239 68 68)' : '#ffffff',
              border: insufficientBalance ? '4px solid rgb(239 68 68 / 0.3)' : 'none',
              cursor: insufficientBalance ? 'not-allowed' : 'pointer',
              opacity: (loading || insufficientBalance) ? 0.5 : 1,
            }}
          >
            {loading ? 'CREATING...' : insufficientBalance ? 'INSUFFICIENT BALANCE' : 'CREATE QUEST >'}
          </button>
        </div>
      </form>
    </div>
  );
}
