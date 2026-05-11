"use client";

import { useAuth } from "../context/AuthContext";

export default function ProfileAuthPanel() {
  const {
    auth, hasWallet, connect, disconnect, authenticate,
    generateToken, localToken, loading, error,
  } = useAuth();

  return (
    <div className="pixel-panel border-2 border-pixel-border bg-pixel-black">
      <div className="px-3 py-2 border-b-2 border-pixel-border">
        <div className="text-[9px] text-pixel-gray tracking-wider">PROFILE</div>
      </div>

      <div className="px-3 py-3 border-b border-pixel-border space-y-2">
        <div className="flex items-center justify-between text-[8px] text-pixel-gray tracking-wider">
          <span>WALLET</span>
          <span className={
            auth.authenticated ? "text-green-400"
              : auth.connected ? "text-amber-400"
              : "text-pixel-gray"
          }>
            {auth.authenticated ? "AUTHENTICATED" : auth.connected ? "CONNECTED · UNSIGNED" : "DISCONNECTED"}
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
              className="pixel-btn text-[9px] px-2 py-1 border-pixel-border text-pixel-gray hover:text-pixel-green hover:border-pixel-green"
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

      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center justify-between text-[8px] text-pixel-gray tracking-wider">
          <span>LOCAL TOKEN</span>
          <span className={localToken ? "text-green-400" : "text-pixel-gray"}>
            {localToken ? "ACTIVE" : "NONE"}
          </span>
        </div>
        {localToken ? (
          <div className="text-[8px] text-pixel-gray-light font-mono">
            {localToken.tokenPreview}… · issued {new Date(localToken.issuedAt).toLocaleString()}
          </div>
        ) : (
          <div className="text-[8px] text-pixel-gray-light leading-relaxed">
            A 256-bit token stored only in this browser. No wallet, no signature. Unlocks
            strats and saved prefs (on-chain actions still need a wallet).
          </div>
        )}
        <button
          onClick={() => { generateToken(); }}
          className="pixel-btn text-[9px] px-2 py-1 border-green-400 text-green-400 hover:bg-green-400/10 w-full"
        >
          {localToken ? "REGENERATE TOKEN" : "GENERATE TOKEN"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 border-t border-pixel-border">
          <div className="text-[8px] text-red-400 font-mono break-words">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
