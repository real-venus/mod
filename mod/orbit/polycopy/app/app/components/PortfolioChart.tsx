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
} from "recharts";
import { PortfolioSnapshot } from "../lib/types";

interface Props {
  data: PortfolioSnapshot[];
  title?: string;
  height?: number;
}

type TimeRange = "1D" | "7D" | "30D" | "ALL";

export default function PortfolioChart({ data, title = "PORTFOLIO VALUE", height = 280 }: Props) {
  const [range, setRange] = useState<TimeRange>("30D");

  const filteredData = useMemo(() => {
    const now = Date.now();
    const ms: Record<TimeRange, number> = {
      "1D": 86400000,
      "7D": 604800000,
      "30D": 2592000000,
      ALL: Infinity,
    };
    const cutoff = now - ms[range];
    return data.filter((d) => d.timestamp >= cutoff);
  }, [data, range]);

  const isPositive = filteredData.length > 1 &&
    filteredData[filteredData.length - 1].totalValueUSD >= filteredData[0].totalValueUSD;

  const gradientColor = isPositive ? "#42be65" : "#fa4d56";
  const lineColor = isPositive ? "#42be65" : "#fa4d56";

  const latestValue = filteredData[filteredData.length - 1]?.totalValueUSD || 0;
  const startValue = filteredData[0]?.totalValueUSD || 0;
  const change = latestValue - startValue;
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0;

  return (
    <div className="panel-glow bg-ibm-panel p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] text-ibm-gray-light tracking-widest">{title}</h3>
          <div className="flex items-center gap-1 ml-2">
            {(["1D", "7D", "30D", "ALL"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-[10px] transition-colors ${
                  range === r
                    ? "bg-ibm-green/20 text-ibm-green border border-ibm-green/40"
                    : "text-ibm-gray-light hover:text-ibm-white border border-transparent"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-ibm-white text-lg font-semibold font-mono">
            ${latestValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className={`text-[11px] font-mono ${isPositive ? "text-ibm-green" : "text-ibm-red"}`}>
            {isPositive ? "+" : ""}
            ${change.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({changePct.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => {
              const d = new Date(ts);
              return range === "1D"
                ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : d.toLocaleDateString([], { month: "short", day: "numeric" });
            }}
            stroke="#2a2a2a"
            tick={{ fill: "#8d8d8d", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#2a2a2a"
            tick={{ fill: "#8d8d8d", fontSize: 10 }}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#161616",
              border: "1px solid #42be6533",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono",
              fontSize: 11,
            }}
            labelFormatter={(ts) => new Date(ts).toLocaleString()}
            formatter={(value) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Value"]}
          />
          <Area
            type="monotone"
            dataKey="totalValueUSD"
            stroke={lineColor}
            strokeWidth={1.5}
            fill="url(#chartGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
