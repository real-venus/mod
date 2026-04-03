import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "POLYMARKET 8BIT - Prediction Market Terminal",
  description: "8-bit Polymarket trading terminal with copy trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-pixel antialiased bg-pixel-bg text-pixel-green min-h-screen">
        <AuthProvider>
          <div className="crt-overlay" />
          <div className="crt-screen min-h-screen">
            <Header />
            <main>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
