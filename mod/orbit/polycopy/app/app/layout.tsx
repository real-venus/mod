import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";
import { NetworkProvider } from "./context/NetworkContext";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "POLYCOPY — Multi-Chain Copy Trading",
  description: "Monitor and manage copy trading strategies across Base, Polygon, and Arbitrum",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-mono antialiased bg-ibm-black text-ibm-green min-h-screen">
        <WalletProvider>
          <NetworkProvider>
            <div className="crt-overlay" />
            <Header />
            <main>{children}</main>
          </NetworkProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
