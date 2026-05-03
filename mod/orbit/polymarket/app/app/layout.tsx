import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { FiltersProvider } from "./context/FiltersContext";

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
          <FiltersProvider>
            <div className="crt-overlay" />
            <div className="crt-screen min-h-screen">
              <main>{children}</main>
            </div>
          </FiltersProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
