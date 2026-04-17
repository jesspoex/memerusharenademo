/**
 * app/api/create-battle/route.ts
 * Validates TX on-chain then creates battle in DB.
 * Frontend never writes to Supabase directly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateCreateBattleRequest, shortWallet } from '@/lib/validation';
import { validateSolTransaction, getTreasuryPublicKey } from '@/lib/solana';
import { dbInsert, dbSelect, incrementStats } from '@/lib/supabase';
import { checkCreateBattleLimit, getClientIP } from '@/lib/security';

async function isTxUsed(txHash: string): Promise<boolean> {
  const a = await dbSelect<{id:string}>('mr_battles', `tx_hash=eq.${txHash}&select=id`);
  if (a.length > 0) return true;
  const b = await dbSelect<{id:number}>('mr_bets', `tx_hashes=cs.{${txHash}}&select=id`);
  return b.length > 0;
}

function genId(): string { return `b_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

export async function POST(req: NextRequest) {
  try {
    const ip   = getClientIP(req);
    const body = await req.json().catch(() => null);
    const { data, error } = validateCreateBattleRequest(body);
    if (error || !data) return NextResponse.json({ success:false, error }, { status:400 });

    const { wallet, txHash, tokenA, tokenB, amount, duration } = data;

    // Rate limit
    const rl = checkCreateBattleLimit(ip, wallet);
    if (!rl.allowed) return NextResponse.json({ success:false, error:'Too many battles created. Please wait.' }, { status:429 });

    // Duplicate TX
    if (await isTxUsed(txHash)) return NextResponse.json({ success:false, error:'Transaction already used.' }, { status:409 });

    // Validate TX on-chain
    const treasury = getTreasuryPublicKey();
    if (!treasury) return NextResponse.json({ success:false, error:'Server configuration error.' }, { status:500 });

    const validation = await validateSolTransaction(txHash, wallet, treasury, Math.floor(amount * 1e9));
    if (!validation.valid) {
      console.warn(`[CreateBattle] TX invalid: wallet=${wallet} err=${validation.error}`);
      return NextResponse.json({ success:false, error:`Transaction validation failed: ${validation.error}` }, { status:422 });
    }

    // Fee & prize
    const feeSol   = parseFloat((amount * 0.02).toFixed(6));
    const prizeSol = parseFloat((amount - feeSol).toFixed(6));
    const now      = new Date();
    const endTime  = new Date(now.getTime() + duration * 1000);
    const battleId = genId();

    const ok = await dbInsert('mr_battles', {
      id: battleId, creator: wallet, mode: 'real',
      token_a: tokenA, token_b: tokenB, amount,
      prize_pool: prizeSol, total_deposited: amount, fee_collected: feeSol,
      status: 'live', payment: 'SOL', players: 1, tx_hash: txHash,
      start_time: now.toISOString(), end_time: endTime.toISOString(),
      created_at: now.toISOString(),
    });

    if (!ok) {
      console.error('[CRITICAL] TX valid but DB insert failed!', { battleId, txHash, wallet });
      return NextResponse.json({ success:false, error:'Database error. Your SOL was received. Contact support with txHash.', recovery:{ txHash, amount } }, { status:500 });
    }

    await Promise.all([
      dbInsert('mr_bets', { battle_id:battleId, wallet, side:'A', amount, fee_total:feeSol, net_amount:prizeSol, payment:'SOL', tx_hashes:[txHash], created_at:now.toISOString(), updated_at:now.toISOString() }),
      dbInsert('mr_activities', { wallet:shortWallet(wallet), action:'created', amount, battle:`${tokenA} vs ${tokenB}`, tx_hash:txHash, created_at:now.toISOString() }),
      incrementStats(amount, 0, 1),
    ]).catch(e => console.error('[CreateBattle] side-effects error:', e));

    return NextResponse.json({ success:true, battle:{ id:battleId, tokenA, tokenB, amount, prizePool:prizeSol, duration, startTime:now.toISOString(), endTime:endTime.toISOString(), mode:'real', txHash } });
  } catch (e) {
    console.error('[CreateBattle] Error:', e);
    return NextResponse.json({ success:false, error:'Internal server error' }, { status:500 });
  }
}
