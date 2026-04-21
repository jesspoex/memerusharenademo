/**
 * lib/dexscreener.ts
 * DexScreener API — fetch + score pairs for Solana tokens.
 * Browser-safe and server-safe. No external dependencies.
 */

const DS = 'https://api.dexscreener.com';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DsPair {
  chainId:      string;
  dexId:        string;
  pairAddress:  string;
  baseToken:  { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?:    string;
  volume?:    { h24?: number; h6?: number; h1?: number };
  priceChange?: { h24?: number; h6?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  info?:      { imageUrl?: string };
}

export interface ResolvedPair {
  pairAddress:   string;
  dexId:         string;
  dexUrl:        string;
  baseSymbol:    string;
  baseName:      string;
  baseAddress:   string;
  quoteSymbol:   string;
  logoUrl:       string | null;
  priceUsd:      number;
  change24h:     number;
  volume24h:     number;
  liquidityUsd:  number;
  score:         number;
}

// ── Cache (2-min TTL) ─────────────────────────────────────────────────────────
const _cache = new Map<string, { data: ResolvedPair | null; at: number }>();
const TTL = 2 * 60_000;

// ── Pair scoring ──────────────────────────────────────────────────────────────
// score = liquidity_usd * 0.6 + volume_24h * 0.3 + sol_quote_bonus(40_000)
// SOL-quote bonus rewards tighter-spread pairs on Solana.
export function scorePair(p: DsPair): number {
  const liq     = p.liquidity?.usd ?? 0;
  const vol     = p.volume?.h24    ?? 0;
  const solBonus = p.quoteToken.symbol === 'SOL' ? 40_000 : 0;
  return liq * 0.6 + vol * 0.3 + solBonus;
}

async function fetchRawPairs(mint: string): Promise<DsPair[]> {
  try {
    const r = await fetch(`${DS}/latest/dex/tokens/${mint}`, {
      cache: 'no-store', signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) return [];
    const d = await r.json() as { pairs?: DsPair[] };
    return (d.pairs ?? []).filter(p => p.chainId === 'solana');
  } catch { return []; }
}

async function fetchProfileIcon(mint: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${DS}/token-profiles/latest/v1?chainId=solana&tokenAddress=${mint}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5_000) },
    );
    if (!r.ok) return null;
    const d = await r.json() as { icon?: string } | Array<{ tokenAddress?: string; icon?: string }>;
    if (Array.isArray(d)) {
      return d.find(t => t.tokenAddress?.toLowerCase() === mint.toLowerCase())?.icon ?? null;
    }
    return (d as { icon?: string }).icon ?? null;
  } catch { return null; }
}

export async function resolveBestPair(mint: string): Promise<ResolvedPair | null> {
  const hit = _cache.get(mint);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const [pairs, profileIcon] = await Promise.all([
    fetchRawPairs(mint),
    fetchProfileIcon(mint),
  ]);

  if (!pairs.length) {
    _cache.set(mint, { data: null, at: Date.now() });
    return null;
  }

  const best    = [...pairs].sort((a, b) => scorePair(b) - scorePair(a))[0];
  const logoUrl = profileIcon ?? best.info?.imageUrl ?? null;

  const result: ResolvedPair = {
    pairAddress:  best.pairAddress,
    dexId:        best.dexId,
    dexUrl:       `https://dexscreener.com/solana/${best.pairAddress}`,
    baseSymbol:   best.baseToken.symbol,
    baseName:     best.baseToken.name,
    baseAddress:  best.baseToken.address,
    quoteSymbol:  best.quoteToken.symbol,
    logoUrl,
    priceUsd:     parseFloat(best.priceUsd ?? '0') || 0,
    change24h:    best.priceChange?.h24 ?? 0,
    volume24h:    best.volume?.h24 ?? 0,
    liquidityUsd: best.liquidity?.usd ?? 0,
    score:        scorePair(best),
  };

  _cache.set(mint, { data: result, at: Date.now() });
  return result;
}
