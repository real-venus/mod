'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { TradingMode } from '@/app/page';

interface Position {
  symbol?: string;
  size?: number;
  entryPrice?: number;
  markPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  liquidationPrice?: number;
  margin?: number;

  // Polymarket specific
  id?: string;
  market?: {
    id: string;
    question: string;
    slug?: string;
  };
  outcome?: string;
  quantity?: string;
  price?: string;
  value?: string;
}

interface PositionsProps {
  tradingMode: TradingMode;
}

export default function Positions({ tradingMode }: PositionsProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [tradingMode]);

  const fetchPositions = async () => {
    try {
      if (tradingMode === 'polymarket') {
        const data = await api.getPolymarketPositions();
        setPositions(data.positions || []);
      } else {
        const data = await api.getPositions();
        setPositions(data);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (symbol: string) => {
    if (!confirm(`Are you sure you want to close your ${symbol} position?`)) {
      return;
    }

    try {
      await api.closePosition(symbol);
      toast.success(`${symbol} position closed`);
      fetchPositions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to close position');
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6">Open Positions</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6">Open Positions</h2>
        <div className="text-center py-12">
          <p className="text-gray-400">No open positions</p>
        </div>
      </div>
    );
  }

  // Render Polymarket positions differently
  if (tradingMode === 'polymarket') {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6">Polymarket Positions</h2>

        <div className="space-y-4">
          {positions.map((position, idx) => (
            <div
              key={position.id || idx}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-600 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-1">
                    {position.market?.question || 'Unknown Market'}
                  </h3>
                  <div className="text-sm text-gray-400">
                    Outcome: <span className="text-purple-400">{position.outcome || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <div className="text-xs text-gray-500">Quantity</div>
                  <div className="text-white font-medium">{position.quantity || '0'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Avg Price</div>
                  <div className="text-white font-medium">${position.price || '0'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Value</div>
                  <div className="text-white font-medium">${position.value || '0'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render Hyperliquid positions
  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-6">Open Positions</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-800">
              <th className="pb-3 text-gray-400 font-medium">Symbol</th>
              <th className="pb-3 text-gray-400 font-medium">Size</th>
              <th className="pb-3 text-gray-400 font-medium">Entry Price</th>
              <th className="pb-3 text-gray-400 font-medium">Mark Price</th>
              <th className="pb-3 text-gray-400 font-medium">PnL</th>
              <th className="pb-3 text-gray-400 font-medium">Liquidation</th>
              <th className="pb-3 text-gray-400 font-medium">Margin</th>
              <th className="pb-3 text-gray-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr
                key={position.symbol}
                className="border-b border-gray-800 hover:bg-gray-800 transition-colors"
              >
                <td className="py-4 font-semibold text-white">{position.symbol}</td>
                <td className={`py-4 ${(position.size || 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(position.size || 0) > 0 ? 'LONG' : 'SHORT'} {Math.abs(position.size || 0)}
                </td>
                <td className="py-4 text-gray-300">${(position.entryPrice || 0).toLocaleString()}</td>
                <td className="py-4 text-gray-300">${(position.markPrice || 0).toLocaleString()}</td>
                <td className="py-4">
                  <div className="flex items-center space-x-2">
                    {(position.pnl || 0) >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className={(position.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                      ${Math.abs(position.pnl || 0).toLocaleString()} ({(position.pnlPercent || 0).toFixed(2)}%)
                    </span>
                  </div>
                </td>
                <td className="py-4 text-gray-300">${(position.liquidationPrice || 0).toLocaleString()}</td>
                <td className="py-4 text-gray-300">${(position.margin || 0).toLocaleString()}</td>
                <td className="py-4">
                  <button
                    onClick={() => position.symbol && handleClosePosition(position.symbol)}
                    className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                    title="Close Position"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
