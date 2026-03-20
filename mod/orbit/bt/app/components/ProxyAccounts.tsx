"use client";

import { useState } from "react";
import { useStore, type ProxyAccount } from "@/lib/store";
import { toast } from "react-toastify";
import { shortAddress } from "@/lib/wallet";

export default function ProxyAccounts() {
  const { proxyAccounts, addProxy, removeProxy, updateProxy, wallet } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");

  function handleCreate() {
    if (!name) {
      toast.error("Enter a name for the proxy");
      return;
    }
    if (proxyAccounts.find((p) => p.name === name)) {
      toast.error("Name already taken");
      return;
    }

    // In production: creates a new hotkey via bt.Wallet
    const proxy: ProxyAccount = {
      name,
      coldkey: wallet.address || "5Proxy" + Math.random().toString(36).slice(2, 10),
      hotkey: "5Hot" + Math.random().toString(36).slice(2, 12),
      budget_tao: parseFloat(budget) || 0,
      following: null,
      active: true,
    };

    addProxy(proxy);
    toast.success(`Proxy "${name}" created`);
    setName("");
    setBudget("");
    setShowCreate(false);
  }

  function handleToggle(proxyName: string, active: boolean) {
    updateProxy(proxyName, { active: !active });
    toast.info(`Proxy "${proxyName}" ${!active ? "activated" : "paused"}`);
  }

  return (
    <div className="bg-btcard border border-btborder rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold">Proxy Accounts</h2>
          <span className="text-[10px] text-btmuted">
            {proxyAccounts.length} accounts | {proxyAccounts.filter((p) => p.active).length} active
          </span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1 bg-btgreen/10 text-btgreen border border-btgreen/30 rounded-md text-xs hover:bg-btgreen/20 transition-all"
        >
          + New Proxy
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-4 py-4 border-b border-btborder bg-btdark/30">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-btmuted uppercase mb-1 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="proxy-1"
                className="w-full bg-btdark border border-btborder rounded-md px-3 py-2 text-xs text-white placeholder:text-btmuted focus:border-btgreen/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-btmuted uppercase mb-1 block">Budget (TAO)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="100"
                className="w-full bg-btdark border border-btborder rounded-md px-3 py-2 text-xs text-white placeholder:text-btmuted focus:border-btgreen/50 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                className="w-full py-2 bg-btgreen text-black rounded-md text-xs font-bold hover:bg-btgreen/80 transition-all"
              >
                Create
              </button>
            </div>
          </div>
          <p className="text-[10px] text-btmuted mt-2">
            Creates a new hotkey wallet for isolated copy trading. Each proxy operates independently.
          </p>
        </div>
      )}

      {/* Proxy list */}
      {proxyAccounts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-btmuted mb-1">No proxy accounts</p>
          <p className="text-[10px] text-btmuted">
            Create proxy accounts to copy-trade with isolated wallets
          </p>
        </div>
      ) : (
        <div className="divide-y divide-btborder/50">
          {proxyAccounts.map((proxy) => (
            <div key={proxy.name} className="px-4 py-3 flex items-center gap-4 row-hover">
              {/* Status */}
              <div
                className={`w-2 h-2 rounded-full ${
                  proxy.active ? "bg-btgreen pulse-dot" : "bg-btmuted"
                }`}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{proxy.name}</span>
                  {proxy.following && (
                    <span className="text-[10px] text-btblue bg-btblue/10 px-1.5 py-0.5 rounded">
                      copying {shortAddress(proxy.following)}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-btmuted font-mono">
                    CK: {shortAddress(proxy.coldkey)}
                  </span>
                  <span className="text-[10px] text-btmuted font-mono">
                    HK: {shortAddress(proxy.hotkey)}
                  </span>
                </div>
              </div>

              {/* Budget */}
              <div className="text-right">
                <p className="text-xs font-mono">{proxy.budget_tao.toFixed(2)} TAO</p>
                <p className="text-[10px] text-btmuted">budget</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(proxy.name, proxy.active)}
                  className={`px-2 py-0.5 text-[10px] rounded border transition-all ${
                    proxy.active
                      ? "bg-btyellow/10 text-btyellow border-btyellow/20 hover:bg-btyellow/20"
                      : "bg-btgreen/10 text-btgreen border-btgreen/20 hover:bg-btgreen/20"
                  }`}
                >
                  {proxy.active ? "Pause" : "Start"}
                </button>
                <button
                  onClick={() => {
                    removeProxy(proxy.name);
                    toast.info(`Removed "${proxy.name}"`);
                  }}
                  className="px-2 py-0.5 text-[10px] text-btred border border-btred/20 rounded hover:bg-btred/10 transition-all"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
