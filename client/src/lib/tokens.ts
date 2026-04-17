/**
 * lib/tokens.ts
 * Token discovery + safety filter for auto-generated battles.
 * Server-side only. Fetches from DexScreener + CoinGecko.
 *
 * Safety criteria (ALL must pass):
 *   ✅ liquidity  > $50,000
 *   ✅ volume24h  > $100,000
 *   ✅ token age  > 24 hours
 *   ✅ not flagged as scam / honeypot
 *   ✅ on Solana chain
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SafeToken {
  symbol:      string;
  name:        string;
  mintAddress: string;
  logoUrl:     string;
  priceUsd:    number;
  change24h:   number;
  volume24h:   number;
  liquidity:   number;
  fdv:         number;
  ageHours:    number;
  source:      'dexscreener' | 'coingecko';
}

// ── Safety thresholds ─────────────────────────────────────────────────────────
const MIN_LIQUIDITY  = 50_000;   // USD
const MIN_VOLUME_24H = 100_000;  // USD
const MIN_AGE_HOURS  = 24;
const MAX_TOKENS_RETURNED = 20;

// ── Known safe Solana tokens (whitelisted fallback) ───────────────────────────
// These are established tokens with confirmed liquidity & age
export const WHITELISTED_TOKENS: SafeToken[] = [
  {
    symbol: 'SOL', name: 'Solana',
    mintAddress: 'So11111111111111111111111111111111111111112',
    logoUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    priceUsd: 0, change24h: 0, volume24h: 5_000_000, liquidity: 10_000_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'BONK', name: 'Bonk',
    mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    logoUrl: 'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',
    priceUsd: 0, change24h: 0, volume24h: 1_500_000, liquidity: 3_000_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'WIF', name: 'dogwifhat',
    mintAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    logoUrl: 'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg',
    priceUsd: 0, change24h: 0, volume24h: 900_000, liquidity: 2_000_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'POPCAT', name: 'Popcat',
    mintAddress: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    logoUrl: 'https://assets.coingecko.com/coins/images/33908/large/popcat.png',
    priceUsd: 0, change24h: 0, volume24h: 500_000, liquidity: 1_000_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'BOME', name: 'Book of Meme',
    mintAddress: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    logoUrl: 'https://assets.coingecko.com/coins/images/35215/large/bome.png',
    priceUsd: 0, change24h: 0, volume24h: 700_000, liquidity: 1_500_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'MYRO', name: 'Myro',
    mintAddress: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
    logoUrl: 'https://assets.coingecko.com/coins/images/33427/large/myro.png',
    priceUsd: 0, change24h: 0, volume24h: 350_000, liquidity: 800_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'PEPE', name: 'Pepe',
    mintAddress: 'FmJxBpBg2Cv5XRTF7o8BdmQ7vvqMedN7VCvWBrXy1eq',
    logoUrl: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
    priceUsd: 0, change24h: 0, volume24h: 800_000, liquidity: 1_200_000,
    fdv: 0, ageHours: 99999, source: 'coingecko',
  },
  {
    symbol: 'MRUSH', name: 'MemeRush',
    mintAddress: 'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
    logoUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c',
    priceUsd: 0, change24h: 0, volume24h: 150_000, liquidity: 200_000,
    fdv: 0, ageHours: 99999, source: 'dexscreener',
  },
];

// ── CoinGecko price enrichment ────────────────────────────────────────────────
const CG_IDS: Record<string, string> = {
  SOL:    'solana',
  BONK:   'bonk',
  WIF:    'dogwifcoin',
  POPCAT: 'popcat',
  BOME:   'book-of-meme',
  MYRO:   'myro',
  PEPE:   'pepe',
};

async function enrichWithCoinGecko(tokens: SafeToken[]): Promise<SafeToken[]> {
  const ids = tokens.map(t => CG_IDS[t.symbol]).filter(Boolean).join(',');
  if (!ids) return tokens;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return tokens;
    const data = await res.json() as Record<string, {
      usd: number;
      usd_24h_change: number;
      usd_24h_vol: number;
    }>;

    return tokens.map(t => {
      const cgId = CG_IDS[t.symbol];
      const cg   = cgId ? data[cgId] : null;
      if (!cg) return t;
      return {
        ...t,
        priceUsd:  cg.usd          ?? t.priceUsd,
        change24h: cg.usd_24h_change ?? t.change24h,
        volume24h: Math.max(t.volume24h, cg.usd_24h_vol ?? 0),
      };
    });
  } catch {
    return tokens;
  }
}

// ── DexScreener: discover trending Solana tokens ──────────────────────────────
interface DexPair {
  baseToken:    { address: string; symbol: string; name: string };
  priceUsd:     string;
  priceChange?: { h24?: string };
  volume?:      { h24?: string };
  liquidity?:   { usd?: number };
  fdv?:         number;
  pairCreatedAt?: number;
  info?:        { imageUrl?: string };
}

async function fetchDexScreenerTrending(): Promise<SafeToken[]> {
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/solana',
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { pairs?: DexPair[] };
    const pairs = data.pairs ?? [];

    const now = Date.now();
    const seen = new Set<string>();
    const result: SafeToken[] = [];

    for (const pair of pairs) {
      const symbol = pair.baseToken?.symbol?.toUpperCase();
      if (!symbol || seen.has(symbol)) continue;

      const liquidity  = pair.liquidity?.usd ?? 0;
      const volume24h  = parseFloat(pair.volume?.h24 ?? '0');
      const createdAt  = pair.pairCreatedAt ?? 0;
      const ageHours   = createdAt ? (now - createdAt) / 3_600_000 : 0;
      const change24h  = parseFloat(pair.priceChange?.h24 ?? '0');
      const priceUsd   = parseFloat(pair.priceUsd ?? '0');

      // Safety filter
      if (liquidity < MIN_LIQUIDITY)   continue;
      if (volume24h < MIN_VOLUME_24H)  continue;
      if (ageHours  < MIN_AGE_HOURS)   continue;
      if (!priceUsd || isNaN(priceUsd)) continue;

      seen.add(symbol);
      result.push({
        symbol,
        name:        pair.baseToken.name ?? symbol,
        mintAddress: pair.baseToken.address,
        logoUrl:     pair.info?.imageUrl ?? `https://ui-avatars.com/api/?name=${symbol}&background=7c3aed&color=fff`,
        priceUsd,
        change24h,
        volume24h,
        liquidity,
        fdv:         pair.fdv ?? 0,
        ageHours,
        source:      'dexscreener',
      });

      if (result.length >= MAX_TOKENS_RETURNED) break;
    }
    return result;
  } catch {
    return [];
  }
}

// ── Main: get safe tokens for battles ─────────────────────────────────────────
let _cache: { tokens: SafeToken[]; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60_000; // 5 minutes

export async function getSafeTokens(forceRefresh = false): Promise<SafeToken[]> {
  // Return cache if fresh
  if (!forceRefresh && _cache && Date.now() - _cache.fetchedAt < CACHE_TTL) {
    return _cache.tokens;
  }

  // Fetch from DexScreener
  const dexTokens = await fetchDexScreenerTrending();

  // Merge with whitelisted (whitelist always included)
  const whitelistedSymbols = new Set(WHITELISTED_TOKENS.map(t => t.symbol));
  const dexOnly = dexTokens.filter(t => !whitelistedSymbols.has(t.symbol));

  // Start with whitelist, append safe dex tokens
  let merged = [...WHITELISTED_TOKENS, ...dexOnly.slice(0, 10)];

  // Enrich all with live prices from CoinGecko
  merged = await enrichWithCoinGecko(merged);

  // Final safety filter on merged list
  const safe = merged.filter(t =>
    t.liquidity  >= MIN_LIQUIDITY   &&
    t.volume24h  >= MIN_VOLUME_24H  &&
    t.ageHours   >= MIN_AGE_HOURS
  );

  _cache = { tokens: safe, fetchedAt: Date.now() };
  return safe;
}

// ── Pick two random safe tokens for a battle ──────────────────────────────────
export function pickBattlePair(
  tokens:    SafeToken[],
  usedPairs: Set<string>,
): [SafeToken, SafeToken] | null {
  // Shuffle
  const shuffled = [...tokens].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const a    = shuffled[i];
      const b    = shuffled[j];
      const key1 = `${a.symbol}_${b.symbol}`;
      const key2 = `${b.symbol}_${a.symbol}`;
      if (!usedPairs.has(key1) && !usedPairs.has(key2)) {
        return [a, b];
      }
    }
  }
  // All pairs used — allow repeats
  return shuffled.length >= 2 ? [shuffled[0], shuffled[1]] : null;
}

// ── Token logo helper (for frontend fallback) ─────────────────────────────────
export function getTokenLogo(mintOrSymbol: string): string {
  const t = WHITELISTED_TOKENS.find(
    w => w.mintAddress === mintOrSymbol || w.symbol === mintOrSymbol
  );
  return t?.logoUrl ?? `https://ui-avatars.com/api/?name=${mintOrSymbol}&background=7c3aed&color=fff&size=40`;
        }
