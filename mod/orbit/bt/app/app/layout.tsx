import type { Metadata } from "next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BT CopyTrade | Bittensor Subnet Alpha Trading",
  description: "Copy-trade top Bittensor stakers, swap subnet alpha tokens, and track the leaderboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-btdark antialiased">
        {children}
        <ToastContainer
          position="bottom-right"
          autoClose={4000}
          theme="dark"
          toastClassName="bg-btcard border border-btborder"
        />
      </body>
    </html>
  );
}
