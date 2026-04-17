/**
 * app/api/payout/route.ts
 * Idempotent payout with concurrent lock. Server-side only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBattleById } from '@/lib/supabase';
import { executePayout } from '@/lib/payout';
import { acquirePayoutLock, releasePayoutLock, checkPayoutLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const { battleId } = await req.json() as { battleId?:string };
    if (!battleId || typeof battleId !== 'string') return NextResponse.json({ success:false, error:'battleId required' }, { status:400 });

    // Rate limit per battle
    const rl = checkPayoutLimit(battleId);
    if (!rl.allowed) return NextResponse.json({ success:false, error:'Payout already in progress. Wait 30 seconds.' }, { status:429 });

    // Concurrent lock
    if (!acquirePayoutLock(battleId)) return NextResponse.json({ success:false, error:'Payout already processing for this battle.' }, { status:409 });

    try {
      const battle = await getBattleById(battleId);
      if (!battle) return NextResponse.json({ success:false, error:'Battle not found' }, { status:404 });

      // Arena: no payout
      if (battle.mode !== 'real') return NextResponse.json({ success:true, arena:true, battleId });

      // Idempotency: already paid
      if (battle.status === 'paid' && battle.payout_tx_hash) {
        return NextResponse.json({ success:true, alreadyPaid:true, txHash:battle.payout_tx_hash, winnerWallet:battle.winner_wallet, battleId });
      }

      // Must be ended
      if (battle.status === 'live') return NextResponse.json({ success:false, error:'Battle still live. Resolve first.' }, { status:409 });

      const result = await executePayout(battleId);
      if (!result.success) {
        console.error(`[Payout] Failed for ${battleId}:`, result.error);
        return NextResponse.json({ success:false, error:result.error, battleId }, { status:500 });
      }
      return NextResponse.json({ success:true, battleId, txHash:result.txHash, winnerWallet:result.winnerWallet, winnerToken:result.winnerToken, payoutSol:result.payoutSol, alreadyPaid:result.alreadyPaid ?? false });
    } finally {
      releasePayoutLock(battleId);
    }
  } catch (e) {
    console.error('[Payout] Error:', e);
    return NextResponse.json({ success:false, error:'Internal server error' }, { status:500 });
  }
} 
