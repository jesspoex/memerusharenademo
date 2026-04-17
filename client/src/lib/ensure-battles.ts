/**
 * lib/ensure-battles.ts
 *
 * ARSITEKTUR BARU: Supabase pg_cron menangani pembuatan battle otomatis.
 *
 * File ini sekarang hanya dipakai sebagai:
 *   1. FALLBACK — jika /api/battles dipanggil dan Supabase pg_cron belum jalan
 *   2. SYNC call dari /api/battles untuk validasi real-time count
 *
 * Scheduler utama: Supabase pg_cron → mr_scheduler_tick() setiap 1 menit
 * Tidak ada ketergantungan pada Vercel Cron atau CRON_SECRET.
 */

import { dbSelect, dbInsert, dbPatch } from '@/lib/supabase';

// ── Token registry (sync dengan SQL function) ─────────────────────────────────
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
const DURATIONS   = [180, 240, 300, 420, 600]; // seconds — 3 to 10 min
const MIN_BET     = 0.001;
const MAX_BET     = 0.008;

// ── Price cache (5-min TTL) ───────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return [shuffled[0].symbol, shuffled[1].symbol]; // fallback
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
    mode:             'arena',
    type:             'system',
    token_a:          tokenA,
    token_b:          tokenB,
    amount,
    prize_pool:       parseFloat((amount * 0.98).toFixed(6)),
    total_deposited:  0,
    fee_collected:    0,
    status:           'live',
    payment:          'SOL',
    players:          Math.floor(Math.random() * 6) + 1,
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
    },
  });

  if (ok) console.log(`[EnsureBattles:fallback] ✅ ${tokenA} vs ${tokenB} ${duration}s`);
  else    console.error(`[EnsureBattles:fallback] ❌ insert failed: ${tokenA} vs ${tokenB}`);
  return ok;
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface EnsureResult {
  existing: number;
  created:  number;
  needed:   number;
  errors:   string[];
  source:   'supabase_cron' | 'nextjs_fallback';
}

/**
 * ensureMinimumBattles()
 *
 * Cek apakah battle cukup. Jika pg_cron Supabase sudah berjalan dengan benar,
 * fungsi ini biasanya langsung return karena battle sudah tersedia.
 *
 * Fallback aktif hanya jika:
 *   - pg_cron belum aktif / baru setup
 *   - Ada edge case race condition
 */
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

    // pg_cron handles this — only create if count is critically low (0 or 1)
    // Avoid competing with pg_cron which runs every 60s
    const threshold = live.length <= 1 ? result.needed : Math.max(0, 2 - live.length);

    if (threshold === 0) {
      result.source = 'supabase_cron'; // cron already handled it
      return result;
    }

    console.log(`[EnsureBattles] Fallback: need ${threshold} more (pg_cron may be behind)`);
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

    // Cleanup expired (pg_cron juga handles ini, tapi aman dijalankan dobel)
    cleanupExpired().catch(() => {});

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(msg);
    console.error('[EnsureBattles] Error:', msg);
  }
  return result;
}

async function cleanupExpired(): Promise<void> {
  const now = new Date().toISOString();
  try {
    const expired = await dbSelect<{ id: string }>(
      'mr_battles', `status=eq.live&mode=eq.arena&end_time=lt.${now}&select=id`,
    );
    for (const b of expired) await dbPatch('mr_battles', `id=eq.${b.id}`, { status: 'paid', ended_at: now });
    if (expired.length) console.log(`[EnsureBattles] Cleaned ${expired.length} expired`);
  } catch { /* non-critical */ }
}
