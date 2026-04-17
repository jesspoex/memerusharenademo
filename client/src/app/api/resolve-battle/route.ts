/**
 * app/api/resolve-battle/route.ts
 *
 * ARSITEKTUR BARU:
 *   - Battle system/arena: ditutup otomatis oleh Supabase pg_cron
 *   - Battle real (mode='real'): tetap diselesaikan oleh endpoint ini
 *     karena butuh on-chain payout yang harus dieksekusi dari server Node.js
 *
 * GET  — admin trigger: resolve semua expired real battles + refill
 * POST — admin trigger: resolve 1 battle spesifik
 *
 * Tidak lagi tergantung Vercel Cron. Panggil manual atau dari dashboard admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBattleById, dbPatch, dbInsert, dbSelect, DbBattle } from '@/lib/supabase';
import { executePayout } from '@/lib/payout';
import { compareTokens } from '@/lib/price';
import { verifyAdminSecret } from '@/lib/security';
import { ensureMinimumBattles } from '@/lib/ensure-battles';

function isAuthorized(req: NextRequest): boolean {
  return verifyAdminSecret(req);
}

// POST — resolve satu battle spesifik
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { battleId, winner: manualWinner } = await req.json() as { battleId?: string; winner?: string };
    if (!battleId) return NextResponse.json({ error: 'battleId required' }, { status: 400 });

    const battle = await getBattleById(battleId);
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.status === 'paid') return NextResponse.json({ success: true, alreadyPaid: true, battleId });

    const now = new Date().toISOString();

    // Battle system/arena: tutup saja, tanpa payout on-chain
    if (battle.mode !== 'real') {
      await dbPatch('mr_battles', `id=eq.${battleId}`, { status: 'paid', ended_at: now });
      ensureMinimumBattles().catch(() => {});
      return NextResponse.json({ success: true, battleId, arena: true });
    }

    // Battle real: butuh pemenang + payout on-chain
    let winner = manualWinner;
    let priceMethod = 'manual';
    if (!winner) {
      const cmp = await compareTokens(battle.token_a, battle.token_b);
      winner      = cmp.winner;
      priceMethod = cmp.method;
    }

    if (winner !== battle.token_a && winner !== battle.token_b) {
      return NextResponse.json({ error: 'Invalid winner' }, { status: 400 });
    }

    await dbPatch('mr_battles', `id=eq.${battleId}`, { status: 'ended', winner, ended_at: now });
    await dbInsert('mr_activities', {
      wallet:     'System',
      action:     'ended',
      battle:     `${battle.token_a} vs ${battle.token_b}`,
      created_at: now,
    }).catch(() => {});

    const payout = await executePayout(battleId);
    ensureMinimumBattles().catch(() => {});

    return NextResponse.json({ success: payout.success, battleId, winner, priceMethod, payout });
  } catch (e) {
    console.error('[ResolveBattle] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — resolve semua real battles yang expired (admin trigger atau webhook)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = new Date().toISOString();

    // Hanya ambil real battles — arena sudah ditangani pg_cron
    const expired = await dbSelect<Pick<DbBattle, 'id' | 'token_a' | 'token_b' | 'mode'>>(
      'mr_battles',
      `status=eq.live&mode=eq.real&end_time=lt.${now}&select=id,token_a,token_b,mode`,
    );

    const results = [];
    for (const b of expired) {
      try {
        const cmp = await compareTokens(b.token_a, b.token_b);
        await dbPatch('mr_battles', `id=eq.${b.id}`, {
          status:   'ended',
          winner:   cmp.winner,
          ended_at: now,
        });
        const payout = await executePayout(b.id);
        results.push({ battleId: b.id, winner: cmp.winner, method: cmp.method, payoutOk: payout.success });
      } catch (e) {
        results.push({ battleId: b.id, error: String(e) });
      }
    }

    const refill = await ensureMinimumBattles();

    return NextResponse.json({
      resolved:  results.length,
      results,
      refill,
      note:      'Arena battles resolved by Supabase pg_cron. This endpoint handles real battles only.',
      timestamp: now,
    });
  } catch (e) {
    console.error('[ResolveBattle] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
    }
