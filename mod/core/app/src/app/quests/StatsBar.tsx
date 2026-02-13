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
    { label: 'Total', value: stats.total_quests || 0, color: 'text-neutral-200' },
    { label: 'Open', value: stats.open || 0, color: 'text-emerald-400' },
    { label: 'Completed', value: stats.completed || 0, color: 'text-blue-400' },
    { label: 'Rewards Posted', value: stats.total_reward_posted || 0, color: 'text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-4 gap-[1px] bg-neutral-800">
      {items.map(item => (
        <div key={item.label} className="bg-neutral-900 px-4 py-3">
          <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">{item.label}</div>
          <div className={`text-xl font-mono font-medium ${item.color} mt-0.5`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
