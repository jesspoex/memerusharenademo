import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const AUDD_MINT = 'AUDDnYwArF6HiQGGMRLsEFoGQ4um4dMgKECCUB5q9q5';
const FEE_PCT   = 0.02;
const MIN_AUDD  = 1;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { battleId, wallet, txHash, side, amount } =
      await req.json() as {
        battleId: string;
        wallet:   string;
        txHash:   string;
        side:     'A' | 'B';
        amount:   number;
      };

    if (!battleId || !wallet || !txHash || !side || !amount || amount < MIN_AUDD)
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

    const conn = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
      { commitment: 'confirmed' },
    );

    const tx = await conn.getParsedTransaction(txHash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err)
      return NextResponse.json({ error: 'TX invalid or failed on-chain' }, { status: 400 });

    const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET!;
    const postBals = tx.meta?.postTokenBalances ?? [];
    const preBals  = tx.meta?.preTokenBalances  ?? [];
    const post     = postBals.find(b => b.owner === treasury && b.mint === AUDD_MINT);
    const pre      = preBals.find( b => b.owner === treasury && b.mint === AUDD_MINT);
    const received = parseFloat(post?.uiTokenAmount?.uiAmountString ?? '0')
                   - parseFloat(pre?.uiTokenAmount?.uiAmountString  ?? '0');

    if (received < amount * 0.99)
      return NextResponse.json(
        { error: `Expected ${amount} AUDD, received ${received.toFixed(6)}` },
        { status: 400 },
      );

    const db = getAdmin();

    const { data: battle, error: battleErr } = await db
      .from('mr_battles')
      .select('id, status, players, audd_pool, payment')
      .eq('id', battleId)
      .single();

    if (battleErr || !battle)
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.status !== 'live')
      return NextResponse.json({ error: 'Battle not live' }, { status: 400 });
    if (battle.payment !== 'AUDD')
      return NextResponse.json({ error: 'Not an AUDD battle' }, { status: 400 });

    const fee        = parseFloat((amount * FEE_PCT).toFixed(6));
    const net        = parseFloat((amount - fee).toFixed(6));
    const newPool    = parseFloat(((battle.audd_pool ?? 0) + net).toFixed(6));
    const newPlayers = (battle.players ?? 0) + 1;

    const { error: betErr } = await db.from('mr_bets').upsert(
      {
        battle_id:  battleId,
        wallet,
        side,
        amount,
        fee_total:  fee,
        net_amount: net,
        payment:    'AUDD',
        tx_hashes:  [txHash],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'battle_id,wallet' },
    );
    if (betErr) throw new Error(betErr.message);

    const { error: updateErr } = await db
      .from('mr_battles')
      .update({ audd_pool: newPool, players: newPlayers })
      .eq('id', battleId);
    if (updateErr) throw new Error(updateErr.message);

    await db.from('mr_activities').insert({
      wallet,
      action:     'joined',
      amount,
      battle:     battleId,
      tx_hash:    txHash,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, bet: { fee, net, newPool, newPlayers } });

  } catch (e) {
    console.error('[join-battle-audd]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
