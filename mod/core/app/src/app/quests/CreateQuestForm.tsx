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
    if (insufficientBalance) return;
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
    <div className="max-w-2xl mx-auto font-mono">
      <form onSubmit={handleSubmit} className="bg-[#0a0a0e] border-2 border-white/[0.1]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
          <span className="text-green-400 text-[14px] font-extrabold">&gt;_</span>
          <span className="text-[14px] font-extrabold text-white/70 uppercase tracking-[0.15em]">New Quest</span>
          <span className="text-[12px] text-white/25 ml-auto font-bold">FORM.CREATE</span>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-[12px] font-extrabold text-white/40 uppercase tracking-[0.2em] mb-2">
              TITLE
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/[0.1] text-[15px] text-white/85 placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors font-mono font-bold"
              placeholder="e.g., Build a landing page"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-extrabold text-white/40 uppercase tracking-[0.2em] mb-2">
              DESCRIPTION
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/[0.1] text-[15px] text-white/85 placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors resize-none h-36 font-mono font-medium"
              placeholder="Detailed description of what needs to be done..."
              required
            />
          </div>

          {/* Reward */}
          <div>
            <label className="block text-[12px] font-extrabold text-white/40 uppercase tracking-[0.2em] mb-2">
              REWARD (TOKENS)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.reward}
              onChange={e => setForm({ ...form, reward: e.target.value })}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/[0.1] text-[15px] text-green-400 placeholder-white/20 focus:outline-none focus:border-green-500/50 transition-colors font-mono font-extrabold"
              placeholder="100.00"
              required
            />
            {userBalance !== null && userBalance !== undefined && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-[12px] font-bold text-white/30">
                  YOUR BALANCE: <span className={`font-extrabold ${insufficientBalance ? 'text-red-400' : 'text-green-400/70'}`}>{userBalance.toLocaleString()} TKN</span>
                </span>
                {insufficientBalance && (
                  <span className="text-[12px] font-extrabold text-red-400 uppercase tracking-wider">
                    INSUFFICIENT FUNDS
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[12px] font-extrabold text-white/40 uppercase tracking-[0.2em] mb-2">
              TAGS
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/[0.1] text-[15px] text-white/85 placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors font-mono font-medium"
              placeholder="frontend, design, react"
            />
            <p className="text-[12px] text-white/20 mt-1.5 ml-0.5 font-bold">Comma separated</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex justify-end">
          <button
            type="submit"
            disabled={loading || insufficientBalance}
            className={`px-6 py-2.5 text-[14px] font-extrabold uppercase tracking-wider transition-colors ${
              insufficientBalance
                ? 'bg-red-500/20 text-red-400/60 border-2 border-red-500/30 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-400 disabled:bg-white/10 disabled:text-white/20 text-black'
            }`}
          >
            {loading ? 'CREATING...' : insufficientBalance ? 'INSUFFICIENT BALANCE' : 'CREATE QUEST >'}
          </button>
        </div>
      </form>
    </div>
  );
}
