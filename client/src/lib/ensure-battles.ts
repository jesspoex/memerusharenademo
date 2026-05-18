/**
 * lib/ensure-battles.ts
 *
 * ARSITEKTUR: Supabase pg_cron menangani pembuatan battle otomatis.
 *
 * File ini dipakai sebagai:
 *   1. FALLBACK — jika pg_cron belum jalan
 *   2. SYNC call dari /api/battles untuk validasi real-time count
 *
 * IMPORTANT — MODE RULES:
 *   mode='arena'  → Demo/display only. User TIDAK boleh join dengan SOL real.
 *                   Battle ini murni untuk menunjukkan activity ke pengunjung.
 *   mode='real'   → User boleh join. SOL masuk treasury. Payout dieksekusi.
 *
 * FIX APPLIED:
 *   - System battles sekarang mode='arena' dengan flag joinable=false
 *   - cleanupExpired() sekarang memanggil refund jika ada bets
 *   - Fake player count dihapus → players=0 untuk system battles
 *   - Arena battles tidak bisa di-join via join-battle API
 */

import { dbSelect, dbInsert, dbPatch, getBetsForBattle } from '@/lib/supabase';
import { executePayout } from '@/lib/payout';

// ── Token registry ─────────────────────────────────────────────────────────
export const SAFE_TOKENS = [
  { symbol: 'BONK',   logoUrl: 'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg' },
  { symbol: 'WIF',    logoUrl: 'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg' },
  { symbol: 'POPCAT', logoUrl: 'https://assets.coingecko.com/coins/images/33908/large/popcat.png' },
  { symbol: 'MYRO',   logoUrl: 'https://assets.coingecko.com/coins/images/33427/large/myro.png' },
  { symbol: 'SOL',    logoUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  { symbol: 'BOME',   logoUrl: 'https://assets.coingecko.com/coins/images/35215/large/bome.png' },
  { symbol: 'PEPE',   logoUrl: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg' },
  { symbol: 'MRUSH',  logoUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c' },
];

const MIN_BATTLES = 5;
const DURATIONS   = [180, 240, 300, 420, 600];
const MIN_BET     = 0.001;
const MAX_BET     = 0.008;

// ── Price cache (5-min TTL) ────────────────────────────────────────────────
const CG_IDS: Record<string, string> = {
  SOL: 'solana', BONK: 'bonk', WIF: 'dogwifcoin', POPCAT: 'popcat',
  BOME: 'book-of-meme', MYRO: 'myro', PEPE: 'pepe',
};
let _priceCache: Record<string, { price: number; ch24: number; at: number }> = {};

async function getLivePrices(syms: string[]): Promise<Record<string, { price: number; ch24: number }>> {
  const now   = Date.now();
  const stale = syms.filter(s => { const c = _priceCache[s]; return !c || now - c.at > 5 * 60_000; });
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
  for (const s of syms) {
    out[s] = _priceCache[s] ? { price: _priceCache[s].price, ch24: _priceCache[s].ch24 } : { price: 0, ch24: 0 };
  }
  return out;
}

function genId(): string {
  return `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function pickPair(used: Set<string>): [string, string] | null {
  const shuffled = [...SAFE_TOKENS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const a = shuffled[i].symbol, b = shuffled[j].symbol;
      if (!used.has(`${a}_${b}`) && !used.has(`${b}_${a}`)) return [a, b];
    }
  }
  return [shuffled[0].symbol, shuffled[1].symbol];
}

async function createOneBattle(tokenA: string, tokenB: string): Promise<boolean> {
  const now      = new Date();
  const duration = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
  const end      = new Date(now.getTime() + duration * 1_000);
  const amount   = parseFloat((MIN_BET + Math.random() * (MAX_BET - MIN_BET)).toFixed(4));
  const prices   = await getLivePrices([tokenA, tokenB]);

  const ok = await dbInsert('mr_battles', {
    id:               genId(),
    creator:          'system',
    mode:             'arena',        // ← DISPLAY ONLY: tidak bisa di-join dengan SOL real
    type:             'system',
    token_a:          tokenA,
    token_b:          tokenB,
    amount,
    prize_pool:       0,              // ← FIX: pool = 0 karena tidak ada yang deposit
    total_deposited:  0,
    fee_collected:    0,
    status:           'live',
    payment:          'SOL',
    players:          0,              // ← FIX: 0, bukan fake random number
    start_time:       now.toISOString(),
    end_time:         end.toISOString(),
    created_at:       now.toISOString(),
    meta: {
      tokenA_price:  prices[tokenA]?.price ?? 0,
      tokenB_price:  prices[tokenB]?.price ?? 0,
      tokenA_ch24:   prices[tokenA]?.ch24  ?? 0,
      tokenB_ch24:   prices[tokenB]?.ch24  ?? 0,
      duration_s:    duration,
      created_by:    'nextjs_fallback',
      joinable:      false,           // ← explicit flag: tidak bisa di-join
    },
  });

  if (ok) console.log(`[EnsureBattles] ✅ arena ${tokenA} vs ${tokenB} ${duration}s`);
  else    console.error(`[EnsureBattles] ❌ insert failed: ${tokenA} vs ${tokenB}`);
  return ok;
}

export interface EnsureResult {
  existing: number;
  created:  number;
  needed:   number;
  errors:   string[];
  source:   'supabase_cron' | 'nextjs_fallback';
}

export async function ensureMinimumBattles(): Promise<EnsureResult> {
  const result: EnsureResult = { existing: 0, created: 0, needed: 0, errors: [], source: 'nextjs_fallback' };
  try {
    const now  = new Date().toISOString();
    const live = await dbSelect<{ id: string; token_a: string; token_b: string }>(
      'mr_battles',
      `status=eq.live&end_time=gt.${now}&select=id,token_a,token_b`,
    );

    result.existing = live.length;
    result.needed   = Math.max(0, MIN_BATTLES - live.length);

    const threshold = live.length <= 1 ? result.needed : Math.max(0, 2 - live.length);

    if (threshold === 0) {
      result.source = 'supabase_cron';
      return result;
    }

    console.log(`[EnsureBattles] Fallback: need ${threshold} more`);
    const used = new Set(live.map(b => `${b.token_a}_${b.token_b}`));

    for (let i = 0; i < threshold; i++) {
      const pair = pickPair(used);
      if (!pair) { result.errors.push('no pair'); break; }
      const [a, b] = pair;
      used.add(`${a}_${b}`);
      const ok = await createOneBattle(a, b);
      if (ok) result.created++;
      else    result.errors.push(`insert failed: ${a} vs ${b}`);
    }

    // Cleanup expired dengan safe refund
    cleanupExpiredSafe().catch(() => {});

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(msg);
    console.error('[EnsureBattles] Error:', msg);
  }
  return result;
}

/**
 * cleanupExpiredSafe()
 *
 * FIX: Sebelumnya langsung set status='paid' tanpa cek bets.
 * Sekarang:
 *   1. Cek apakah ada bets di battle yang expired
 *   2. Kalau ada bets → panggil executePayout (akan refund karena mode='arena')
 *   3. Kalau tidak ada bets → langsung mark ended, tidak ada transfer
 */
async function cleanupExpiredSafe(): Promise<void> {
  const now = new Date().toISOString();
  try {
    const expired = await dbSelect<{ id: string; mode: string; total_deposited: number }>(
      'mr_battles',
      `status=eq.live&end_time=lt.${now}&select=id,mode,total_deposited`,
    );

    for (const b of expired) {
      try {
        // Cek apakah ada deposit nyata
        const bets = await getBetsForBattle(b.id);

        if (bets.length === 0 || (b.total_deposited ?? 0) === 0) {
          // Tidak ada deposit → langsung mark ended, tidak ada payout
          await dbPatch('mr_battles', `id=eq.${b.id}`, {
            status:    'ended',
            winner:    'NO_BETS',
            ended_at:  now,
          });
          console.log(`[EnsureBattles] Cleanup ${b.id}: no bets, marked ended`);
        } else {
          // Ada deposit → harus refund!
          console.warn(`[EnsureBattles] Battle ${b.id} expired with ${bets.length} bets and ${b.total_deposited} SOL deposited — triggering refund`);

          // Mark sebagai REFUND dulu
          await dbPatch('mr_battles', `id=eq.${b.id}`, {
            status:       'ended',
            winner:       'REFUND',
            winner_wallet: null,
            ended_at:     now,
          });

          // Eksekusi refund ke semua bettor
          const result = await executePayout(b.id);
          if (result.success) {
            console.log(`[EnsureBattles] Refund OK for ${b.id}: ${result.payoutSol} SOL`);
          } else {
            console.error(`[EnsureBattles] Refund FAILED for ${b.id}: ${result.error}`);
          }
        }
      } catch (e) {
        console.error(`[EnsureBattles] Error cleaning ${b.id}:`, e);
      }
    }

    if (expired.length) console.log(`[EnsureBattles] Cleaned ${expired.length} expired battles`);
  } catch (e) {
    console.error('[EnsureBattles] cleanupExpiredSafe error:', e);
  }
}
