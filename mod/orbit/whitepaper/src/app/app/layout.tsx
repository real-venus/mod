import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOD — Off-Chain Merkle Tree Registry",
  description:
    "Whitepaper: scaling off-chain open-source management by storing the tree, not the leaves.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-serif">
        <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
