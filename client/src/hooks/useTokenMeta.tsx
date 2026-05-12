/**
 * hooks/useTokenMeta.ts
 * React hook + TokenLogo component.
 *
 * LOGO FIX (Issue 2):
 * - `errored` ref now resets when `symbol` or the resolved `src` changes,
 *   so a component reused with a different token always tries the real logo first.
 * - Fallback chain is strict: knownLogoUrl → registry → dsLookup → avatar.
 * - `instantLogo` always returns a real URL, never undefined.
 * - TokenLogo resets error state on prop change so logos reliably re-try.
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
  MRUSH:  '/mrush-logo.png',
  AUDD:   'https://assets.coingecko.com/coins/images/31273/large/AUDD.png',
};

// ── Avatar fallback — always resolves, never 404 ─────────────────────────────
export function avatar(sym: string): string {
  const label = (sym.length > 3 ? sym.slice(0, 3) : sym).toUpperCase();
  return `https://ui-avatars.com/api/?name=${label}&background=ea580c&color=fff&size=64&bold=true&format=png`;
}

// ── Instant logo (synchronous, zero network, always a valid URL) ──────────────
export function instantLogo(symbolOrAddress: string): string {
  if (!symbolOrAddress) return avatar('?');
  // For known symbols — return immediately from registry
  const upper = symbolOrAddress.toUpperCase();
  if (LOGO_REGISTRY[upper]) return LOGO_REGISTRY[upper];
  // For mint addresses or unknown symbols — generate avatar instantly
  return avatar(symbolOrAddress);
}

// ── Module-level cache (shared across all hook instances) ─────────────────────
interface Cached {
  symbol:    string;
  name:      string;
  logoUrl:   string;
  priceUsd:  number;
  change24h: number;
  at:        number;
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

    // Fallback chain for logo: imageUrl → registry → avatar
    const logoUrl =
      best.info?.imageUrl ||
      LOGO_REGISTRY[sym.toUpperCase()] ||
      avatar(sym);

    return {
      symbol:    sym,
      name:      best.baseToken.name,
      logoUrl,
      priceUsd:  parseFloat(best.priceUsd ?? '0') || 0,
      change24h: best.priceChange?.h24 ?? 0,
      at:        Date.now(),
    };
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export interface TokenMetaResult {
  symbol:    string;
  name:      string;
  logoUrl:   string;  // always a valid URL, never empty
  priceUsd:  number;
  change24h: number;
  loading:   boolean;
}

export function useTokenMeta(
  symbolOrAddress: string,
  knownLogoUrl?: string,
): TokenMetaResult {
  const isMint = symbolOrAddress.length >= 32;

  // Always compute a safe initial logo — never undefined
  const getInitial = useCallback((): TokenMetaResult => {
    // Priority: knownLogoUrl → registry → avatar
    const logo =
      (knownLogoUrl && knownLogoUrl.startsWith('http') ? knownLogoUrl : null) ??
      (!isMint ? (LOGO_REGISTRY[symbolOrAddress.toUpperCase()] ?? null) : null) ??
      instantLogo(symbolOrAddress);

    return {
      symbol:    isMint ? symbolOrAddress.slice(0, 8) : symbolOrAddress.toUpperCase(),
      name:      symbolOrAddress.toUpperCase(),
      logoUrl:   logo,
      priceUsd:  0,
      change24h: 0,
      loading:   isMint && !knownLogoUrl,
    };
  }, [symbolOrAddress, knownLogoUrl, isMint]);

  const [result, setResult] = useState<TokenMetaResult>(getInitial);

  useEffect(() => {
    if (!symbolOrAddress) return;
    const key = symbolOrAddress.toLowerCase();

    // Cache hit — use immediately
    const hit = _cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      // Prefer knownLogoUrl over cached if it looks valid (component refresh)
      const logo =
        (knownLogoUrl && knownLogoUrl.startsWith('http') ? knownLogoUrl : null) ??
        hit.logoUrl;
      setResult({ symbol: hit.symbol, name: hit.name, logoUrl: logo,
        priceUsd: hit.priceUsd, change24h: hit.change24h, loading: false });
      return;
    }

    if (!isMint) {
      // Symbol-only — instant resolution, no async needed
      const logo =
        (knownLogoUrl && knownLogoUrl.startsWith('http') ? knownLogoUrl : null) ??
        LOGO_REGISTRY[symbolOrAddress.toUpperCase()] ??
        avatar(symbolOrAddress);
      const r: TokenMetaResult = {
        symbol:    symbolOrAddress.toUpperCase(),
        name:      symbolOrAddress.toUpperCase(),
        logoUrl:   logo,
        priceUsd:  0,
        change24h: 0,
        loading:   false,
      };
      setResult(r);
      _cache.set(key, { ...r, at: Date.now() });
      return;
    }

    // Mint address: show best available logo instantly, upgrade async
    setResult(getInitial());
    let cancelled = false;

    dsLookup(symbolOrAddress).then(meta => {
      if (cancelled) return;
      if (meta) {
        // Prefer knownLogoUrl if provided (already known from battle data)
        const logo =
          (knownLogoUrl && knownLogoUrl.startsWith('http') ? knownLogoUrl : null) ??
          meta.logoUrl;
        const resolved = { ...meta, logoUrl: logo };
        setResult({ ...resolved, loading: false });
        _cache.set(key, resolved);
      } else {
        setResult(prev => ({ ...prev, loading: false }));
      }
    });

    return () => { cancelled = true; };
  // knownLogoUrl intentionally excluded — only refresh on symbol change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolOrAddress, isMint]);

  return result;
}

// ── TokenLogo ─────────────────────────────────────────────────────────────────
// Fixed size = no layout shift.
// BUG FIX: `errored` ref now resets when `symbol` or `logoUrl` prop changes
// so a reused component always attempts the new logo first.
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
  const meta    = useTokenMeta(symbol, logoUrl);

  // Compute the best src to try: explicit prop → resolved meta → avatar
  const bestSrc =
    (logoUrl && logoUrl.startsWith('http') ? logoUrl : null) ??
    meta.logoUrl ??
    avatar(symbol);

  const [src, setSrc]   = useState<string>(bestSrc);
  const errored         = useRef(false);
  const prevSymbol      = useRef(symbol);
  const prevLogoUrl     = useRef(logoUrl);

  // Reset error state when symbol or logoUrl prop changes
  useEffect(() => {
    const symbolChanged  = prevSymbol.current  !== symbol;
    const logoChanged    = prevLogoUrl.current !== logoUrl;
    if (symbolChanged || logoChanged) {
      errored.current      = false;
      prevSymbol.current   = symbol;
      prevLogoUrl.current  = logoUrl;
    }
  }, [symbol, logoUrl]);

  // Upgrade src when meta resolves (only if not already errored on this src)
  useEffect(() => {
    if (!errored.current) {
      const next =
        (logoUrl && logoUrl.startsWith('http') ? logoUrl : null) ??
        meta.logoUrl ??
        avatar(symbol);
      setSrc(next);
    }
  }, [meta.logoUrl, logoUrl, symbol]);

  const onError = useCallback(() => {
    if (!errored.current) {
      errored.current = true;
      setSrc(avatar(symbol));
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
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, ...style }}
    />
  );
});
