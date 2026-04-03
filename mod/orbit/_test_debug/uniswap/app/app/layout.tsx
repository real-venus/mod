import './globals.css';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const Providers = dynamic(() => import('./providers').then(m => ({ default: m.Providers })), { ssr: false });

export const metadata: Metadata = {
  title: 'UNISWAP ENGINE',
  description: 'Multichain Strategy Engine — 8-bit Edition',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-pixel bg-retro-bg text-retro-green grid-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
