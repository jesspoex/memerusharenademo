/**
 * hooks/useTokenMeta.ts — Step 4 final
 * React hook + TokenLogo component.
 *
 * useTokenMeta: instant logo via registry, async upgrade for mint addresses.
 * TokenLogo: memoized, fixed dimensions (no layout shift), onError → avatar.
 * Module-level cache — one DexScreener fetch per token per session (2 min TTL).
 */
'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

// ── Static registry — instant, zero network ───────────────────────────────────
const LOGO_REGISTRY: Record<string, string> = {
  SOL:    'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  BONK:   'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',
  WIF:    'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg',
  POPCAT: 'https://assets.coingecko.com/coins/images/33908/large/popcat.png',
  BOME:   'https://assets.coingecko.com/coins/images/35215/large/bome.png',
  MYRO:   'https://assets.coingecko.com/coins/images/33427/large/myro.png',
  PEPE:   'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
  MRUSH:  'https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c',
};

// ── Avatar fallback — always resolves, never 404 ─────────────────────────────
function avatar(sym: string): string {
  const label = (sym.length > 3 ? sym.slice(0, 3) : sym).toUpperCase();
  return `https://ui-avatars.com/api/?name=${label}&background=ea580c&color=fff&size=64&bold=true&format=png`;
}

// ── Instant logo (synchronous, zero network) ──────────────────────────────────
function instantLogo(sym: string): string {
  return LOGO_REGISTRY[sym.toUpperCase()] ?? avatar(sym);
}

// ── Module-level cache (shared across all hook instances) ─────────────────────
interface Cached {
  symbol:   string;
  name:     string;
  logoUrl:  string;
  priceUsd: number;
  change24h: number;
  at:       number;
}
const _cache = new Map<string, Cached>();
const TTL = 120_000; // 2 min

async function dsLookup(mint: string): Promise<Cached | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7_000) },
    );
    if (!r.ok) return null;

    const d = await r.json() as {
      pairs?: Array<{
        chainId:    string;
        baseToken:  { symbol: string; name: string };
        quoteToken: { symbol: string };
        priceUsd?:  string;
        priceChange?: { h24?: number };
        liquidity?: { usd?: number };
        volume?:    { h24?: number };
        info?:      { imageUrl?: string };
      }>;
    };

    const pairs = (d.pairs ?? [])
      .filter(p => p.chainId === 'solana')
      .sort((a, b) => {
        const sA = (a.liquidity?.usd ?? 0) * 0.6 + (a.volume?.h24 ?? 0) * 0.3
          + (a.quoteToken.symbol === 'SOL' ? 40_000 : 0);
        const sB = (b.liquidity?.usd ?? 0) * 0.6 + (b.volume?.h24 ?? 0) * 0.3
          + (b.quoteToken.symbol === 'SOL' ? 40_000 : 0);
        return sB - sA;
      });

    if (!pairs.length) return null;
    const best = pairs[0];
    const sym  = best.baseToken.symbol;

    return {
      symbol:   sym,
      name:     best.baseToken.name,
      logoUrl:  best.info?.imageUrl ?? LOGO_REGISTRY[sym.toUpperCase()] ?? avatar(sym),
      priceUsd: parseFloat(best.priceUsd ?? '0') || 0,
      change24h: best.priceChange?.h24 ?? 0,
      at: Date.now(),
    };
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export interface TokenMetaResult {
  symbol:   string;
  name:     string;
  logoUrl:  string;
  priceUsd: number;
  change24h: number;
  loading:  boolean;
}

export function useTokenMeta(
  symbolOrAddress: string,
  knownLogoUrl?: string, // pass gl(symbol) from parent — used instantly
): TokenMetaResult {
  const isMint = symbolOrAddress.length >= 32;

  const mkInitial = useCallback((): TokenMetaResult => ({
    symbol:   isMint ? symbolOrAddress.slice(0, 8) : symbolOrAddress.toUpperCase(),
    name:     symbolOrAddress.toUpperCase(),
    logoUrl:  knownLogoUrl ?? (isMint ? avatar(symbolOrAddress) : instantLogo(symbolOrAddress)),
    priceUsd: 0, change24h: 0,
    loading:  isMint,
  }), [symbolOrAddress, knownLogoUrl, isMint]);

  const [result, setResult] = useState<TokenMetaResult>(mkInitial);

  useEffect(() => {
    if (!symbolOrAddress) return;
    const key = symbolOrAddress.toLowerCase();

    const hit = _cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      setResult({ symbol: hit.symbol, name: hit.name, logoUrl: hit.logoUrl,
        priceUsd: hit.priceUsd, change24h: hit.change24h, loading: false });
      return;
    }

    if (!isMint) {
      const logo = knownLogoUrl ?? instantLogo(symbolOrAddress);
      const r: TokenMetaResult = {
        symbol: symbolOrAddress.toUpperCase(), name: symbolOrAddress.toUpperCase(),
        logoUrl: logo, priceUsd: 0, change24h: 0, loading: false,
      };
      setResult(r);
      _cache.set(key, { ...r, at: Date.now() });
      return;
    }

    // Mint address: show avatar instantly, upgrade async
    setResult(mkInitial());
    let cancelled = false;
    dsLookup(symbolOrAddress).then(meta => {
      if (cancelled) return;
      if (meta) {
        setResult({ ...meta, loading: false });
        _cache.set(key, meta);
      } else {
        setResult(prev => ({ ...prev, loading: false }));
      }
    });
    return () => { cancelled = true; };
  }, [symbolOrAddress, knownLogoUrl, isMint, mkInitial]);

  return result;
}

// ── TokenLogo ─────────────────────────────────────────────────────────────────
// Fixed size = no layout shift. onError → avatar. memo = no unnecessary rerenders.
interface TokenLogoProps {
  symbol:     string;
  logoUrl?:   string;
  size?:      number;
  className?: string;
  style?:     React.CSSProperties;
}

export const TokenLogo = memo(function TokenLogo({
  symbol, logoUrl, size = 40, className = '', style,
}: TokenLogoProps) {
  const meta       = useTokenMeta(symbol, logoUrl);
  const [src, setSrc] = useState(meta.logoUrl);
  const errored    = useRef(false);

  useEffect(() => {
    if (!errored.current) setSrc(meta.logoUrl);
  }, [meta.logoUrl]);

  const onError = useCallback(() => {
    if (!errored.current) { errored.current = true; setSrc(avatar(symbol)); }
  }, [symbol]);

  return (
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      onError={onError}
      loading="lazy"
      decoding="async"
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, ...style }}
    />
  );
});
