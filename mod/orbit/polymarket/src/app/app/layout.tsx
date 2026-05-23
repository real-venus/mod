import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { CopyEngineProvider } from "./context/CopyEngineContext";
import { FiltersProvider } from "./context/FiltersContext";
import { SidebarProvider } from "./context/SidebarContext";
import { SplitProvider } from "./context/SplitContext";
import SidebarShell from "./components/SidebarShell";
import SplitShell from "./components/SplitShell";
import MarketTicker from "./components/MarketTicker";
import BuildBadge from "./components/BuildBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SUPER POLYMARKET BROS - Prediction Market Terminal",
  description: "Mario-themed black & white Polymarket trading terminal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-pixel antialiased bg-pixel-bg text-pixel-white min-h-screen">
        <AuthProvider>
          <CopyEngineProvider>
          <FiltersProvider>
            <SidebarProvider>
              <SplitProvider>
                <div className="crt-overlay" />
                <div className="crt-screen min-h-screen">
                  <MarketTicker />
                  <SplitShell>
                    <SidebarShell>
                      <main>{children}</main>
                    </SidebarShell>
                  </SplitShell>
                  <BuildBadge />
                </div>
              </SplitProvider>
            </SidebarProvider>
          </FiltersProvider>
          </CopyEngineProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
