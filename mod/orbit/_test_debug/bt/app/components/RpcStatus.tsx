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
    <div className="pixel-box overflow-hidden">
      <div className="px-4 py-3 border-b-2 border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[9px] font-pixel text-bttext">RPC POOL</h2>
          <span className="text-[7px] font-pixel px-2 py-0.5 bg-btdark border border-btborder">
            <span className={healthyCount > 0 ? "text-btgreen" : "text-btred"}>
              {healthyCount}/{rpcHealth.length} UP
            </span>
          </span>
          {checking && (
            <span className="text-[7px] font-pixel text-btyellow pulse-dot">CHECKING...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-0.5 font-pixel text-[7px] border-2 ${
              autoRefresh
                ? "bg-btgreen text-black border-btgreen"
                : "bg-btcard text-btmuted border-btborder"
            }`}
          >
            AUTO:{autoRefresh ? "ON" : "OFF"}
          </button>
          <button
            onClick={runHealthCheck}
            disabled={checking}
            className="pixel-btn bg-btgreen text-black px-3 py-1 font-pixel text-[7px] border-btgreen disabled:opacity-50"
          >
            CHECK
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {rpcHealth.map((h: EndpointHealth) => (
          <div
            key={h.url}
            className={`flex items-center gap-3 p-3 border-2 ${
              h.healthy
                ? "bg-btgreen/5 border-btgreen"
                : "bg-btred/5 border-btred"
            }`}
          >
            <div
              className={`w-3 h-3 ${
                h.healthy ? "bg-btgreen pulse-dot" : "bg-btred"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[7px] font-pixel text-bttext truncate">{h.url}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[6px] font-pixel text-btmuted block">MS</span>
                <p
                  className={`text-[7px] font-pixel ${
                    h.latencyMs < 500 ? "text-btgreen" : h.latencyMs < 1500 ? "text-btyellow" : "text-btred"
                  }`}
                >
                  {h.latencyMs}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[6px] font-pixel text-btmuted block">ERR</span>
                <p className={`text-[7px] font-pixel ${h.errors > 0 ? "text-btred" : "text-btmuted"}`}>
                  {h.errors}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[6px] font-pixel text-btmuted block">STS</span>
                <p className={`text-[7px] font-pixel ${h.healthy ? "text-btgreen" : "text-btred"}`}>
                  {h.healthy ? "UP" : "DN"}
                </p>
              </div>
            </div>
          </div>
        ))}

        {rpcHealth.length === 0 && (
          <p className="text-[8px] font-pixel text-btmuted text-center py-4">
            {">> CLICK CHECK TO PROBE RPC"}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t-2 border-btborder bg-btdark">
        <p className="text-[6px] font-pixel text-btmuted">
          ROUND-ROBIN DISTRIBUTION WITH AUTO FAILOVER.
          BAD NODES EXCLUDED AFTER 3 FAILS.
        </p>
      </div>
    </div>
  );
}
