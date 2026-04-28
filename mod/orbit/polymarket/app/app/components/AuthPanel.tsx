"use client";

import { useAuth } from "../context/AuthContext";
import { shortAddress } from "../lib/auth";

export default function AuthPanel() {
  const { auth, connect, authenticate, error, loading, hasWallet } = useAuth();

  if (auth.authenticated) {
    return (
      <div className="pixel-panel p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 border-2 border-pixel-green flex items-center justify-center">
            <div className="w-4 h-4 bg-pixel-green animate-pulse" />
          </div>
          <div>
            <div className="text-[12px] text-pixel-green glow-green">AUTHENTICATED</div>
            <div className="text-[10px] text-pixel-gray font-mono mt-0.5">
              {shortAddress(auth.address || "")}
            </div>
          </div>
        </div>
        <div className="space-y-2 text-[10px]">
          <div className="flex justify-between">
            <span className="text-pixel-gray">API KEY:</span>
            <span className="text-pixel-cyan font-mono">
              {auth.clobCreds?.apiKey?.slice(0, 12)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-pixel-gray">STATUS:</span>
            <span className="text-pixel-green">ACTIVE</span>
          </div>
          <div className="flex justify-between">
            <span className="text-pixel-gray">CHAIN:</span>
            <span className="text-pixel-amber">POLYGON (137)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pixel-panel p-6 space-y-5">
      <div className="text-center">
        <div className="text-sm text-pixel-amber glow-amber mb-3">AUTHENTICATION</div>
        <div className="text-[10px] text-pixel-gray leading-relaxed">
          CONNECT YOUR WALLET AND SIGN A MESSAGE TO
          GENERATE API CREDENTIALS FOR THE POLYMARKET CLOB
        </div>
      </div>

      {/* Step 1: Connect */}
      <div className={`p-4 ${auth.connected ? "pixel-panel" : "pixel-panel-amber"}`}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className={`w-6 h-6 border-2 flex items-center justify-center text-[10px] ${
            auth.connected ? "border-pixel-green text-pixel-green" : "border-pixel-amber text-pixel-amber"
          }`}>
            {auth.connected ? "V" : "1"}
          </div>
          <span className="text-[11px] text-pixel-white">CONNECT WALLET</span>
        </div>
        {auth.connected ? (
          <div className="text-[10px] text-pixel-green font-mono ml-8">
            CONNECTED: {shortAddress(auth.address || "")}
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={loading}
            className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10 w-full"
          >
            {loading ? "CONNECTING..." : hasWallet ? "CONNECT METAMASK" : "INSTALL WALLET"}
          </button>
        )}
      </div>

      {/* Step 2: Sign & Auth */}
      <div className={`p-4 ${auth.connected ? "pixel-panel-amber" : "pixel-panel opacity-40"}`}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className={`w-6 h-6 border-2 flex items-center justify-center text-[10px] ${
            auth.authenticated ? "border-pixel-green text-pixel-green" : "border-pixel-amber text-pixel-amber"
          }`}>
            {auth.authenticated ? "V" : "2"}
          </div>
          <span className="text-[11px] text-pixel-white">DERIVE API KEY</span>
        </div>
        <div className="text-[9px] text-pixel-gray ml-8 mb-3">
          SIGNS EIP-712 MESSAGE TO DERIVE BEARER TOKEN
        </div>
        {auth.connected && !auth.authenticated && (
          <button
            onClick={authenticate}
            disabled={loading || !auth.connected}
            className="pixel-btn border-pixel-amber text-pixel-amber bg-pixel-amber/10 w-full"
          >
            {loading ? "SIGNING..." : "SIGN & GENERATE KEY"}
          </button>
        )}
      </div>

      {error && (
        <div className="pixel-panel-red p-3 text-[10px] text-pixel-red text-center">
          {error}
        </div>
      )}
    </div>
  );
}
