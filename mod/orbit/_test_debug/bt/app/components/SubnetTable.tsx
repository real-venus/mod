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
      className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted uppercase cursor-pointer hover:text-btgreen"
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k && (sortDesc ? "v" : "^")}
    </th>
  );

  return (
    <div className="pixel-box overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-btborder flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[9px] font-pixel text-bttext">SUBNET ALPHA</h2>
          <span className="text-[7px] font-pixel text-btmuted px-2 py-0.5 bg-btdark border border-btborder">
            {subnets.length}
          </span>
          {subnetsLoading && (
            <span className="text-[7px] font-pixel text-btyellow pulse-dot">SCANNING...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH..."
            className="px-3 py-1 w-40"
          />
          <button
            onClick={loadSubnets}
            disabled={subnetsLoading}
            className="pixel-btn bg-btgreen text-black px-3 py-1 font-pixel text-[7px] border-btgreen disabled:opacity-50"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-btdark">
            <tr>
              <SortHeader label="UID" k="netuid" />
              <SortHeader label="NAME" k="name" />
              <SortHeader label="PRICE" k="price" />
              <SortHeader label="TAO IN" k="tao_in" />
              <SortHeader label="ALPHA" k="alpha_in" />
              <SortHeader label="MCAP" k="market_cap" />
              <SortHeader label="EMIT" k="emission" />
              <th className="px-3 py-2 text-left text-[7px] font-pixel text-btmuted uppercase">ACT</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <SubnetRow key={s.netuid} subnet={s} />
            ))}
            {filtered.length === 0 && !subnetsLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[8px] font-pixel text-btmuted">
                  {subnets.length === 0 ? ">> CLICK REFRESH TO LOAD" : "NO MATCH FOUND"}
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
    <tr className="border-t border-btborder/50 row-hover">
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-btgreen">SN{s.netuid}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-bttext">{s.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-bttext">{s.price.toFixed(6)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-btmuted">{s.tao_in.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-btmuted">{s.alpha_in.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-bttext">{s.market_cap.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[8px] font-pixel text-btyellow">{s.emission.toFixed(4)}</span>
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={() => setActiveTab("swap")}
          className="pixel-btn bg-btgreen text-black px-2 py-0.5 text-[6px] font-pixel border-btgreen"
        >
          TRADE
        </button>
      </td>
    </tr>
  );
}
