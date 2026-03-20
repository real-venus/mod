"use client";

import { useStore } from "@/lib/store";
import Header from "@/components/Header";
import SubnetTable from "@/components/SubnetTable";
import SwapPanel from "@/components/SwapPanel";
import Leaderboard from "@/components/Leaderboard";
import CopyTrade from "@/components/CopyTrade";
import ProxyAccounts from "@/components/ProxyAccounts";
import RpcStatus from "@/components/RpcStatus";

export default function Home() {
  const { activeTab } = useStore();

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Stats bar */}
        <StatsBar />

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === "subnets" && <SubnetTable />}
          {activeTab === "swap" && <SwapPanel />}
          {activeTab === "leaderboard" && <Leaderboard />}
          {activeTab === "copytrade" && <CopyTrade />}
          {activeTab === "proxy" && <ProxyAccounts />}
          {activeTab === "rpc" && <RpcStatus />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-btborder py-4 mt-8">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between">
          <p className="text-[10px] text-btmuted">
            BT CopyTrade | Bittensor dTAO Subnet Trading
          </p>
          <p className="text-[10px] text-btmuted">
            Powered by bt-rs engine + round-robin RPC
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
    { label: "Subnets", value: subnets.length, color: "text-btgreen" },
    {
      label: "Top Performer",
      value:
        leaderboard.length > 0
          ? `${(leaderboard[0].roi_30d * 100).toFixed(1)}% ROI`
          : "---",
      color: "text-btyellow",
    },
    {
      label: "Proxies Active",
      value: `${proxyAccounts.filter((p) => p.active).length}/${proxyAccounts.length}`,
      color: "text-btblue",
    },
    {
      label: "RPC Pool",
      value: `${healthyRpc}/${rpcHealth.length || 4}`,
      color: healthyRpc > 0 ? "text-btgreen" : "text-btred",
    },
    {
      label: "Wallet",
      value: wallet.connected ? "Connected" : "Not connected",
      color: wallet.connected ? "text-btgreen" : "text-btmuted",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-btcard border border-btborder rounded-lg px-4 py-3"
        >
          <p className="text-[10px] text-btmuted uppercase">{s.label}</p>
          <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
