'use client';

import { TabType } from '../page';

const TABS: { id: TabType; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'traders', label: 'Traders' },
  { id: 'history', label: 'History' },
];

export default function Header({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
}) {
  return (
    <header className="border-b border-card-border bg-card">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gold">Au</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">GoldFi</h1>
            <p className="text-xs text-muted">Quadratic Trading Rewards</p>
          </div>
        </div>

        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gold/15 text-gold'
                  : 'text-muted hover:text-foreground hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
