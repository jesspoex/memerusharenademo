/**
 * app/api/resolve-battle/route.ts
 *
 * Resolves expired battles → triggers ensureMinimumBattles to refill.
 * Protected by ADMIN_SECRET (server env only — never NEXT_PUBLIC_).
 *
 * Called by:
 *   - Vercel Cron every minute (GET)
 *   - Admin override (POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBattleById, dbPatch, dbInsert, dbSelect, DbBattle } from '@/lib/supabase';
import { executePayout } from '@/lib/payout';
import { compareTokens } from '@/lib/price';
import { verifyAdminSecret, verifyCronSecret } from '@/lib/security';
import { ensureMinimumBattles } from '@/lib/ensure-battles';

function isAuthorized(req: NextRequest): boolean {
  return verifyAdminSecret(req) || verifyCronSecret(req);
}

// ── POST: resolve a single battle (admin) ────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { battleId, winner: manualWinner } = await req.json() as { battleId?: string; winner?: string };
    if (!battleId) return NextResponse.json({ error: 'battleId required' }, { status: 400 });

    const battle = await getBattleById(battleId);
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.status === 'paid') return NextResponse.json({ success: true, alreadyPaid: true, battleId });

    // Arena / system battles: just mark ended → paid, no payout
    if (battle.mode !== 'real') {
      await dbPatch('mr_battles', `id=eq.${battleId}`, {
        status:   'paid',
        ended_at: new Date().toISOString(),
      });
      // Refill after resolving
      ensureMinimumBattles().catch(() => {});
      return NextResponse.json({ success: true, battleId, arena: true });
    }

    let winner = manualWinner;
    let priceMethod = 'manual';
    if (!winner) {
      const comparison = await compareTokens(battle.token_a, battle.token_b);
      winner      = comparison.winner;
      priceMethod = comparison.method;
    }

    if (winner !== battle.token_a && winner !== battle.token_b) {
      return NextResponse.json({ error: `Invalid winner` }, { status: 400 });
    }

    const now = new Date().toISOString();
    await dbPatch('mr_battles', `id=eq.${battleId}`, { status: 'ended', winner, ended_at: now });
    await dbInsert('mr_activities', { wallet: 'System', action: 'ended', battle: `${battle.token_a} vs ${battle.token_b}`, created_at: now }).catch(() => {});

    const payout = await executePayout(battleId);

    // Refill after resolving real battle too
    ensureMinimumBattles().catch(() => {});

    return NextResponse.json({ success: payout.success, battleId, winner, priceMethod, payout });
  } catch (e) {
    console.error('[ResolveBattle] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET: Vercel Cron — resolve all expired + refill ──────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now     = new Date().toISOString();
    const expired = await dbSelect<Pick<DbBattle, 'id' | 'token_a' | 'token_b' | 'mode'>>(
      'mr_battles',
      `status=eq.live&end_time=lt.${now}&select=id,token_a,token_b,mode`,
    );

    const results = [];
    for (const b of expired) {
      try {
        if (b.mode !== 'real') {
          await dbPatch('mr_battles', `id=eq.${b.id}`, { status: 'paid', ended_at: now });
          results.push({ battleId: b.id, arena: true });
          continue;
        }
        const comparison = await compareTokens(b.token_a, b.token_b);
        await dbPatch('mr_battles', `id=eq.${b.id}`, {
          status:   'ended',
          winner:   comparison.winner,
          ended_at: now,
        });
        const payout = await executePayout(b.id);
        results.push({ battleId: b.id, winner: comparison.winner, method: comparison.method, payoutOk: payout.success });
      } catch (e) {
        results.push({ battleId: b.id, error: String(e) });
      }
    }

    // Always refill after cron run
    const refill = await ensureMinimumBattles();

    return NextResponse.json({
      resolved:  results.length,
      results,
      refill,
      timestamp: now,
    });
  } catch (e) {
    console.error('[ResolveBattle Cron] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
