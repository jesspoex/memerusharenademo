import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MemeRush - Token Battle Arena",
  description: "Battle meme tokens in real-time on Solana. Bet SOL or MRUSH, winner takes the pool instantly. LP Burned. 100% Community.",
  keywords: ["meme token", "solana", "battle", "crypto", "MRUSH", "defi", "trading"],
  openGraph: {
    title: "MemeRush - Token Battle Arena",
    description: "Battle meme tokens in real-time. Winner takes the SOL pool instantly.",
    url: "https://www.meemerush.xyz",
    siteName: "MemeRush",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MemeRush - Token Battle Arena",
    description: "Battle meme tokens. Win SOL. Powered by $MRUSH on Solana.",
    site: "@memerushsol_",
    creator: "@memerushsol_",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
