import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHUTES // GPU Inference Terminal",
  description: "Serverless GPU inference — chat, generate, deploy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;600;700&family=Fira+Code:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
