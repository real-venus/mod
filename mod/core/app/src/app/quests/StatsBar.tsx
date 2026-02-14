"use client";

interface StatsBarProps {
  stats: {
    total_quests?: number;
    open?: number;
    completed?: number;
    total_reward_posted?: number;
  } | null;
}

export default function StatsBar({ stats }: StatsBarProps) {
  if (!stats) return null;

  const items = [
    { label: 'TOTAL', value: stats.total_quests || 0, color: 'text-blue-400', border: 'border-blue-500/30', prefix: 'QST' },
    { label: 'OPEN', value: stats.open || 0, color: 'text-green-400', border: 'border-green-500/30', prefix: 'ACT' },
    { label: 'DONE', value: stats.completed || 0, color: 'text-amber-400', border: 'border-amber-500/30', prefix: 'CMP' },
    { label: 'REWARDS', value: stats.total_reward_posted || 0, color: 'text-cyan-400', border: 'border-cyan-500/30', prefix: 'TKN' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.08]">
      {items.map(item => (
        <div key={item.label} className="bg-[#0a0a0e] px-5 py-5 font-mono">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[11px] font-extrabold ${item.color}`}>[{item.prefix}]</span>
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">{item.label}</span>
          </div>
          <div className={`text-3xl font-extrabold ${item.color} tracking-tight`}>
            {item.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
