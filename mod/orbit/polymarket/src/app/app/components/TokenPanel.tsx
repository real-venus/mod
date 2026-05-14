"use client";

import { useAuth } from "../context/AuthContext";

export default function TokenPanel() {
  const { generateToken, localToken } = useAuth();

  return (
    <div className="pixel-panel border-2 border-pixel-border bg-pixel-black">
      <div className="px-3 py-2 border-b-2 border-pixel-border">
        <div className="text-[9px] text-pixel-gray tracking-wider">LOCAL TOKEN</div>
      </div>

      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center justify-between text-[8px] text-pixel-gray tracking-wider">
          <span>STATUS</span>
          <span className={localToken ? "text-green-400" : "text-pixel-gray"}>
            {localToken ? "ACTIVE" : "NONE"}
          </span>
        </div>
        {localToken ? (
          <div className="text-[8px] text-pixel-gray-light font-mono">
            {localToken.tokenPreview}... · issued {new Date(localToken.issuedAt).toLocaleString()}
          </div>
        ) : (
          <div className="text-[8px] text-pixel-gray-light leading-relaxed">
            A 256-bit token stored only in this browser. No wallet, no signature.
            Unlocks strats and saved prefs (on-chain actions still need a wallet).
          </div>
        )}
        <button
          onClick={() => { generateToken(); }}
          className="pixel-btn text-[9px] px-2 py-1 border-green-400 text-green-400 hover:bg-green-400/10 w-full"
        >
          {localToken ? "REGENERATE TOKEN" : "GENERATE TOKEN"}
        </button>
      </div>
    </div>
  );
}
