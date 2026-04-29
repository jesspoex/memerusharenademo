import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface DbBattle {
  id:            string;
  status:        string;
  payment:       string | null;
  token_a:       string;
  token_b:       string;
  winner?:       string | null;
  winner_wallet?: string | null;
  audd_pool?:    number | null;
  prize_pool?:   number | null;
}

interface DbBet {
  side:       string;
  net_amount: number;
  wallet:     string;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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
      .select('id, status, payment, token_a, token_b, winner, winner_wallet, audd_pool, prize_pool')
      .eq('status', 'live')
      .lte('end_time', now);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!expired || expired.length === 0)
      return NextResponse.json({ resolved: 0, message: 'No expired battles' });

    const results: Array<{
      id:           string;
      winner:       string;
      payment:      string;
      payoutStatus: string;
    }> = [];

    for (const battle of expired as DbBattle[]) {
      try {
        const { data: bets } = await db
          .from('mr_bets')
          .select('side, net_amount, wallet')
          .eq('battle_id', battle.id);

        let winner       = battle.token_a;
        let winnerWallet: string | null = null;

        if (bets && bets.length > 0) {
          const poolA = (bets as DbBet[])
            .filter(b => b.side === 'A')
            .reduce((s, b) => s + (b.net_amount ?? 0), 0);
          const poolB = (bets as DbBet[])
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
        } else {
          winner = Math.random() < 0.5 ? battle.token_a : battle.token_b;
        }

        const { error: updateErr } = await db
          .from('mr_battles')
          .update({ status: 'ended', winner, winner_wallet: winnerWallet, ended_at: now })
          .eq('id', battle.id);

        if (updateErr) throw new Error(updateErr.message);

        let payoutStatus = 'skipped_no_wallet';

        if (winnerWallet) {
          const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL!;
          const adminHeader = { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET! };

          if (battle.payment === 'AUDD') {
            const r    = await fetch(`${siteUrl}/api/payout-audd`, {
              method: 'POST', headers: adminHeader,
              body:   JSON.stringify({ battleId: battle.id }),
            });
            const d    = await r.json() as { success?: boolean; error?: string };
            payoutStatus = d.success ? 'audd_paid' : `audd_failed:${d.error ?? 'unknown'}`;
          } else {
            const r    = await fetch(`${siteUrl}/api/payout`, {
              method: 'POST', headers: adminHeader,
              body:   JSON.stringify({ battleId: battle.id }),
            });
            const d    = await r.json() as { success?: boolean; error?: string };
            payoutStatus = d.success ? 'sol_paid' : `sol_failed:${d.error ?? 'unknown'}`;
          }
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
