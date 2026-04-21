/**
 * hooks/useTokenMeta.ts
 * React hook + TokenLogo component.
 *
 * useTokenMeta(symbolOrAddress):
 *   - Returns instant logo (no flash) then upgrades async for mint addresses.
 *   - Module-level cache shared across all instances — one fetch per token.
 *
 * <TokenLogo>:
 *   - Always renders something — no broken icons.
 *   - No layout shift (fixed width/height from props).
 *   - onError auto-falls back to generated avatar.
 */
'use client';

import React, {
  useState, useEffect, useRef, useCallback, memo,
} from 'react';

// ── Static registry (duplicated here so hook is self-contained client-side) ───
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

function avatarUrl(sym: string): string {
  return `https://ui-avatars.com/api/?name=${sym.slice(0, 3).toUpperCase()}&background=ea580c&color=fff&size=64&bold=true&format=png`;
}

function instantLogo(symbolOrAddress: string): string {
  if (symbolOrAddress.length < 32) {
    return LOGO_REGISTRY[symbolOrAddress.toUpperCase()] ?? avatarUrl(symbolOrAddress);
  }
  return avatarUrl(symbolOrAddress); // mint address — show avatar while resolving
}

// ── Module-level cache (persists across renders / component mounts) ───────────
interface CachedMeta {
  symbol:   string;
  name:     string;
  logoUrl:  string;
  priceUsd: number;
  change24h: number;
  resolvedAt: number;
}
const _cache = new Map<string, CachedMeta>();
const CACHE_TTL = 2 * 60_000; // 2 min

async function fetchMetaFromDexScreener(mint: string): Promise<CachedMeta | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6_000) },
    );
    if (!r.ok) return null;

    const d = await r.json() as {
      pairs?: Array<{
        chainId:    string;
        baseToken:  { symbol: string; name: string };
        priceUsd?:  string;
        priceChange?: { h24?: number };
        liquidity?: { usd?: number };
        volume?:    { h24?: number };
        info?:      { imageUrl?: string };
      }>;
    };

    const pairs = (d.pairs ?? []).filter(p => p.chainId === 'solana');
    if (!pairs.length) return null;

    // Best pair = highest liquidity * 0.6 + volume * 0.3
    const best = [...pairs].sort((a, b) => {
      const sA = (a.liquidity?.usd ?? 0) * 0.6 + (a.volume?.h24 ?? 0) * 0.3;
      const sB = (b.liquidity?.usd ?? 0) * 0.6 + (b.volume?.h24 ?? 0) * 0.3;
      return sB - sA;
    })[0];

    const sym     = best.baseToken.symbol;
    const logoUrl = best.info?.imageUrl
      ?? LOGO_REGISTRY[sym.toUpperCase()]
      ?? avatarUrl(sym);

    return {
      symbol:    sym,
      name:      best.baseToken.name,
      logoUrl,
      priceUsd:  parseFloat(best.priceUsd ?? '0') || 0,
      change24h: best.priceChange?.h24 ?? 0,
      resolvedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export interface TokenMetaResult {
  symbol:    string;
  name:      string;
  logoUrl:   string;   // always valid URL
  priceUsd:  number;
  change24h: number;
  loading:   boolean;
}

export function useTokenMeta(
  symbolOrAddress: string,
  knownLogoUrl?: string, // pass gl(symbol) — used immediately, no wait
): TokenMetaResult {
  const isMint = symbolOrAddress.length >= 32;
  const key    = symbolOrAddress.toLowerCase();

  const getInitial = (): TokenMetaResult => ({
    symbol:    isMint ? symbolOrAddress.slice(0, 8) : symbolOrAddress.toUpperCase(),
    name:      symbolOrAddress.toUpperCase(),
    logoUrl:   knownLogoUrl ?? instantLogo(symbolOrAddress),
    priceUsd:  0,
    change24h: 0,
    loading:   isMint, // symbol-only: never needs to load
  });

  const [result, setResult] = useState<TokenMetaResult>(getInitial);

  useEffect(() => {
    if (!symbolOrAddress) return;

    // Check module cache
    const hit = _cache.get(key);
    if (hit && Date.now() - hit.resolvedAt < CACHE_TTL) {
      setResult({
        symbol:    hit.symbol,
        name:      hit.name,
        logoUrl:   hit.logoUrl,
        priceUsd:  hit.priceUsd,
        change24h: hit.change24h,
        loading:   false,
      });
      return;
    }

    if (!isMint) {
      // Symbol-only: logo from registry, no async needed
      const logo = knownLogoUrl ?? LOGO_REGISTRY[symbolOrAddress.toUpperCase()] ?? avatarUrl(symbolOrAddress);
      const resolved: TokenMetaResult = {
        symbol:    symbolOrAddress.toUpperCase(),
        name:      symbolOrAddress.toUpperCase(),
        logoUrl:   logo,
        priceUsd:  0,
        change24h: 0,
        loading:   false,
      };
      setResult(resolved);
      _cache.set(key, { ...resolved, resolvedAt: Date.now() });
      return;
    }

    // Mint address: show avatar immediately, fetch async
    setResult(getInitial());

    let cancelled = false;
    fetchMetaFromDexScreener(symbolOrAddress).then(meta => {
      if (cancelled) return;
      if (meta) {
        setResult({ ...meta, loading: false });
        _cache.set(key, meta);
      } else {
        // Resolve as avatar fallback
        setResult(prev => ({ ...prev, loading: false }));
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolOrAddress]);

  return result;
}

// ── TokenLogo component ───────────────────────────────────────────────────────
interface TokenLogoProps {
  symbol:     string;
  logoUrl?:   string; // pre-known logo from gl() — renders immediately
  size?:      number;
  className?: string;
}

export const TokenLogo = memo(function TokenLogo({
  symbol,
  logoUrl,
  size = 40,
  className = '',
}: TokenLogoProps) {
  const meta       = useTokenMeta(symbol, logoUrl);
  const [src, setSrc] = useState<string>(meta.logoUrl);
  const errored    = useRef(false);

  // Upgrade src when async resolution completes (no re-render if same URL)
  useEffect(() => {
    if (!errored.current) setSrc(meta.logoUrl);
  }, [meta.logoUrl]);

  const onError = useCallback(() => {
    if (!errored.current) {
      errored.current = true;
      setSrc(avatarUrl(symbol));
    }
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
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
  );
});
