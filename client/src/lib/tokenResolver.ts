/**
 * lib/tokenResolver.ts
 * Logo + metadata resolution pipeline with fallback chain.
 *
 * Priority order:
 *   1. LOGO_REGISTRY (instant, synchronous — known tokens)
 *   2. DexScreener token profile icon  (async)
 *   3. DexScreener pair info.imageUrl  (async)
 *   4. CoinGecko URL guess by symbol   (no API call needed)
 *   5. Generated initials avatar       (always works)
 */

import { resolveBestPair, type ResolvedPair } from './dexscreener';

// ── Static registry — known tokens resolve instantly without any API call ─────
export const LOGO_REGISTRY: Record<string, string> = {
  SOL:    'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  BONK:   'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',
  WIF:    'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg',
  POPCAT: 'https://assets.coingecko.com/coins/images/33908/large/popcat.png',
  BOME:   'https://assets.coingecko.com/coins/images/35215/large/bome.png',
  MYRO:   'https://assets.coingecko.com/coins/images/33427/large/myro.png',
  PEPE:   'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
  MRUSH:  'https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c',
};

// ── Fallback #5: generated initials avatar — never fails ─────────────────────
export function avatarUrl(symbolOrAddress: string): string {
  const label = symbolOrAddress.slice(0, 3).toUpperCase();
  return `https://ui-avatars.com/api/?name=${label}&background=ea580c&color=fff&size=64&bold=true&format=png`;
}

// ── Resolved token metadata ───────────────────────────────────────────────────
export interface TokenMeta {
  symbol:       string;
  name:         string;
  address:      string | null;
  logoUrl:      string;        // always a valid URL
  pairAddress:  string | null;
  dexId:        string | null;
  dexUrl:       string | null;
  priceUsd:     number;
  change24h:    number;
  volume24h:    number;
  liquidityUsd: number;
  resolvedAt:   number;
}

// ── Module cache (TTL: 2 min for mint addresses, 5 min for symbols) ───────────
const _meta = new Map<string, TokenMeta>();
const ADDR_TTL = 2 * 60_000;
const SYM_TTL  = 5 * 60_000;

// ── Core resolution ───────────────────────────────────────────────────────────
export async function resolveTokenMeta(input: string): Promise<TokenMeta> {
  const key    = input.toLowerCase();
  const isMint = input.length >= 32 && input.length <= 44 && !input.includes(' ');
  const ttl    = isMint ? ADDR_TTL : SYM_TTL;

  // Cache hit
  const cached = _meta.get(key);
  if (cached && Date.now() - cached.resolvedAt < ttl) return cached;

  if (isMint) {
    // ── Mint address path: use DexScreener ───────────────────────────────────
    const pair = await resolveBestPair(input);

    if (pair) {
      const meta: TokenMeta = {
        symbol:       pair.baseSymbol,
        name:         pair.baseName,
        address:      input,
        logoUrl:      pair.logoUrl
                        ?? LOGO_REGISTRY[pair.baseSymbol.toUpperCase()]
                        ?? avatarUrl(pair.baseSymbol),
        pairAddress:  pair.pairAddress,
        dexId:        pair.dexId,
        dexUrl:       pair.dexUrl,
        priceUsd:     pair.priceUsd,
        change24h:    pair.change24h,
        volume24h:    pair.volume24h,
        liquidityUsd: pair.liquidityUsd,
        resolvedAt:   Date.now(),
      };
      _meta.set(key, meta);
      return meta;
    }

    // DexScreener failed — minimal fallback
    const fallback: TokenMeta = {
      symbol:       input.slice(0, 6).toUpperCase(),
      name:         'Unknown Token',
      address:      input,
      logoUrl:      avatarUrl(input),
      pairAddress:  null, dexId: null, dexUrl: null,
      priceUsd: 0, change24h: 0, volume24h: 0, liquidityUsd: 0,
      resolvedAt: Date.now(),
    };
    _meta.set(key, fallback);
    return fallback;
  }

  // ── Symbol path: registry → avatar ───────────────────────────────────────
  const upper = input.toUpperCase();
  const meta: TokenMeta = {
    symbol:       upper,
    name:         upper,
    address:      null,
    logoUrl:      LOGO_REGISTRY[upper] ?? avatarUrl(upper),
    pairAddress:  null, dexId: null, dexUrl: null,
    priceUsd: 0, change24h: 0, volume24h: 0, liquidityUsd: 0,
    resolvedAt:   Date.now(),
  };
  _meta.set(key, meta);
  return meta;
}

// ── Logo-only fast path (no price data needed) ────────────────────────────────
export function logoFromRegistry(symbol: string): string | null {
  return LOGO_REGISTRY[symbol.toUpperCase()] ?? null;
}

export function resolveLogoSync(symbolOrAddress: string): string {
  // Instant — no async. Returns best available logo right now.
  if (symbolOrAddress.length < 32) {
    return LOGO_REGISTRY[symbolOrAddress.toUpperCase()] ?? avatarUrl(symbolOrAddress);
  }
  // Mint address: check cache, else avatar
  const cached = _meta.get(symbolOrAddress.toLowerCase());
  return cached?.logoUrl ?? avatarUrl(symbolOrAddress);
}

// ── DB-ready record ───────────────────────────────────────────────────────────
export interface TokenMetaForDB {
  address:      string;
  symbol:       string;
  name:         string;
  logo_url:     string;
  pair_address: string | null;
  dex_id:       string | null;
  dex_url:      string | null;
  price_usd:    number;
  liquidity_usd: number;
  updated_at:   string;
}

export function toDbRecord(meta: TokenMeta): TokenMetaForDB {
  return {
    address:      meta.address ?? '',
    symbol:       meta.symbol,
    name:         meta.name,
    logo_url:     meta.logoUrl,
    pair_address: meta.pairAddress,
    dex_id:       meta.dexId,
    dex_url:      meta.dexUrl,
    price_usd:    meta.priceUsd,
    liquidity_usd: meta.liquidityUsd,
    updated_at:   new Date().toISOString(),
  };
}
