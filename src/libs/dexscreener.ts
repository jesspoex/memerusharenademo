// src/lib/dexscreener.ts
import type { TokenData } from '@/types';

export async function fetchTokenByCA(ca: string): Promise<TokenData | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      pairs?: Array<{
        baseToken: { address: string; symbol: string; name: string };
        priceUsd: string;
        priceChange: { h24: number };
        volume: { h24: number };
        liquidity: { usd: number };
        fdv: number;
        pairAddress: string;
        dexId: string;
        info?: { imageUrl?: string };
      }>;
    };

    if (!data.pairs?.length) return null;

    // Sort by liquidity, take best pair
    const pair = [...data.pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0];

    return {
      symbol:        pair.baseToken.symbol,
      name:          pair.baseToken.name,
      address:       pair.baseToken.address,
      price:         parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 ?? 0,
      volume24h:     pair.volume?.h24 ?? 0,
      liquidity:     pair.liquidity?.usd ?? 0,
      marketCap:     pair.fdv ?? 0,
      logoUrl:       pair.info?.imageUrl ?? '',
      pairAddress:   pair.pairAddress,
      dexId:         pair.dexId,
    };
  } catch {
    return null;
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPrice(n: number): string {
  if (!n) return '$0';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 1)      return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
