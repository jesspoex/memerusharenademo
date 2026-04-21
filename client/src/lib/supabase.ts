/**
 * lib/supabase.ts
 * Server-side Supabase client using SERVICE_ROLE key.
 * Bypasses RLS. NEVER import from client components.
 */

export type BattleMode   = 'arena' | 'real';
export type BattleStatus = 'live' | 'ended' | 'paid';
export type BetSide      = 'A' | 'B';

export interface DbBattle {
  id: string; creator: string; mode: BattleMode;
  token_a: string; token_b: string;
  amount: number; prize_pool: number;
  total_deposited: number; fee_collected: number;
  status: BattleStatus; payment: string;
  players: number; tx_hash?: string;
  winner?: string; winner_wallet?: string;
  start_time?: string; end_time?: string;
  created_at: string; ended_at?: string;
  payout_tx_hash?: string;
}

export interface DbBet {
  id?: number; battle_id: string; wallet: string;
  side: BetSide; amount: number; fee_total: number;
  net_amount: number; payment: string;
  tx_hashes: string[]; created_at: string; updated_at: string;
}

export interface DbStats {
  id: number; players: number; battles: number;
  vol_sol: number; paid_sol: number; updated_at: string;
}

export interface DbWinner {
  id?: number; wallet: string; amount_sol: number;
  battle: string; tx_hash?: string; created_at: string;
}

export interface DbActivity {
  id?: number; wallet: string; action: string;
  amount?: number; battle?: string; tx_hash?: string; created_at: string;
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function sbH(useService = true): Record<string, string> {
  const key = useService ? SB_SERVICE : SB_ANON;
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
  };
}

export async function dbSelect<T>(table: string, query = '', useService = true): Promise<T[]> {
  if (!SB_URL) return [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: sbH(useService), cache: 'no-store' });
    if (!r.ok) { console.error(`[DB] SELECT ${table} ${r.status}: ${await r.text()}`); return []; }
    return await r.json() as T[];
  } catch (e) { console.error(`[DB] SELECT ${table}:`, e); return []; }
}

export async function dbInsert(table: string, body: unknown, useService = true): Promise<boolean> {
  if (!SB_URL) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...sbH(useService), 'Prefer': 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error(`[DB] INSERT ${table} ${r.status}: ${await r.text()}`);
    return r.ok;
  } catch (e) { console.error(`[DB] INSERT ${table}:`, e); return false; }
}

export async function dbUpsert(table: string, body: unknown, useService = true): Promise<boolean> {
  if (!SB_URL) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...sbH(useService), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error(`[DB] UPSERT ${table} ${r.status}: ${await r.text()}`);
    return r.ok;
  } catch (e) { console.error(`[DB] UPSERT ${table}:`, e); return false; }
}

export async function dbPatch(table: string, query: string, body: unknown, useService = true): Promise<boolean> {
  if (!SB_URL) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: { ...sbH(useService), 'Prefer': 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error(`[DB] PATCH ${table} ${r.status}: ${await r.text()}`);
    return r.ok;
  } catch (e) { console.error(`[DB] PATCH ${table}:`, e); return false; }
}

export async function getBattleById(id: string): Promise<DbBattle | null> {
  const rows = await dbSelect<DbBattle>('mr_battles', `id=eq.${id}&select=*`);
  return rows?.[0] ?? null;
}

export async function getBetsForBattle(battleId: string): Promise<DbBet[]> {
  return dbSelect<DbBet>('mr_bets', `battle_id=eq.${battleId}&select=*`);
}

export async function getStats(): Promise<DbStats | null> {
  const rows = await dbSelect<DbStats>('mr_stats', 'id=eq.1&select=*');
  return rows?.[0] ?? null;
}

export async function incrementStats(vol = 0, paid = 0, battles = 0): Promise<void> {
  const cur = await getStats();
  if (!cur) return;
  await dbPatch('mr_stats', 'id=eq.1', {
    vol_sol:    parseFloat(((cur.vol_sol ?? 0) + vol).toFixed(6)),
    paid_sol:   parseFloat(((cur.paid_sol ?? 0) + paid).toFixed(6)),
    battles:    (cur.battles ?? 0) + battles,
    updated_at: new Date().toISOString(),
  });
}
