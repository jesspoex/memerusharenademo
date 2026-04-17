import { NextResponse } from 'next/server';
import { getStats, dbSelect } from '@/lib/supabase';
import { getTreasuryBalance } from '@/lib/solana';
export const revalidate = 10;
export async function GET() {
  try {
    const [stats, live] = await Promise.all([
      getStats(),
      dbSelect<{id:string;mode:string;prize_pool:number}>('mr_battles','status=eq.live&select=id,mode,prize_pool'),
    ]);
    const liveReal  = live.filter(b=>b.mode==='real').length;
    const liveArena = live.filter(b=>b.mode==='arena').length;
    const livePool  = live.reduce((s,b)=>s+b.prize_pool,0);
    let treasuryBal = 0;
    try { treasuryBal = await getTreasuryBalance(); } catch {}
    return NextResponse.json({ players:stats?.players??0, battles:stats?.battles??0, volSol:stats?.vol_sol??0, paidSol:stats?.paid_sol??0, liveTotal:live.length, liveReal, liveArena, livePool:parseFloat(livePool.toFixed(4)), treasuryBal:parseFloat(Math.max(0,treasuryBal).toFixed(4)), updatedAt:stats?.updated_at??new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error:'Failed to load stats' }, { status:500 });
  }
}
