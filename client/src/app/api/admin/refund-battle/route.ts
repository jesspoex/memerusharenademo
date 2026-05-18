/**
 * /api/admin/refund-battle
 * Manual refund trigger for admin — use when user played arena battle and SOL wasn't returned.
 * POST: { battleId: string } + header x-admin-secret
 * GET:  list all expired battles with deposits (audit tool)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executePayout } from '@/lib/payout';
import { getBetsForBattle } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { battleId } = await req.json() as { battleId?: string };
    if (!battleId) return NextResponse.json({ error: 'battleId required' }, { status: 400 });

    const db = getAdmin();
    const { data: battle } = await db.from('mr_battles').select('*').eq('id', battleId).single();
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 });

    const bets = await getBetsForBattle(battleId);
    const totalDeposited = bets.reduce((s, b) => s + (b.amount ?? 0), 0);

    if (bets.length === 0) {
      await db.from('mr_battles').update({ status: 'ended', winner: 'NO_BETS', ended_at: new Date().toISOString() }).eq('id', battleId);
      return NextResponse.json({ success: true, message: 'No bets — marked ended', totalDeposited: 0 });
    }

    await db.from('mr_battles').update({
      status: 'ended', winner: 'REFUND', winner_wallet: null, ended_at: new Date().toISOString(),
    }).eq('id', battleId);

    const result = await executePayout(battleId);
    return NextResponse.json({
      success: result.success, battleId, betsCount: bets.length,
      totalDeposited: parseFloat(totalDeposited.toFixed(6)),
      refundedSol: result.payoutSol, txHash: result.txHash, error: result.error,
      message: result.success ? `Refunded ${result.payoutSol} SOL` : `Failed: ${result.error}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getAdmin();
  const { data: battles } = await db
    .from('mr_battles').select('id,mode,status,token_a,token_b,prize_pool,total_deposited,players,end_time,winner')
    .lt('end_time', new Date().toISOString()).order('end_time', { ascending: false }).limit(50);

  const risky = (battles ?? []).filter(b => (b.total_deposited ?? 0) > 0);
  return NextResponse.json({ total: (battles ?? []).length, withDeposits: risky.length, battles: risky });
}
