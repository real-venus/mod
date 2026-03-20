"use client";

import { useEffect, useState } from "react";
import { rpc, type EndpointHealth } from "@/lib/rpc";
import { useStore } from "@/lib/store";
import { toast } from "react-toastify";

export default function RpcStatus() {
  const { rpcHealth, setRpcHealth } = useStore();
  const [checking, setChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    runHealthCheck();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(runHealthCheck, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function runHealthCheck() {
    setChecking(true);
    try {
      const results = await rpc.healthCheck();
      setRpcHealth(results);
    } catch (err: any) {
      toast.error(`Health check failed: ${err.message}`);
    } finally {
      setChecking(false);
    }
  }

  const healthyCount = rpcHealth.filter((h: EndpointHealth) => h.healthy).length;

  return (
    <div className="bg-btcard border border-btborder rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold">RPC Pool Status</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-btdark">
            <span className={healthyCount > 0 ? "text-btgreen" : "text-btred"}>
              {healthyCount}/{rpcHealth.length} healthy
            </span>
          </span>
          {checking && (
            <span className="text-[10px] text-btyellow animate-pulse">checking...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-0.5 text-[10px] rounded border transition-all ${
              autoRefresh
                ? "bg-btgreen/10 text-btgreen border-btgreen/20"
                : "text-btmuted border-btborder"
            }`}
          >
            {autoRefresh ? "Auto: ON" : "Auto: OFF"}
          </button>
          <button
            onClick={runHealthCheck}
            disabled={checking}
            className="px-3 py-1 bg-btgreen/10 text-btgreen border border-btgreen/30 rounded-md text-xs hover:bg-btgreen/20 transition-all disabled:opacity-50"
          >
            Check
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {rpcHealth.map((h: EndpointHealth) => (
          <div
            key={h.url}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              h.healthy
                ? "bg-btgreen/5 border-btgreen/20"
                : "bg-btred/5 border-btred/20"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                h.healthy ? "bg-btgreen pulse-dot" : "bg-btred"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono truncate">{h.url}</p>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <div className="text-right">
                <span className="text-btmuted">Latency</span>
                <p
                  className={`font-mono ${
                    h.latencyMs < 500 ? "text-btgreen" : h.latencyMs < 1500 ? "text-btyellow" : "text-btred"
                  }`}
                >
                  {h.latencyMs}ms
                </p>
              </div>
              <div className="text-right">
                <span className="text-btmuted">Errors</span>
                <p className={`font-mono ${h.errors > 0 ? "text-btred" : "text-btmuted"}`}>
                  {h.errors}
                </p>
              </div>
              <div className="text-right">
                <span className="text-btmuted">Status</span>
                <p className={h.healthy ? "text-btgreen font-bold" : "text-btred font-bold"}>
                  {h.healthy ? "UP" : "DOWN"}
                </p>
              </div>
            </div>
          </div>
        ))}

        {rpcHealth.length === 0 && (
          <p className="text-xs text-btmuted text-center py-4">
            Click Check to probe all RPC endpoints
          </p>
        )}
      </div>

      {/* Round-robin info */}
      <div className="px-4 py-3 border-t border-btborder bg-btdark/30">
        <p className="text-[10px] text-btmuted">
          Requests are distributed across healthy endpoints using round-robin with automatic failover.
          Unhealthy endpoints are excluded after 3 consecutive failures and re-checked periodically.
        </p>
      </div>
    </div>
  );
}
