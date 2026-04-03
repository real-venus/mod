import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLAUDE JOBS // 8BIT",
  description: "Background AI job runner — powered by Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="crt-screen">
        <div className="crt-overlay" />
        {children}
      </body>
    </html>
  );
}
