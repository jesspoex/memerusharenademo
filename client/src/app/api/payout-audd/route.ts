import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const AUDD_MINT     = new PublicKey('AUDDnYwArF6HiQGGMRLsEFoGQ4um4dMgKECCUB5q9q5');
const AUDD_DECIMALS = 6;

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
    const { battleId } = await req.json() as { battleId: string };
    if (!battleId)
      return NextResponse.json({ error: 'Missing battleId' }, { status: 400 });

    const db = getAdmin();

    const { data: battle, error: fetchErr } = await db
      .from('mr_battles')
      .select('id, status, payment, winner, winner_wallet, audd_pool, audd_payout_tx')
      .eq('id', battleId)
      .single();

    if (fetchErr || !battle)
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    if (battle.payment !== 'AUDD')
      return NextResponse.json({ error: 'Not an AUDD battle' }, { status: 400 });
    if (battle.audd_payout_tx)
      return NextResponse.json({ success: true, alreadyPaid: true, txHash: battle.audd_payout_tx });
    if (!battle.winner_wallet || !(battle.audd_pool > 0))
      return NextResponse.json({ error: 'No winner or pool is zero' }, { status: 400 });

    const privateKeyEnv = process.env.TREASURY_PRIVATE_KEY;
    if (!privateKeyEnv) throw new Error('TREASURY_PRIVATE_KEY not set');

    const treasury = Keypair.fromSecretKey(bs58.decode(privateKeyEnv));
    const conn     = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
      { commitment: 'confirmed' },
    );

    const winner  = new PublicKey(battle.winner_wallet);
    const fromATA = await getOrCreateAssociatedTokenAccount(
      conn, treasury, AUDD_MINT, treasury.publicKey,
    );
    const toATA   = await getOrCreateAssociatedTokenAccount(
      conn, treasury, AUDD_MINT, winner,
    );

    const rawAmount = BigInt(Math.floor(battle.audd_pool * Math.pow(10, AUDD_DECIMALS)));
    const tx        = new Transaction().add(
      createTransferInstruction(fromATA.address, toATA.address, treasury.publicKey, rawAmount),
    );

    const txHash = await sendAndConfirmTransaction(conn, tx, [treasury], {
      commitment: 'confirmed',
    });

    const { error: updateErr } = await db
      .from('mr_battles')
      .update({ status: 'paid', audd_payout_tx: txHash, ended_at: new Date().toISOString() })
      .eq('id', battleId);
    if (updateErr) throw new Error(updateErr.message);

    await db.from('mr_winners').insert({
      wallet:     battle.winner_wallet,
      amount_sol: 0,
      battle:     battleId,
      tx_hash:    txHash,
      created_at: new Date().toISOString(),
    });

    await db.from('mr_activities').insert({
      wallet:     battle.winner_wallet,
      action:     'won',
      amount:     battle.audd_pool,
      battle:     battleId,
      tx_hash:    txHash,
      created_at: new Date().toISOString(),
    });

    console.info(`[payout-audd] ${battle.audd_pool} AUDD → ${battle.winner_wallet} | ${txHash}`);

    return NextResponse.json({ success: true, txHash, auddPaid: battle.audd_pool, winner: battle.winner_wallet });

  } catch (e) {
    console.error('[payout-audd]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
  }
