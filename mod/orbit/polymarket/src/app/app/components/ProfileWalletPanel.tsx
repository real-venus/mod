"use client";

import { useAuth } from "../context/AuthContext";

export default function ProfileWalletPanel() {
  const { auth, hasWallet, connect, disconnect, authenticate, loading, error } = useAuth();

  return (
    <div className="pixel-panel border-2 border-pixel-border bg-pixel-black">
      <div className="px-3 py-2 border-b-2 border-pixel-border">
        <div className="text-[9px] text-pixel-gray tracking-wider">WALLET</div>
      </div>

      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center justify-between text-[8px] text-pixel-gray tracking-wider">
          <span>STATUS</span>
          <span className={
            auth.authenticated ? "text-green-400"
              : auth.connected ? "text-amber-400"
              : "text-pixel-gray"
          }>
            {auth.authenticated ? "AUTHENTICATED" : auth.connected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
        {auth.connected && auth.address && (
          <div className="text-[10px] text-pixel-white font-mono break-all">
            {auth.address}
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {!auth.connected ? (
            <button
              onClick={() => { void connect(); }}
              disabled={loading}
              className="pixel-btn text-[9px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-green hover:border-pixel-green w-full"
            >
              {loading ? "..." : hasWallet ? "CONNECT METAMASK" : "INSTALL WALLET"}
            </button>
          ) : (
            <>
              {!auth.authenticated && (
                <button
                  onClick={() => { void authenticate(); }}
                  disabled={loading}
                  className="pixel-btn text-[9px] px-2 py-1 border-amber-400 text-amber-400 hover:bg-amber-400/10"
                >
                  {loading ? "SIGNING..." : "SIGN FOR CLOB"}
                </button>
              )}
              <button
                onClick={() => { disconnect(); }}
                className="pixel-btn text-[9px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-red-400 hover:border-red-400"
              >
                DISCONNECT
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 border-t border-pixel-border">
          <div className="text-[8px] text-red-400 font-mono break-words">{error}</div>
        </div>
      )}
    </div>
  );
}
