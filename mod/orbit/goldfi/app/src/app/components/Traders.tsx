'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50095';

interface Trader {
  address: string;
  exchange: string;
  initial_equity: number;
  current_equity: number;
  pnl: number;
  registered_at: string;
}

export default function Traders() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddr, setNewAddr] = useState('');
  const [newExchange, setNewExchange] = useState('hyperliquid');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`${API}/traders`);
      setTraders(await res.json());
    } catch {
      setTraders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!newAddr) return;
    setMsg('');
    try {
      const res = await fetch(`${API}/register?address=${encodeURIComponent(newAddr)}&exchange=${newExchange}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg(`Registered ${data.registered}`);
        setNewAddr('');
        await load();
      }
    } catch (e) {
      setMsg('Failed to register');
    }
  };

  const handleUnregister = async (addr: string) => {
    try {
      await fetch(`${API}/unregister?address=${encodeURIComponent(addr)}`, { method: 'POST' });
      await load();
    } catch {}
  };

  if (loading) return <div className="text-center text-muted py-20">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Register Form */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Register Trader</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted block mb-1">Wallet Address</label>
            <input
              type="text"
              value={newAddr}
              onChange={(e) => setNewAddr(e.target.value)}
              placeholder="0x..."
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Exchange</label>
            <select
              value={newExchange}
              onChange={(e) => setNewExchange(e.target.value)}
              className="bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            >
              <option value="hyperliquid">Hyperliquid</option>
              <option value="uniswap">Uniswap</option>
            </select>
          </div>
          <button
            onClick={handleRegister}
            className="px-5 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold-dim transition-colors"
          >
            Register
          </button>
        </div>
        {msg && <p className="text-xs text-muted mt-2">{msg}</p>}
      </div>

      {/* Traders List */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-card-border flex justify-between items-center">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Registered Traders ({traders.length})
          </h2>
        </div>
        {traders.length === 0 ? (
          <div className="p-10 text-center text-muted">No traders registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wide border-b border-card-border">
                <th className="text-left p-3">Address</th>
                <th className="text-left p-3">Exchange</th>
                <th className="text-right p-3">Initial Equity</th>
                <th className="text-right p-3">Current Equity</th>
                <th className="text-right p-3">PnL</th>
                <th className="text-right p-3">Registered</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {traders.map((t) => {
                const pnlPct = t.initial_equity > 0 ? (t.pnl / t.initial_equity * 100) : 0;
                return (
                  <tr key={t.address} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-xs">
                      {t.address.length > 12 ? `${t.address.slice(0, 6)}...${t.address.slice(-4)}` : t.address}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.exchange === 'hyperliquid' ? 'bg-green-500/10 text-green-400' : 'bg-pink-500/10 text-pink-400'
                      }`}>
                        {t.exchange}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">${t.initial_equity.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">${t.current_equity.toLocaleString()}</td>
                    <td className={`p-3 text-right font-mono ${t.pnl >= 0 ? 'text-pos' : 'text-neg'}`}>
                      {t.pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-muted text-xs">
                      {t.registered_at ? new Date(t.registered_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleUnregister(t.address)}
                        className="text-xs text-neg/60 hover:text-neg transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
