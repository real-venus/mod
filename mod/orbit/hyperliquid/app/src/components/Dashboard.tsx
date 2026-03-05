'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  totalValue: number;
  pnl?: number;
  pnlPercent?: number;
  openPositions: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalValue: 0,
    pnl: 0,
    pnlPercent: 0,
    openPositions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Portfolio Value',
      value: `$${stats.totalValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'blue',
    },
    {
      title: 'Total PnL',
      value: `$${(stats.pnl || 0).toLocaleString()}`,
      icon: (stats.pnl || 0) >= 0 ? TrendingUp : TrendingDown,
      color: (stats.pnl || 0) >= 0 ? 'green' : 'red',
      subtitle: `${(stats.pnlPercent || 0).toFixed(2)}%`,
    },
    {
      title: 'Open Positions',
      value: stats.openPositions,
      icon: Activity,
      color: 'purple',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-800 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {statCards.map((card, index) => (
        <div
          key={index}
          className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm font-medium">{card.title}</span>
            <card.icon className={`w-5 h-5 text-${card.color}-500`} />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
          {card.subtitle && (
            <div className={`text-sm font-semibold text-${card.color}-500`}>
              {card.subtitle}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
