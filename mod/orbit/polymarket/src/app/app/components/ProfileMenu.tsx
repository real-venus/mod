"use client";

import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

/// Right-side button that toggles the docked CopyIndex side panel. The top
/// bar already shows wallet/CLOB/token via dedicated chips, so this trigger
/// is purely the sidebar dock toggle.
export default function ProfileMenu() {
  const { auth, localToken } = useAuth();
  const { docked, toggleDocked } = useSidebar();

  const triggerColor = docked
    ? "border-pixel-white text-pixel-white bg-pixel-white/10"
    : auth.authenticated
    ? "border-green-400 text-green-400"
    : auth.connected
    ? "border-amber-400 text-amber-400"
    : localToken
    ? "border-green-400/60 text-green-400"
    : "border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white";

  return (
    <button
      onClick={toggleDocked}
      className={`pixel-btn text-[11px] px-2 py-1 transition-colors flex items-center gap-1.5 ${triggerColor}`}
      title="Profile / sign-in"
    >
      <div
        className={`w-1.5 h-1.5 ${
          auth.authenticated ? "bg-green-400" : auth.connected ? "bg-amber-400" : localToken ? "bg-green-400/70" : "bg-pixel-gray"
        }`}
      />
      <span className="font-mono">PANEL</span>
      <span className="text-[9px] opacity-60">{docked ? "◀" : "▶"}</span>
    </button>
  );
}
