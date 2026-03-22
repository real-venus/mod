import type { Metadata } from "next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proton Manager",
  description: "Manage ProtonMail accounts locally",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-proton-deeper text-white antialiased">
        {children}
        <ToastContainer
          position="bottom-right"
          theme="dark"
          toastStyle={{ background: "#1e1650", color: "#e2e0f0" }}
        />
      </body>
    </html>
  );
}
