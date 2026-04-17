/**
 * lib/price.ts
 * Token price data from DexScreener + CoinGecko.
 * Server-side only — winner determination is backend responsibility.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TokenPrice {
  symbol:    string;
  priceUsd:  number;
  change24h: number; // percentage
  source:    'coingecko' | 'dexscreener' | 'fallback';
}

export interface PriceCompare {
  tokenA:    TokenPrice;
  tokenB:    TokenPrice;
  winner:    string; // symbol of the winning token
  winnerPct: number; // winning % change
  loserPct:  number;
  method:    'price_change' | 'fallback_random';
}

// ── CoinGecko ID map ──────────────────────────────────────────────────────────
const CG_IDS: Record<string, string> = {
  SOL:    'solana',
  BONK:   'bonk',
  WIF:    'dogwifcoin',
  POPCAT: 'popcat',
  BOME:   'book-of-meme',
  MYRO:   'myro',
  PEPE:   'pepe',
  MRUSH:  '', // DexScreener only
};

// ── DexScreener mint addresses ────────────────────────────────────────────────
const DEX_MINTS: Record<string, string> = {
  MRUSH: 'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  BONK:  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF:   'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
};

// ── Fetch from CoinGecko ──────────────────────────────────────────────────────
async function fetchCoinGecko(symbols: string[]): Promise<Record<string, TokenPrice>> {
  const ids = symbols.map(s => CG_IDS[s.toUpperCase()]).filter(Boolean).join(',');
  if (!ids) return {};

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd: number; usd_24h_change: number }>;

    const result: Record<string, TokenPrice> = {};
    for (const symbol of symbols) {
      const id = CG_IDS[symbol.toUpperCase()];
      if (id && data[id]) {
        result[symbol.toUpperCase()] = {
          symbol:    symbol.toUpperCase(),
          priceUsd:  data[id].usd ?? 0,
          change24h: data[id].usd_24h_change ?? 0,
          source:    'coingecko',
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ── Fetch from DexScreener ────────────────────────────────────────────────────
async function fetchDexScreener(symbol: string): Promise<TokenPrice | null> {
  const mint = DEX_MINTS[symbol.toUpperCase()];
  if (!mint) return null;

  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      pairs?: Array<{
        priceUsd: string;
        priceChange?: { h24?: string };
        volume?: { h24?: string };
      }>;
    };

    if (!data.pairs?.length) return null;
    // Use highest volume pair
    const pair = [...data.pairs].sort(
      (a, b) => parseFloat(b.volume?.h24 ?? '0') - parseFloat(a.volume?.h24 ?? '0')
    )[0];

    return {
      symbol:    symbol.toUpperCase(),
      priceUsd:  parseFloat(pair.priceUsd) || 0,
      change24h: parseFloat(pair.priceChange?.h24 ?? '0'),
      source:    'dexscreener',
    };
  } catch {
    return null;
  }
}

// ── Main: Get prices for two tokens ──────────────────────────────────────────
export async function getTokenPrices(tokenA: string, tokenB: string): Promise<{
  priceA: TokenPrice | null;
  priceB: TokenPrice | null;
}> {
  const symA = tokenA.toUpperCase();
  const symB = tokenB.toUpperCase();

  // Fetch CoinGecko for both (batched)
  const [cgPrices, dexA, dexB] = await Promise.all([
    fetchCoinGecko([symA, symB]),
    DEX_MINTS[symA] ? fetchDexScreener(symA) : Promise.resolve(null),
    DEX_MINTS[symB] ? fetchDexScreener(symB) : Promise.resolve(null),
  ]);

  // Prefer CoinGecko, fallback to DexScreener
  const priceA = cgPrices[symA] ?? dexA ?? null;
  const priceB = cgPrices[symB] ?? dexB ?? null;

  return { priceA, priceB };
}

// ── Compare tokens → determine winner ────────────────────────────────────────
export async function compareTokens(tokenA: string, tokenB: string): Promise<PriceCompare> {
  const { priceA, priceB } = await getTokenPrices(tokenA, tokenB);

  if (priceA && priceB) {
    const winner    = priceA.change24h >= priceB.change24h ? tokenA : tokenB;
    const winnerPct = winner === tokenA ? priceA.change24h : priceB.change24h;
    const loserPct  = winner === tokenA ? priceB.change24h : priceA.change24h;
    return { tokenA: priceA, tokenB: priceB, winner, winnerPct, loserPct, method: 'price_change' };
  }

  // Fallback: if prices unavailable, we cannot fairly determine winner
  // In production: could use a VRF oracle. For now, log and use random.
  console.warn(`[Price] Could not fetch prices for ${tokenA} vs ${tokenB} — using random fallback`);
  const winnerRandom = Math.random() > 0.5 ? tokenA : tokenB;
  const fallbackPrice: TokenPrice = { symbol: '', priceUsd: 0, change24h: 0, source: 'fallback' };

  return {
    tokenA:    priceA ?? { ...fallbackPrice, symbol: tokenA },
    tokenB:    priceB ?? { ...fallbackPrice, symbol: tokenB },
    winner:    winnerRandom,
    winnerPct: 0,
    loserPct:  0,
    method:    'fallback_random',
  };
}
