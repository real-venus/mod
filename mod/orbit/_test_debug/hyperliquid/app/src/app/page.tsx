'use client';

import { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import TradingPanel from '@/components/TradingPanel';
import Header from '@/components/Header';
import Positions from '@/components/Positions';
import OrderBook from '@/components/OrderBook';
import PriceChart from '@/components/PriceChart';
import Vaults from '@/components/Vaults';
import Traders from '@/components/Traders';

export type TabType = 'dashboard' | 'trade' | 'positions' | 'vaults' | 'traders';

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div className="min-h-screen bg-gray-950">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="container mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <Dashboard />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PriceChart symbol={selectedSymbol} />
              </div>
              <div>
                <OrderBook symbol={selectedSymbol} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PriceChart symbol={selectedSymbol} />
              <div className="mt-6">
                <OrderBook symbol={selectedSymbol} />
              </div>
            </div>
            <div>
              <TradingPanel
                symbol={selectedSymbol}
                onSymbolChange={setSelectedSymbol}
              />
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <Positions />
        )}

        {activeTab === 'vaults' && (
          <Vaults />
        )}

        {activeTab === 'traders' && (
          <Traders />
        )}
      </main>
    </div>
  );
}
