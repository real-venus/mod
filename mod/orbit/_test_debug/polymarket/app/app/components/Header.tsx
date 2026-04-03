"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { shortAddress } from "../lib/auth";

export default function Header() {
  const { auth, hasWallet, connect, disconnect, authenticate, error, loading } = useAuth();
  const [dateStr, setDateStr] = useState("----.--.--");
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    setDateStr(new Date().toISOString().split("T")[0]);
  }, []);

  return (
    <header className="border-b-2 border-pixel-border bg-pixel-black/90 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-pixel-green flex items-center justify-center bg-pixel-bg relative">
            <span className="text-pixel-green text-[10px] glow-green">PM</span>
            {/* Pixel corners */}
            <div className="absolute -top-[2px] -left-[2px] w-1 h-1 bg-pixel-cyan" />
            <div className="absolute -top-[2px] -right-[2px] w-1 h-1 bg-pixel-cyan" />
            <div className="absolute -bottom-[2px] -left-[2px] w-1 h-1 bg-pixel-cyan" />
            <div className="absolute -bottom-[2px] -right-[2px] w-1 h-1 bg-pixel-cyan" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-pixel-green text-[10px] glow-green tracking-wider">
              POLYMARKET
            </span>
            <span className="text-pixel-cyan text-[6px] tracking-widest">
              8BIT TRADING TERMINAL
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="hidden lg:flex items-center gap-4 text-[7px] text-pixel-gray-light">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-pixel-green animate-pulse" />
            <span className="text-pixel-green">ONLINE</span>
          </div>
          <span className="text-pixel-border">|</span>
          <span className="text-pixel-amber glow-amber">{dateStr}</span>
          <span className="text-pixel-border">|</span>
          <span>POLYGON</span>
        </div>

        {/* Wallet / Auth */}
        <div className="flex items-center gap-2">
          {auth.connected ? (
            <div className="flex items-center gap-2">
              {/* Auth status */}
              {auth.authenticated ? (
                <div className="pixel-badge border-pixel-green text-pixel-green text-[6px]">
                  API READY
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(!showAuth)}
                  className="pixel-btn border-pixel-amber text-pixel-amber text-[7px] bg-pixel-amber/10"
                >
                  {loading ? "SIGNING..." : "GET API KEY"}
                </button>
              )}

              {/* Address */}
              <div className="pixel-panel px-3 py-1.5 flex items-center gap-2">
                <div className="w-2 h-2 bg-pixel-green" />
                <span className="text-pixel-green text-[7px] glow-green">
                  {shortAddress(auth.address || "")}
                </span>
                <button
                  onClick={disconnect}
                  className="text-pixel-gray hover:text-pixel-red transition-colors ml-1 text-[8px]"
                  title="Disconnect"
                >
                  X
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={loading}
              className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10 hover:bg-pixel-green/20"
            >
              {loading ? "CONNECTING..." : hasWallet ? "CONNECT WALLET" : "INSTALL WALLET"}
            </button>
          )}
        </div>
      </div>

      {/* Auth Panel Dropdown */}
      {showAuth && auth.connected && !auth.authenticated && (
        <div className="border-t-2 border-pixel-border bg-pixel-panel px-4 py-4">
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-[8px] text-pixel-amber glow-amber text-center">
              SIGN MESSAGE TO DERIVE API CREDENTIALS
            </div>
            <div className="text-[7px] text-pixel-gray text-center">
              THIS WILL SIGN AN EIP-712 MESSAGE WITH YOUR WALLET
              TO CREATE A BEARER TOKEN FOR THE POLYMARKET CLOB API
            </div>
            {error && (
              <div className="pixel-panel-red p-2 text-[7px] text-pixel-red text-center">
                {error}
              </div>
            )}
            <div className="flex justify-center gap-2">
              <button
                onClick={async () => {
                  await authenticate();
                  setShowAuth(false);
                }}
                disabled={loading}
                className="pixel-btn border-pixel-green text-pixel-green bg-pixel-green/10"
              >
                {loading ? "SIGNING..." : "SIGN & DERIVE KEY"}
              </button>
              <button
                onClick={() => setShowAuth(false)}
                className="pixel-btn border-pixel-gray text-pixel-gray"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
