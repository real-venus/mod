'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50095';

interface EpochStatus {
  active: boolean;
  expired?: boolean;
  epoch_id?: string;
  start_time?: string;
  end_time?: string;
  time_remaining?: string;
  inflation_pool?: number;
  traders: number;
  message?: string;
}

interface AssetPrice {
  [exchange: string]: number | { error: string };
}

export default function Dashboard() {
  const [status, setStatus] = useState<EpochStatus | null>(null);
  const [prices, setPrices] = useState<Record<string, AssetPrice>>({});
  const [assets, setAssets] = useState<{ tracked: string[]; registry: Record<string, Record<string, string>> }>({ tracked: [], registry: {} });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, assetsRes] = await Promise.all([
        fetch(`${API}/status`),
        fetch(`${API}/assets`),
      ]);
      setStatus(await statusRes.json());
      setAssets(await assetsRes.json());

      try {
        const pricesRes = await fetch(`${API}/prices`);
        setPrices(await pricesRes.json());
      } catch {
        // prices may fail if exchanges not configured
      }
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API}/sync`, { method: 'POST' });
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="text-center text-muted py-20">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Epoch Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Epoch"
          value={status?.active ? 'Active' : 'Inactive'}
          sub={status?.epoch_id?.replace('epoch_', '#') || 'None'}
          color={status?.active ? 'text-pos' : 'text-muted'}
        />
        <StatCard
          label="Time Remaining"
          value={status?.time_remaining || '--'}
          sub={status?.end_time ? `Ends ${new Date(status.end_time).toLocaleDateString()}` : ''}
        />
        <StatCard
          label="Inflation Pool"
          value={status?.inflation_pool?.toLocaleString() || '0'}
          sub="tokens"
          color="text-gold"
        />
        <StatCard
          label="Traders"
          value={String(status?.traders || 0)}
          sub="registered"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-gold/15 text-gold rounded-lg text-sm font-medium hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync PnL'}
        </button>
      </div>

      {/* Tracked Assets */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Tracked Assets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.tracked.map((name) => {
            const reg = assets.registry[name] || {};
            const price = prices[name] || {};
            return (
              <div key={name} className="bg-background border border-card-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-lg font-bold ${name === 'gold' ? 'text-gold' : 'text-silver'}`}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </span>
                  <span className="text-xs text-muted font-mono">
                    {reg.hyperliquid || '—'} / {reg.uniswap || '—'}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {Object.entries(price).map(([ex, val]) => (
                    <div key={ex} className="flex justify-between">
                      <span className="text-muted">{ex}</span>
                      <span className="font-mono">
                        {typeof val === 'number' ? `$${val.toLocaleString()}` : 'N/A'}
                      </span>
                    </div>
                  ))}
                  {Object.keys(price).length === 0 && (
                    <span className="text-muted text-xs">No price data</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reward Curve */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Quadratic Reward Curve</h2>
        <div className="flex items-center justify-center py-4">
          <QuadraticCurve />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center text-sm mt-2">
          <div>
            <div className="text-neg font-mono">-x&sup2;</div>
            <div className="text-muted">Loss penalty</div>
          </div>
          <div>
            <div className="text-muted font-mono">0</div>
            <div className="text-muted">Break-even</div>
          </div>
          <div>
            <div className="text-pos font-mono">+x&sup2;</div>
            <div className="text-muted">Profit reward</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color || 'text-foreground'}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  );
}

function QuadraticCurve() {
  const w = 320, h = 160, mid = h / 2;
  const points: string[] = [];
  for (let x = -10; x <= 10; x += 0.5) {
    const y = x >= 0 ? x * x : -(x * x);
    const px = (x + 10) / 20 * w;
    const py = mid - (y / 100) * mid * 0.9;
    points.push(`${px},${py}`);
  }
  return (
    <svg width={w} height={h} className="overflow-visible">
      {/* Axes */}
      <line x1={0} y1={mid} x2={w} y2={mid} stroke="#333" strokeWidth={1} />
      <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="#333" strokeWidth={1} />
      {/* Curve */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#f5a623"
        strokeWidth={2}
      />
      {/* Labels */}
      <text x={4} y={mid - 4} fill="#737373" fontSize={10}>PnL %</text>
      <text x={w - 30} y={mid + 14} fill="#737373" fontSize={10}>Score</text>
    </svg>
  );
}
