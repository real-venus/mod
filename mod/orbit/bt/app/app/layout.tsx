import type { Metadata } from "next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "BT CopyTrade | Bittensor Subnet Alpha Trading",
  description: "Copy-trade top Bittensor stakers, swap subnet alpha tokens, and track the leaderboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased scanlines">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ToastContainer
          position="bottom-right"
          autoClose={4000}
          theme="dark"
          toastClassName="pixel-box !text-[8px]"
        />
      </body>
    </html>
  );
}
