"use client";

import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { shortAddress } from "@/lib/auth";

/// Right-side profile button. Click toggles the strats sidebar (which hosts
/// the full auth panel: connect wallet, sign for CLOB, generate local token,
/// disconnect).
export default function ProfileMenu() {
  const { auth, localToken } = useAuth();
  const { docked, toggleDocked } = useSidebar();

  // Pick a compact label for the trigger button based on the highest-fidelity
  // sign-in path the user currently has.
  const triggerLabel = (() => {
    if (auth.authenticated && auth.address) return shortAddress(auth.address);
    if (auth.connected && auth.address) return `${shortAddress(auth.address)} · UNSIGNED`;
    // When the sidebar is open, the full KEY+TOKEN is shown inside it — no
    // need to duplicate the token preview in the topbar trigger.
    if (localToken) return docked ? "PROFILE" : `TOKEN ${localToken.tokenPreview}`;
    return "SIGN IN";
  })();

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
      className={`pixel-btn text-[9px] px-2 py-1 transition-colors flex items-center gap-1.5 ${triggerColor}`}
      title="Profile / sign-in"
    >
      <div
        className={`w-1.5 h-1.5 ${
          auth.authenticated ? "bg-green-400" : auth.connected ? "bg-amber-400" : localToken ? "bg-green-400/70" : "bg-pixel-gray"
        }`}
      />
      <span className="font-mono">{triggerLabel}</span>
      <span className="text-[7px] opacity-60">{docked ? "◀" : "▶"}</span>
    </button>
  );
}
