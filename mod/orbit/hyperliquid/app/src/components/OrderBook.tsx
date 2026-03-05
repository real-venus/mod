'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface OrderBookProps {
  symbol: string;
}

interface BookLevel {
  price: number;
  size: number;
  total: number;
}

export default function OrderBook({ symbol, tradingMode }: OrderBookProps) {
  const [asks, setAsks] = useState<BookLevel[]>([]);
  const [bids, setBids] = useState<BookLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 2000);
    return () => clearInterval(interval);
  }, [symbol]);

  const fetchOrderBook = async () => {
    try {
      const data = await api.getOrderBook(symbol);
      setAsks(data.asks.slice(0, 10));
      setBids(data.bids.slice(0, 10));
    } catch (error) {
      console.error('Error fetching orderbook:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxTotal = Math.max(
    ...asks.map((a) => a.total),
    ...bids.map((b) => b.total)
  );

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6">Order Book</h2>
        <div className="animate-pulse space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-6">Order Book - {symbol}</h2>

      {/* Header */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-gray-400 font-medium">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sell orders) */}
      <div className="space-y-1 mb-4">
        {asks.reverse().map((ask, i) => (
          <div key={i} className="relative grid grid-cols-3 gap-2 text-sm">
            <div
              className="absolute inset-0 bg-red-500 opacity-10"
              style={{ width: `${(ask.total / maxTotal) * 100}%` }}
            />
            <div className="relative text-red-500">{ask.price.toLocaleString()}</div>
            <div className="relative text-right text-gray-300">{ask.size.toFixed(4)}</div>
            <div className="relative text-right text-gray-400">{ask.total.toFixed(4)}</div>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="text-center py-2 border-y border-gray-800 mb-4">
        <div className="text-lg font-bold text-white">
          {asks.length > 0 && bids.length > 0
            ? ((asks[0].price + bids[0].price) / 2).toLocaleString()
            : '—'}
        </div>
        <div className="text-xs text-gray-400">
          Spread:{' '}
          {asks.length > 0 && bids.length > 0
            ? (asks[0].price - bids[0].price).toFixed(2)
            : '—'}
        </div>
      </div>

      {/* Bids (Buy orders) */}
      <div className="space-y-1">
        {bids.map((bid, i) => (
          <div key={i} className="relative grid grid-cols-3 gap-2 text-sm">
            <div
              className="absolute inset-0 bg-green-500 opacity-10"
              style={{ width: `${(bid.total / maxTotal) * 100}%` }}
            />
            <div className="relative text-green-500">{bid.price.toLocaleString()}</div>
            <div className="relative text-right text-gray-300">{bid.size.toFixed(4)}</div>
            <div className="relative text-right text-gray-400">{bid.total.toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
