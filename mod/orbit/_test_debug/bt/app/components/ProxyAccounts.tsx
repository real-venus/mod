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
      toast.error("Enter a name");
      return;
    }
    if (proxyAccounts.find((p) => p.name === name)) {
      toast.error("Name taken");
      return;
    }

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
    toast.info(`"${proxyName}" ${!active ? "ON" : "OFF"}`);
  }

  return (
    <div className="pixel-box overflow-hidden">
      <div className="px-4 py-3 border-b-2 border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[9px] font-pixel text-bttext">PROXY ACCOUNTS</h2>
          <span className="text-[7px] font-pixel text-btmuted">
            {proxyAccounts.length} | {proxyAccounts.filter((p) => p.active).length} ON
          </span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="pixel-btn bg-btgreen text-black px-3 py-1 font-pixel text-[7px] border-btgreen"
        >
          + NEW
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-4 py-4 border-b-2 border-btborder bg-btdark">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="proxy-1"
                className="w-full px-3 py-2"
              />
            </div>
            <div>
              <label className="text-[7px] font-pixel text-btmuted uppercase mb-1 block">BUDGET</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                className="w-full py-2 pixel-btn bg-btgreen text-black font-pixel text-[7px] border-btgreen"
              >
                CREATE
              </button>
            </div>
          </div>
          <p className="text-[6px] font-pixel text-btmuted mt-2">
            CREATES NEW HOTKEY FOR ISOLATED COPY TRADING
          </p>
        </div>
      )}

      {/* Proxy list */}
      {proxyAccounts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[8px] font-pixel text-btmuted mb-1">NO PROXIES</p>
          <p className="text-[7px] font-pixel text-btmuted">
            {">> CREATE PROXY TO START"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-btborder/50">
          {proxyAccounts.map((proxy) => (
            <div key={proxy.name} className="px-4 py-3 flex items-center gap-4 row-hover">
              {/* Status */}
              <div
                className={`w-3 h-3 ${
                  proxy.active ? "bg-btgreen pulse-dot" : "bg-btmuted"
                }`}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-pixel text-bttext">{proxy.name}</span>
                  {proxy.following && (
                    <span className="text-[6px] font-pixel text-btblue bg-btblue/10 px-1.5 py-0.5 border border-btblue">
                      COPY {shortAddress(proxy.following)}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[6px] font-pixel text-btmuted">
                    CK:{shortAddress(proxy.coldkey)}
                  </span>
                  <span className="text-[6px] font-pixel text-btmuted">
                    HK:{shortAddress(proxy.hotkey)}
                  </span>
                </div>
              </div>

              {/* Budget */}
              <div className="text-right">
                <p className="text-[8px] font-pixel text-bttext">{proxy.budget_tao.toFixed(2)} TAO</p>
                <p className="text-[6px] font-pixel text-btmuted">BUDGET</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(proxy.name, proxy.active)}
                  className={`pixel-btn px-2 py-0.5 text-[6px] font-pixel ${
                    proxy.active
                      ? "bg-btyellow text-black border-btyellow"
                      : "bg-btgreen text-black border-btgreen"
                  }`}
                >
                  {proxy.active ? "PAUSE" : "START"}
                </button>
                <button
                  onClick={() => {
                    removeProxy(proxy.name);
                    toast.info(`Removed "${proxy.name}"`);
                  }}
                  className="pixel-btn px-2 py-0.5 text-[6px] font-pixel bg-btred text-white border-btred"
                >
                  DEL
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
