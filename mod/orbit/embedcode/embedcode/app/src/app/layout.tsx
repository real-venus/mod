import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "embedcode",
  description: "Code embedding and semantic search with local models",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
