'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';
import { ArrowUpCircle, ArrowDownCircle, Search } from 'lucide-react';
import { TradingMode } from '@/app/page';

interface TradingPanelProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  tradingMode: TradingMode;
}

export default function TradingPanel({ symbol, onSymbolChange, tradingMode }: TradingPanelProps) {
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);

  // Polymarket specific state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [trendingMarkets, setTrendingMarkets] = useState<any[]>([]);

  const hyperliquidSymbols = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC'];

  // Load trending Polymarket markets on mount
  useEffect(() => {
    if (tradingMode === 'polymarket') {
      loadTrendingMarkets();
    }
  }, [tradingMode]);

  const loadTrendingMarkets = async () => {
    try {
      const markets = await api.getTrendingPolymarketMarkets(20);
      setTrendingMarkets(markets || []);
    } catch (error) {
      console.error('Error loading trending markets:', error);
    }
  };

  const handleSearchPolymarket = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await api.searchPolymarketMarkets(query, 10);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Error searching markets:', error);
    }
  };

  const selectPolymarketMarket = (market: any) => {
    setSelectedMarket(market);
    setSearchResults([]);
    setSearchQuery('');
    // Update symbol with market question for display
    onSymbolChange(market.question || market.title || 'Unknown Market');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!size || (orderType === 'limit' && !price)) {
      toast.error('Please fill in all fields');
      return;
    }

    if (tradingMode === 'polymarket' && !selectedMarket) {
      toast.error('Please select a market first');
      return;
    }

    setLoading(true);
    try {
      if (tradingMode === 'polymarket') {
        // Place Polymarket order
        const tokenId = selectedMarket.tokens?.[0]?.token_id || selectedMarket.clobTokenIds?.[0];
        if (!tokenId) {
          toast.error('No token ID found for this market');
          return;
        }

        const order = await api.placePolymarketOrder({
          token_id: tokenId,
          side: side === 'buy' ? 'BUY' : 'SELL',
          size: parseFloat(size),
          price: parseFloat(price),
        });

        toast.success(`Polymarket order placed successfully!`);
      } else {
        // Place Hyperliquid order
        const order = await api.placeOrder({
          symbol,
          is_buy: side === 'buy',
          size: parseFloat(size),
          price: orderType === 'limit' ? parseFloat(price) : undefined,
          order_type: orderType,
        });

        toast.success(`Order placed successfully!`);
      }

      setPrice('');
      setSize('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-6">Place Order</h2>

      {/* Symbol/Market Selector */}
      {tradingMode === 'hyperliquid' ? (
        <div className="mb-6">
          <label className="block text-gray-400 text-sm font-medium mb-2">Symbol</label>
          <select
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            {hyperliquidSymbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-gray-400 text-sm font-medium mb-2">Market</label>

          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchPolymarket(e.target.value)}
              placeholder="Search markets..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-3 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg">
              {searchResults.map((market, idx) => (
                <button
                  key={idx}
                  onClick={() => selectPolymarketMarket(market)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700 last:border-b-0"
                >
                  <div className="text-sm text-white truncate">{market.question || market.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {market.volume24hr ? `$${Number(market.volume24hr).toLocaleString()} volume` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected Market Display */}
          {selectedMarket && (
            <div className="p-3 bg-gray-800 border border-purple-600 rounded-lg mb-3">
              <div className="text-sm text-white font-medium">{selectedMarket.question || selectedMarket.title}</div>
              <div className="text-xs text-gray-400 mt-1">
                {selectedMarket.volume24hr && `Volume: $${Number(selectedMarket.volume24hr).toLocaleString()}`}
              </div>
            </div>
          )}

          {/* Trending Markets */}
          {!selectedMarket && trendingMarkets.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 font-medium mb-2">Trending Markets</div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {trendingMarkets.slice(0, 5).map((market, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectPolymarketMarket(market)}
                    className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
                  >
                    <div className="text-xs text-white truncate">{market.question || market.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Type */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setOrderType('limit')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              orderType === 'limit'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Limit
          </button>
          <button
            type="button"
            onClick={() => setOrderType('market')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              orderType === 'market'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Market
          </button>
        </div>
      </div>

      {/* Side */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
              side === 'buy'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <ArrowUpCircle className="w-5 h-5" />
            <span>Buy</span>
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
              side === 'sell'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <ArrowDownCircle className="w-5 h-5" />
            <span>Sell</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {orderType === 'limit' && (
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Price</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              required={orderType === 'limit'}
            />
          </div>
        )}

        <div>
          <label className="block text-gray-400 text-sm font-medium mb-2">Size</label>
          <input
            type="number"
            step="0.001"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="0.000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            side === 'buy'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading
            ? 'Placing Order...'
            : tradingMode === 'polymarket'
            ? `${side === 'buy' ? 'Buy Yes' : 'Buy No'}`
            : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
        </button>
      </form>
    </div>
  );
}
