/**
 * lib/ensure-battles.ts
 *
 * Ensures minimum 5 active system battles at all times.
 * - Hardcoded safe tokens with logos (no external API dependency)
 * - Uses SERVICE_ROLE key via lib/supabase (bypasses RLS)
 * - Battles last 3–10 minutes so users have time to join
 * - Called by /api/battles on every GET (primary trigger)
 * - Called by Vercel Cron every minute via /api/ensure-battles (backup)
 */

import { dbSelect, dbInsert, dbPatch } from '@/lib/supabase';

// ── Safe token registry ───────────────────────────────────────────────────────
export const SAFE_TOKENS = [
  { symbol: 'BONK',   name: 'Bonk',        logoUrl: 'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg' },
  { symbol: 'WIF',    name: 'dogwifhat',   logoUrl: 'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg' },
  { symbol: 'POPCAT', name: 'Popcat',      logoUrl: 'https://assets.coingecko.com/coins/images/33908/large/popcat.png' },
  { symbol: 'MYRO',   name: 'Myro',        logoUrl: 'https://assets.coingecko.com/coins/images/33427/large/myro.png' },
  { symbol: 'SOL',    name: 'Solana',      logoUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  { symbol: 'BOME',   name: 'Book of Meme',logoUrl: 'https://assets.coingecko.com/coins/images/35215/large/bome.png' },
  { symbol: 'PEPE',   name: 'Pepe',        logoUrl: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg' },
  { symbol: 'MRUSH',  name: 'MemeRush',    logoUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c' },
];

// ── Config ────────────────────────────────────────────────────────────────────
const MIN_BATTLES = 5;
// 3 to 10 minutes — users must have time to see and join battles
const DURATIONS   = [180, 240, 300, 420, 600];
// ~$0.10 at $125/SOL for minimum, up to ~$1 for max
const MIN_BET     = 0.001;
const MAX_BET     = 0.008;

// ── Helpers ───────────────────────────────────────────────────────────────────
function genId(): string {
  return `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function pickPair(usedPairs: Set<string>): [string, string] | null {
  const shuffled = [...SAFE_TOKENS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const a = shuffled[i].symbol;
      const b = shuffled[j].symbol;
      if (!usedPairs.has(`${a}_${b}`) && !usedPairs.has(`${b}_${a}`)) {
        return [a, b];
      }
    }
  }
  return [shuffled[0].symbol, shuffled[1].symbol];
}

// ── Live price cache (5-minute TTL) ──────────────────────────────────────────
const CG_IDS: Record<string, string> = {
  SOL: 'solana', BONK: 'bonk', WIF: 'dogwifcoin', POPCAT: 'popcat',
  BOME: 'book-of-meme', MYRO: 'myro', PEPE: 'pepe',
};
let _priceCache: Record<string, { price: number; ch24: number; at: number }> = {};

async function getLivePrices(symbols: string[]): Promise<Record<string, { price: number; ch24: number }>> {
  const now    = Date.now();
  const stale  = symbols.filter(s => { const c = _priceCache[s]; return !c || now - c.at > 5 * 60_000; });
  if (stale.length > 0) {
    const ids = stale.map(s => CG_IDS[s]).filter(Boolean).join(',');
    if (ids) {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
          { cache: 'no-store', signal: AbortSignal.timeout(5_000) },
        );
        if (res.ok) {
          const d = await res.json() as Record<string, { usd: number; usd_24h_change: number }>;
          for (const s of stale) {
            const id = CG_IDS[s];
            if (id && d[id]) _priceCache[s] = { price: d[id].usd, ch24: d[id].usd_24h_change ?? 0, at: now };
          }
        }
      } catch { /* non-fatal */ }
    }
  }
  const out: Record<string, { price: number; ch24: number }> = {};
  for (const s of symbols) {
    out[s] = _priceCache[s] ? { price: _priceCache[s].price, ch24: _priceCache[s].ch24 } : { price: 0, ch24: 0 };
  }
  return out;
}

// ── Create one battle ─────────────────────────────────────────────────────────
async function createSystemBattle(tokenA: string, tokenB: string): Promise<boolean> {
  const now       = new Date();
  const duration  = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
  const endTime   = new Date(now.getTime() + duration * 1_000);
  const amount    = parseFloat((MIN_BET + Math.random() * (MAX_BET - MIN_BET)).toFixed(4));
  const prizePool = parseFloat((amount * 0.98).toFixed(6));
  const prices    = await getLivePrices([tokenA, tokenB]);

  const ok = await dbInsert('mr_battles', {
    id:               genId(),
    creator:          'system',
    mode:             'arena',
    type:             'system',
    token_a:          tokenA,
    token_b:          tokenB,
    amount,
    prize_pool:       prizePool,
    total_deposited:  0,
    fee_collected:    0,
    status:           'live',
    payment:          'SOL',
    players:          Math.floor(Math.random() * 6) + 1,
    start_time:       now.toISOString(),
    end_time:         endTime.toISOString(),
    created_at:       now.toISOString(),
    // Store live price snapshot for frontend display
    // Stored in the `meta` JSONB column; ignored if column doesn't exist yet
    meta: {
      tokenA_price: prices[tokenA]?.price ?? 0,
      tokenB_price: prices[tokenB]?.price ?? 0,
      tokenA_ch24:  prices[tokenA]?.ch24  ?? 0,
      tokenB_ch24:  prices[tokenB]?.ch24  ?? 0,
    },
  });

  if (ok) console.log(`[EnsureBattles] ✅ ${tokenA} vs ${tokenB} ${duration}s $${prices[tokenA]?.price ?? 0}`);
  else    console.error(`[EnsureBattles] ❌ Insert failed: ${tokenA} vs ${tokenB}`);
  return ok;
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface EnsureResult {
  existing: number;
  created:  number;
  needed:   number;
  errors:   string[];
}

export async function ensureMinimumBattles(): Promise<EnsureResult> {
  const result: EnsureResult = { existing: 0, created: 0, needed: 0, errors: [] };
  try {
    const now  = new Date().toISOString();
    const live = await dbSelect<{ id: string; token_a: string; token_b: string }>(
      'mr_battles',
      `status=eq.live&end_time=gt.${now}&select=id,token_a,token_b`,
    );
    result.existing = live.length;
    result.needed   = Math.max(0, MIN_BATTLES - live.length);
    if (result.needed === 0) return result;

    console.log(`[EnsureBattles] Need ${result.needed} more (have ${live.length}/${MIN_BATTLES})`);
    const usedPairs = new Set(live.map(b => `${b.token_a}_${b.token_b}`));

    for (let i = 0; i < result.needed; i++) {
      const pair = pickPair(usedPairs);
      if (!pair) { result.errors.push('No pair available'); break; }
      const [a, b] = pair;
      usedPairs.add(`${a}_${b}`);
      const ok = await createSystemBattle(a, b);
      if (ok) result.created++;
      else    result.errors.push(`Insert failed: ${a} vs ${b}`);
    }

    cleanupExpiredBattles().catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(msg);
    console.error('[EnsureBattles] Fatal:', msg);
  }
  return result;
}

async function cleanupExpiredBattles(): Promise<void> {
  const now = new Date().toISOString();
  try {
    const expired = await dbSelect<{ id: string }>(
      'mr_battles', `status=eq.live&mode=eq.arena&end_time=lt.${now}&select=id`,
    );
    for (const b of expired) await dbPatch('mr_battles', `id=eq.${b.id}`, { status: 'paid', ended_at: now });
    if (expired.length > 0) console.log(`[EnsureBattles] Cleaned ${expired.length} expired`);
  } catch { /* non-critical */ }
}
