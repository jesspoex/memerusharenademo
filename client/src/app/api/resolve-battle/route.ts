import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface DbBattle {
  id:             string;
  creator?:        string | null;
  status:         string;
  payment:        string | null;
  token_a:        string;
  token_b:        string;
  winner?:        string | null;
  winner_wallet?: string | null;
  audd_pool?:     number | null;
  prize_pool?:    number | null;
  players?:       number | null;
}

interface DbBet {
  side:       string;
  net_amount: number;
  amount:     number;
  wallet:     string;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

async function callPayout(siteUrl: string, adminHeader: Record<string, string>, battleId: string, payment: string | null) {
  const endpoint = payment === 'AUDD' ? '/api/payout-audd' : '/api/payout';
  const r = await fetch(`${siteUrl}${endpoint}`, {
    method:  'POST',
    headers: adminHeader,
    body:    JSON.stringify({ battleId }),
  });
  return await r.json() as { success?: boolean; error?: string; txHash?: string; refund?: boolean };
}

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const now = new Date().toISOString();
    const db  = getAdmin();

    const { data: expired, error: fetchErr } = await db
      .from('mr_battles')
      .select('id, creator, status, payment, token_a, token_b, winner, winner_wallet, audd_pool, prize_pool, players')
      .eq('status', 'live')
      .lte('end_time', now);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!expired || expired.length === 0)
      return NextResponse.json({ resolved: 0, message: 'No expired battles' });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    const adminHeader = {
      'Content-Type': 'application/json',
      'x-admin-secret': process.env.ADMIN_SECRET!,
    };

    const results: Array<{
      id:           string;
      winner:       string;
      payment:      string;
      payoutStatus: string;
      reason?:      string;
    }> = [];

    for (const battle of expired as DbBattle[]) {
      try {
        const { data: bets, error: betErr } = await db
          .from('mr_bets')
          .select('side, net_amount, amount, wallet')
          .eq('battle_id', battle.id);

        if (betErr) throw new Error(betErr.message);

        const battleBets = (bets ?? []) as DbBet[];
        const uniqueWallets = uniq(battleBets.map(b => b.wallet).filter(Boolean));
        const hasA = battleBets.some(b => b.side === 'A');
        const hasB = battleBets.some(b => b.side === 'B');

        // IMPORTANT FAIRNESS RULE:
        // A real battle cannot produce a winner if nobody joins, only one wallet is present,
        // or all deposits are on one side. In those cases the backend marks the battle as
        // REFUND and calls payout, which returns deposits instead of paying a fake winner.
        if (battleBets.length === 0 || uniqueWallets.length < 2 || !hasA || !hasB) {
          const reason = battleBets.length === 0
            ? 'no_bets'
            : uniqueWallets.length < 2
              ? 'single_wallet'
              : 'one_sided_battle';

          const { error: refundMarkErr } = await db
            .from('mr_battles')
            .update({ status: 'ended', winner: 'REFUND', winner_wallet: null, ended_at: now })
            .eq('id', battle.id);

          if (refundMarkErr) throw new Error(refundMarkErr.message);

          const d = await callPayout(siteUrl, adminHeader, battle.id, battle.payment);
          const payoutStatus = d.success ? `refunded:${d.txHash ?? 'ok'}` : `refund_failed:${d.error ?? 'unknown'}`;

          results.push({
            id: battle.id,
            winner: 'REFUND',
            payment: battle.payment ?? 'SOL',
            payoutStatus,
            reason,
          });
          console.info(`[resolve-battle] ${battle.id} → REFUND | ${reason} | ${payoutStatus}`);
          continue;
        }

        let winner       = battle.token_a;
        let winnerWallet: string | null = null;

        // Server fallback winner selection: side with larger net pool.
        // The UI shows live % movement for demo clarity; production can replace this with
        // persisted start/end price snapshots in battle.meta for fully deterministic scoring.
        const poolA = battleBets
          .filter(b => b.side === 'A')
          .reduce((s, b) => s + (b.net_amount ?? 0), 0);
        const poolB = battleBets
          .filter(b => b.side === 'B')
          .reduce((s, b) => s + (b.net_amount ?? 0), 0);

        const winningSide = poolA >= poolB ? 'A' : 'B';
        winner = winningSide === 'A' ? battle.token_a : battle.token_b;

        const { data: topBet } = await db
          .from('mr_bets')
          .select('wallet')
          .eq('battle_id', battle.id)
          .eq('side', winningSide)
          .order('net_amount', { ascending: false })
          .limit(1)
          .single();

        winnerWallet = topBet?.wallet ?? null;

        const { error: updateErr } = await db
          .from('mr_battles')
          .update({ status: 'ended', winner, winner_wallet: winnerWallet, ended_at: now })
          .eq('id', battle.id);

        if (updateErr) throw new Error(updateErr.message);

        let payoutStatus = 'skipped_no_wallet';
        if (winnerWallet) {
          const d = await callPayout(siteUrl, adminHeader, battle.id, battle.payment);
          payoutStatus = d.success
            ? (battle.payment === 'AUDD' ? 'audd_paid' : 'sol_paid')
            : `${battle.payment === 'AUDD' ? 'audd' : 'sol'}_failed:${d.error ?? 'unknown'}`;
        }

        results.push({ id: battle.id, winner, payment: battle.payment ?? 'SOL', payoutStatus });
        console.info(`[resolve-battle] ${battle.id} → ${winner} | ${payoutStatus}`);
      } catch (err) {
        console.error(`[resolve-battle] battle ${battle.id}:`, err);
        results.push({
          id:           battle.id,
          winner:       'error',
          payment:      battle.payment ?? 'SOL',
          payoutStatus: `error:${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return NextResponse.json({ resolved: results.length, results });
  } catch (e) {
    console.error('[resolve-battle]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
