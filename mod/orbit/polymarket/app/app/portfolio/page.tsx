"use client";

import Header from "../components/Header";
import NavTabs from "../components/NavTabs";
import PositionsTable from "../components/PositionsTable";
import AuthPanel from "../components/AuthPanel";
import { useAuth } from "../context/AuthContext";

export default function PortfolioPage() {
  const { auth } = useAuth();

  return (
    <div className="max-w-[1920px] mx-auto">
      <Header
        showSearch={false}
        showSort={false}

        showCategories={false}
      />
      <NavTabs />
      <div className="p-4 space-y-4">
        {!auth.authenticated ? (
          <div className="max-w-md mx-auto">
            <AuthPanel />
          </div>
        ) : (
          <>
            <PositionsTable />
            <div className="pixel-panel p-5">
              <div className="text-[11px] text-pixel-gray-light tracking-wider mb-4">
                API CREDENTIALS
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="pixel-panel p-4">
                  <div className="text-[9px] text-pixel-gray mb-1.5">API KEY</div>
                  <div className="text-[11px] text-pixel-cyan font-mono truncate">
                    {auth.clobCreds?.apiKey || "---"}
                  </div>
                </div>
                <div className="pixel-panel p-4">
                  <div className="text-[9px] text-pixel-gray mb-1.5">PASSPHRASE</div>
                  <div className="text-[11px] text-pixel-amber font-mono truncate">
                    {auth.clobCreds?.passphrase?.slice(0, 16)}...
                  </div>
                </div>
                <div className="pixel-panel p-4">
                  <div className="text-[9px] text-pixel-gray mb-1.5">SECRET</div>
                  <div className="text-[11px] text-pixel-red font-mono">••••••••••••</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
