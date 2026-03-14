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
    { label: 'TOTAL QUESTS', value: stats.total_quests || 0, accentColor: '#3b82f6' },
    { label: 'OPEN', value: stats.open || 0, accentColor: '#22c55e' },
    { label: 'COMPLETED', value: stats.completed || 0, accentColor: '#f59e0b' },
    { label: 'TOTAL REWARDS', value: stats.total_reward_posted || 0, accentColor: '#06b6d4' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => (
        <div
          key={item.label}
          className="border-4 px-6 py-6 font-mono"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: `color-mix(in srgb, ${item.accentColor} 30%, var(--border-primary))`,
          }}
        >
          <div className="mb-3">
            <span
              className="text-[14px] font-extrabold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.label}
            </span>
          </div>
          <div
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: item.accentColor }}
          >
            {item.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
