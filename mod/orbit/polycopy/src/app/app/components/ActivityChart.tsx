"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { DailyDataPoint } from "../lib/activity-data";

interface Props {
  data: DailyDataPoint[];
  height?: number;
}

type ViewMode = "volume" | "cumulative";

function formatVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function ActivityChart({ data, height = 340 }: Props) {
  const [mode, setMode] = useState<ViewMode>("volume");

  const chartData = useMemo(() => {
    if (mode === "volume") return data;

    // Cumulative mode
    let uniCum = 0;
    let polyCum = 0;
    return data.map((d) => {
      uniCum += d.uniswapVolume;
      polyCum += d.polymarketVolume;
      return {
        ...d,
        uniswapVolume: uniCum,
        polymarketVolume: polyCum,
      };
    });
  }, [data, mode]);

  const totalUniswap = data.reduce((s, d) => s + d.uniswapVolume, 0);
  const totalPolymarket = data.reduce((s, d) => s + d.polymarketVolume, 0);
  const totalTrades = data.reduce((s, d) => s + d.polymarketTrades, 0);

  return (
    <div className="panel-glow bg-ibm-panel p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] text-ibm-gray-light tracking-widest">
            30-DAY TRADE ACTIVITY
          </h3>
          <div className="flex items-center gap-1 ml-2">
            {(["volume", "cumulative"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 text-[10px] transition-colors ${
                  mode === m
                    ? "bg-ibm-green/20 text-ibm-green border border-ibm-green/40"
                    : "text-ibm-gray-light hover:text-ibm-white border border-transparent"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-[9px] text-ibm-gray tracking-wider">UNISWAP V3</div>
            <div className="text-ibm-cyan text-sm font-mono font-semibold">
              {formatVol(totalUniswap)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-ibm-gray tracking-wider">POLYMARKET</div>
            <div className="text-ibm-blue text-sm font-mono font-semibold">
              {formatVol(totalPolymarket)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-ibm-gray tracking-wider">EST. TRADES</div>
            <div className="text-ibm-amber text-sm font-mono font-semibold">
              {totalTrades.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="uniGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#08bdba" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#08bdba" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="polyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4589ff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4589ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => {
              const dt = new Date(d);
              return dt.toLocaleDateString([], { month: "short", day: "numeric" });
            }}
            stroke="#2a2a2a"
            tick={{ fill: "#8d8d8d", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            stroke="#2a2a2a"
            tick={{ fill: "#8d8d8d", fontSize: 10 }}
            tickFormatter={(v: number) => formatVol(v)}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#161616",
              border: "1px solid #42be6533",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono",
              fontSize: 11,
            }}
            labelFormatter={(d) => String(d)}
            formatter={(value, name) => [
              formatVol(Number(value)),
              String(name) === "uniswapVolume" ? "Uniswap V3" : "Polymarket",
            ]}
          />
          <Legend
            verticalAlign="top"
            height={30}
            formatter={(value: string) =>
              value === "uniswapVolume" ? "UNISWAP V3" : "POLYMARKET"
            }
            wrapperStyle={{ fontSize: 10, fontFamily: "IBM Plex Mono" }}
          />
          <Area
            type="monotone"
            dataKey="uniswapVolume"
            stroke="#08bdba"
            strokeWidth={1.5}
            fill="url(#uniGrad)"
          />
          <Area
            type="monotone"
            dataKey="polymarketVolume"
            stroke="#4589ff"
            strokeWidth={1.5}
            fill="url(#polyGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
