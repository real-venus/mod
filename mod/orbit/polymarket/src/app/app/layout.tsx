import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { CopyEngineProvider } from "./context/CopyEngineContext";
import { FiltersProvider } from "./context/FiltersContext";
import { SidebarProvider } from "./context/SidebarContext";
import SidebarShell from "./components/SidebarShell";
import MarketTicker from "./components/MarketTicker";

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
              <div className="crt-overlay" />
              <div className="crt-screen min-h-screen">
                <MarketTicker />
                <SidebarShell>
                  <main>{children}</main>
                </SidebarShell>
              </div>
            </SidebarProvider>
          </FiltersProvider>
          </CopyEngineProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
