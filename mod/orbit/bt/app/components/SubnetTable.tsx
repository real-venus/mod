"use client";

import { useEffect, useState } from "react";
import { useStore, type SubnetInfo } from "@/lib/store";
import { scanAllSubnets } from "@/lib/bittensor";
import { toast } from "react-toastify";

type SortKey = "netuid" | "name" | "price" | "tao_in" | "alpha_in" | "emission" | "market_cap";

export default function SubnetTable() {
  const { subnets, setSubnets, subnetsLoading, setSubnetsLoading } = useStore();
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (subnets.length === 0 && !subnetsLoading) {
      loadSubnets();
    }
  }, []);

  async function loadSubnets() {
    setSubnetsLoading(true);
    try {
      const data = await scanAllSubnets();
      setSubnets(data);
      toast.success(`Loaded ${data.length} subnets`);
    } catch (err: any) {
      toast.error(`Failed to load subnets: ${err.message}`);
    } finally {
      setSubnetsLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const filtered = subnets
    .filter((s) => {
      if (!search) return true;
      return (
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        String(s.netuid).includes(search)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDesc ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal);
    });

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-[10px] text-btmuted uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k && (sortDesc ? "↓" : "↑")}
    </th>
  );

  return (
    <div className="bg-btcard border border-btborder rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold">Subnet Alpha Tokens</h2>
          <span className="text-[10px] text-btmuted px-2 py-0.5 bg-btdark rounded-full">
            {subnets.length} subnets
          </span>
          {subnetsLoading && (
            <span className="text-[10px] text-btyellow animate-pulse">scanning...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subnets..."
            className="bg-btdark border border-btborder rounded-md px-3 py-1 text-xs text-white placeholder:text-btmuted focus:border-btgreen/50 focus:outline-none w-40"
          />
          <button
            onClick={loadSubnets}
            disabled={subnetsLoading}
            className="px-3 py-1 bg-btgreen/10 text-btgreen border border-btgreen/30 rounded-md text-xs hover:bg-btgreen/20 transition-all disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-btdark/50">
            <tr>
              <SortHeader label="NetUID" k="netuid" />
              <SortHeader label="Name" k="name" />
              <SortHeader label="Price (TAO)" k="price" />
              <SortHeader label="TAO In" k="tao_in" />
              <SortHeader label="Alpha In" k="alpha_in" />
              <SortHeader label="Market Cap" k="market_cap" />
              <SortHeader label="Emission" k="emission" />
              <th className="px-3 py-2 text-left text-[10px] text-btmuted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <SubnetRow key={s.netuid} subnet={s} />
            ))}
            {filtered.length === 0 && !subnetsLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-btmuted">
                  {subnets.length === 0 ? "Click Refresh to load subnets" : "No matching subnets"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubnetRow({ subnet: s }: { subnet: SubnetInfo }) {
  const { setActiveTab } = useStore();

  return (
    <tr className="border-t border-btborder/50 row-hover transition-colors">
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono text-btgreen">SN{s.netuid}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-medium">{s.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono">{s.price.toFixed(6)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono text-btmuted">{s.tao_in.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono text-btmuted">{s.alpha_in.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono">{s.market_cap.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-mono text-btyellow">{s.emission.toFixed(4)}</span>
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={() => setActiveTab("swap")}
          className="px-2 py-0.5 text-[10px] bg-btgreen/10 text-btgreen border border-btgreen/20 rounded hover:bg-btgreen/20 transition-all"
        >
          Trade
        </button>
      </td>
    </tr>
  );
}
