import { NextResponse } from 'next/server';
import { dbSelect, DbWinner } from '@/lib/supabase';
import { shortWallet } from '@/lib/validation';
export const revalidate = 15;
export async function GET() {
  try {
    const winners = await dbSelect<DbWinner>('mr_winners','select=*&order=created_at.desc&limit=20');
    return NextResponse.json({ winners: winners.map(w=>({ wallet:shortWallet(w.wallet), fullWallet:w.wallet, amountSol:w.amount_sol, battle:w.battle, txHash:w.tx_hash, solscan:w.tx_hash?`https://solscan.io/tx/${w.tx_hash}`:null, time:w.created_at })) });
  } catch { return NextResponse.json({ error:'Failed' }, { status:500 }); }
}
