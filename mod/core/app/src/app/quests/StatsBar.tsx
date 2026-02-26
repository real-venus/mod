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
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20 font-mono">
        <span className="text-[14px] text-gray-400 dark:text-white/30 font-extrabold">NO STATS AVAILABLE</span>
      </div>
    );
  }

  const items = [
    { label: 'TOTAL QUESTS', value: stats.total_quests || 0, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-300 dark:border-blue-500/30' },
    { label: 'OPEN', value: stats.open || 0, color: 'text-green-500 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-300 dark:border-green-500/30' },
    { label: 'COMPLETED', value: stats.completed || 0, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-300 dark:border-amber-500/30' },
    { label: 'TOTAL REWARDS', value: stats.total_reward_posted || 0, color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-300 dark:border-cyan-500/30' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className={`${item.bg} border-2 ${item.border} px-6 py-6 font-mono`}>
          <div className="mb-3">
            <span className="text-[14px] font-extrabold text-gray-500 dark:text-white/50 uppercase tracking-wider">{item.label}</span>
          </div>
          <div className={`text-4xl font-extrabold ${item.color} tracking-tight`}>
            {item.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
