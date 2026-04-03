"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import Header from "@/components/Header";
import SubnetTable from "@/components/SubnetTable";
import SwapPanel from "@/components/SwapPanel";
import Leaderboard from "@/components/Leaderboard";
import CopyTrade from "@/components/CopyTrade";
import ProxyAccounts from "@/components/ProxyAccounts";
import RpcStatus from "@/components/RpcStatus";
import { scanAllSubnets } from "@/lib/bittensor";
import { rpc } from "@/lib/rpc";

export default function Home() {
  const { activeTab, subnets, setSubnets, setSubnetsLoading, subnetsLoading, setRpcHealth } = useStore();

  useEffect(() => {
    if (subnets.length === 0 && !subnetsLoading) {
      setSubnetsLoading(true);
      scanAllSubnets()
        .then((data) => setSubnets(data))
        .catch(() => {})
        .finally(() => setSubnetsLoading(false));
    }

    rpc.healthCheck().then((results) => setRpcHealth(results)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        <StatsBar />

        <div className="mt-6">
          {activeTab === "subnets" && <SubnetTable />}
          {activeTab === "swap" && <SwapPanel />}
          {activeTab === "leaderboard" && <Leaderboard />}
          {activeTab === "copytrade" && <CopyTrade />}
          {activeTab === "proxy" && <ProxyAccounts />}
          {activeTab === "rpc" && <RpcStatus />}
        </div>
      </main>

      <footer className="border-t-2 border-btborder py-4 mt-8 bg-btcard">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between">
          <p className="text-[6px] font-pixel text-btmuted">
            BT COPYTRADE | BITTENSOR dTAO SUBNET TRADING
          </p>
          <p className="text-[6px] font-pixel text-btmuted">
            POWERED BY BT-RS ENGINE + ROUND-ROBIN RPC
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatsBar() {
  const { subnets, leaderboard, proxyAccounts, wallet, rpcHealth } = useStore();
  const healthyRpc = rpcHealth.filter((h: any) => h.healthy).length;

  const stats = [
    { label: "SUBNETS", value: subnets.length, color: "text-btgreen" },
    {
      label: "TOP ROI",
      value:
        leaderboard.length > 0
          ? `${(leaderboard[0].roi_30d * 100).toFixed(1)}%`
          : "---",
      color: "text-btyellow",
    },
    {
      label: "PROXIES",
      value: `${proxyAccounts.filter((p) => p.active).length}/${proxyAccounts.length}`,
      color: "text-btblue",
    },
    {
      label: "RPC",
      value: `${healthyRpc}/${rpcHealth.length || 4}`,
      color: healthyRpc > 0 ? "text-btgreen" : "text-btred",
    },
    {
      label: "WALLET",
      value: wallet.connected ? "OK" : "---",
      color: wallet.connected ? "text-btgreen" : "text-btmuted",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="pixel-box px-4 py-3"
        >
          <p className="text-[6px] font-pixel text-btmuted uppercase">{s.label}</p>
          <p className={`text-[12px] font-pixel ${s.color} mt-1`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
