'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50095';

interface EpochHistory {
  epoch_id: string;
  start_time: string;
  end_time: string;
  inflation_pool: number;
  traders: number;
  total_distributed: number;
}

export default function History() {
  const [epochs, setEpochs] = useState<EpochHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/history`);
        setEpochs(await res.json());
      } catch {
        setEpochs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-center text-muted py-20">Loading...</div>;

  if (epochs.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-10 text-center">
        <p className="text-muted text-lg">No completed epochs yet</p>
        <p className="text-muted text-sm mt-2">Epoch history will appear here after the first week completes.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-card-border">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Epoch History</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs uppercase tracking-wide border-b border-card-border">
            <th className="text-left p-3">Epoch</th>
            <th className="text-left p-3">Period</th>
            <th className="text-right p-3">Pool</th>
            <th className="text-right p-3">Distributed</th>
            <th className="text-right p-3">Traders</th>
            <th className="text-right p-3">Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {epochs.map((e) => {
            const eff = e.inflation_pool > 0 ? (e.total_distributed / e.inflation_pool * 100) : 0;
            return (
              <tr key={e.epoch_id} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                <td className="p-3 font-mono text-xs text-gold">
                  {e.epoch_id.replace('epoch_', '#')}
                </td>
                <td className="p-3 text-xs text-muted">
                  {new Date(e.start_time).toLocaleDateString()} — {new Date(e.end_time).toLocaleDateString()}
                </td>
                <td className="p-3 text-right font-mono">{e.inflation_pool.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-gold">{e.total_distributed.toLocaleString()}</td>
                <td className="p-3 text-right">{e.traders}</td>
                <td className="p-3 text-right font-mono text-muted">{eff.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
