'use client';

import { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Leaderboard from './components/Leaderboard';
import Traders from './components/Traders';
import History from './components/History';

export type TabType = 'dashboard' | 'leaderboard' | 'traders' | 'history';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'traders' && <Traders />}
        {activeTab === 'history' && <History />}
      </main>
    </div>
  );
}
