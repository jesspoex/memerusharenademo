/**
 * lib/payout.ts
 * Winner calculation and payout logic — server-side ONLY.
 *
 * PAYOUT RULES:
 * ─────────────────────────────────────────────────────────────────
 * Case 1 – REFUND (no opponent within time window):
 *   • Both sides refunded in full (no platform fee charged).
 *
 * Case 2 – Winner placed LESS than loser (underdog wins):
 *   • Winner receives up to 2× their own deposit (net of platform fee).
 *   • Remainder returned to loser(s) net of platform fee.
 *   • Formula: winnerPayout = min(winnerNet * 2, totalPool)
 *              loserRefund  = totalPool - winnerPayout
 *
 * Case 3 – Winner placed MORE than loser (favourite wins):
 *   • Winner receives the entire prize pool (net of platform fee).
 *   • No refund to losers.
 *
 * Platform fee = 2% taken from each deposit at join time.
 * Platform fee is kept in treasury (not redistributed).
 * ─────────────────────────────────────────────────────────────────
 */

import { sendSolFromTreasury } from './solana';
import { getBattleById, getBetsForBattle, dbPatch, dbInsert, incrementStats, DbBet } from './supabase';
import { shortWallet } from './validation';

const MIN_PAYOUT_SOL = 0.0009;
const PLATFORM_FEE_PCT = 0.02; // 2%

export interface BattlePayoutResult {
  success: boolean; battleId: string;
  winnerWallet?: string; winnerToken?: string;
  payoutSol?: number; txHash?: string;
  alreadyPaid?: boolean; isArena?: boolean; error?: string;
  refunded?: boolean;
  breakdown?: {
    totalDeposited: number; totalFees: number; prizePool: number;
    winnerPayout: number; loserRefund: number; rule: string;
  };
}

interface DbBattleLocal {
  id: string; creator: string; token_a: string; token_b: string;
  amount: number; prize_pool: number; winner?: string | null;
  winner_wallet?: string | null; status: string; payment?: string | null;
  tx_hash?: string | null; payout_tx_hash?: string | null;
  players: number; total_deposited?: number | null;
  fee_collected?: number | null; mode: string;
  meta?: Record<string, unknown> | null;
}

export async function executePayout(battleId: string): Promise<BattlePayoutResult> {
  const battle = await getBattleById(battleId) as DbBattleLocal | null;
  if (!battle) return { success: false, battleId, error: 'Battle not found' };

  // Already paid — idempotent
  const alreadyPaidTx = (battle as any).payout_tx_hash as string | undefined;
  if (battle.status === 'paid' && alreadyPaidTx) {
    return { success: true, battleId, alreadyPaid: true, txHash: alreadyPaidTx, winnerWallet: battle.winner_wallet ?? undefined, winnerToken: battle.winner ?? undefined, payoutSol: battle.prize_pool };
  }
  if (battle.status === 'live') return { success: false, battleId, error: 'Battle still live' };
  if (!battle.winner) return { success: false, battleId, error: 'Winner not set yet' };

  const bets = await getBetsForBattle(battleId) as DbBet[];

  // REFUND path — no valid opponent or explicitly flagged
  if (battle.winner === 'REFUND' || battle.winner === 'NO_BETS') {
    return refundAllEntries(battle, bets);
  }

  if (bets.length === 0) return refundCreator(battle);

  const winnerSide = battle.winner === battle.token_a ? 'A' : 'B';
  const loserSide  = winnerSide === 'A' ? 'B' : 'A';
  const winnerBets = bets.filter(b => b.side === winnerSide);
  const loserBets  = bets.filter(b => b.side === loserSide);

  if (winnerBets.length === 0) return refundAllEntries(battle, bets);

  return executeFairPayout(battle, winnerBets, loserBets, bets);
}

/**
 * executeFairPayout — implements the capped payout rule.
 *
 * Underdog wins (winner staked less):
 *   winnerPayout = min(winnerNet * 2, prizePool)
 *   loserRefund  = prizePool - winnerPayout  → returned to loser(s)
 *
 * Favourite wins (winner staked more or equal):
 *   winnerPayout = prizePool  (keep everything)
 *   loserRefund  = 0
 */
async function executeFairPayout(
  battle: DbBattleLocal,
  winnerBets: DbBet[],
  loserBets: DbBet[],
  allBets: DbBet[],
): Promise<BattlePayoutResult> {
  const totalDeposited = allBets.reduce((s, b) => s + (b.amount ?? 0), 0);
  const totalFees      = allBets.reduce((s, b) => s + (b.fee_total ?? 0), 0);
  const prizePool      = parseFloat((totalDeposited - totalFees).toFixed(6));

  const winnerNet = winnerBets.reduce((s, b) => s + (b.net_amount ?? 0), 0);
  const loserNet  = loserBets.reduce((s, b) => s + (b.net_amount ?? 0), 0);

  let winnerPayout: number;
  let loserRefund: number;
  let rule: string;

  if (loserNet > 0 && winnerNet < loserNet) {
    // Underdog wins — cap at 2× their net stake
    winnerPayout = Math.min(parseFloat((winnerNet * 2).toFixed(6)), prizePool);
    loserRefund  = parseFloat(Math.max(0, prizePool - winnerPayout).toFixed(6));
    rule = 'underdog_2x_cap';
  } else {
    // Favourite wins (or equal stake) — take the whole pool
    winnerPayout = prizePool;
    loserRefund  = 0;
    rule = 'favourite_full_pool';
  }

  const breakdown = { totalDeposited, totalFees, prizePool, winnerPayout, loserRefund, rule };
  console.info(`[Payout] ${battle.id} | rule=${rule} | winner=${winnerPayout} SOL | loserRefund=${loserRefund} SOL`);

  // ── Send winner payout ────────────────────────────────────────────────────
  let winnerTx = '';
  let lastWinner = '';
  let totalWinnerPaid = 0;

  if (winnerPayout >= MIN_PAYOUT_SOL) {
    if (winnerBets.length === 1) {
      const r = await sendSolFromTreasury(winnerBets[0].wallet, winnerPayout);
      if (r.success) {
        winnerTx = r.txHash!;
        lastWinner = winnerBets[0].wallet;
        totalWinnerPaid = winnerPayout;
      } else {
        console.error(`[Payout] Winner TX failed: ${r.error}`);
        return { success: false, battleId: battle.id, error: `Winner payout failed: ${r.error}`, breakdown };
      }
    } else {
      // Multiple wallets on winning side — proportional split
      const winnerTotal = winnerBets.reduce((s, b) => s + (b.amount ?? 0), 0);
      for (const bet of winnerBets) {
        const share  = bet.amount / winnerTotal;
        const amount = parseFloat((winnerPayout * share).toFixed(6));
        if (amount < MIN_PAYOUT_SOL) continue;
        const r = await sendSolFromTreasury(bet.wallet, amount);
        if (r.success) {
          winnerTx = r.txHash!;
          lastWinner = bet.wallet;
          totalWinnerPaid += amount;
          await dbInsert('mr_winners', { wallet: bet.wallet, amount_sol: amount, battle: `${battle.token_a} vs ${battle.token_b}`, tx_hash: r.txHash, created_at: new Date().toISOString() });
        }
      }
    }
  }

  // ── Send loser partial refund (underdog rule) ─────────────────────────────
  if (loserRefund >= MIN_PAYOUT_SOL && loserBets.length > 0) {
    const loserTotal = loserBets.reduce((s, b) => s + (b.amount ?? 0), 0);
    for (const bet of loserBets) {
      const share  = bet.amount / loserTotal;
      const amount = parseFloat((loserRefund * share).toFixed(6));
      if (amount < MIN_PAYOUT_SOL) continue;
      const r = await sendSolFromTreasury(bet.wallet, amount);
      if (r.success) {
        await dbInsert('mr_activities', {
          wallet: shortWallet(bet.wallet), action: 'refunded',
          amount, battle: battle.id, tx_hash: r.txHash, created_at: new Date().toISOString(),
        });
        console.info(`[Payout] Loser partial refund: ${shortWallet(bet.wallet)} +${amount} SOL (${r.txHash})`);
      }
    }
  }

  // ── Mark battle as paid ───────────────────────────────────────────────────
  const now = new Date().toISOString();
  await Promise.all([
    dbPatch('mr_battles', `id=eq.${battle.id}`, {
      status: 'paid', payout_tx_hash: winnerTx || 'PAID_NO_TX',
      winner_wallet: lastWinner, ended_at: now,
    }),
    lastWinner && winnerPayout > 0
      ? dbInsert('mr_winners', { wallet: lastWinner, amount_sol: totalWinnerPaid, battle: `${battle.token_a} vs ${battle.token_b}`, tx_hash: winnerTx, created_at: now })
      : Promise.resolve(),
    lastWinner && winnerPayout > 0
      ? dbInsert('mr_activities', { wallet: shortWallet(lastWinner), action: 'won', amount: totalWinnerPaid, battle: `${battle.token_a} vs ${battle.token_b}`, tx_hash: winnerTx, created_at: now })
      : Promise.resolve(),
    winnerPayout > 0 ? incrementStats(0, winnerPayout) : Promise.resolve(),
  ]);

  // Telegram alert
  await sendTelegramAlert(battle, lastWinner, totalWinnerPaid, winnerTx, loserBets.length, breakdown);

  return { success: !!lastWinner, battleId: battle.id, winnerWallet: lastWinner, winnerToken: battle.winner ?? undefined, payoutSol: totalWinnerPaid, txHash: winnerTx, breakdown };
}

async function refundCreator(battle: DbBattleLocal): Promise<BattlePayoutResult> {
  const refund = parseFloat(((battle.total_deposited ?? battle.amount ?? 0)).toFixed(6));
  const now = new Date().toISOString();
  if (refund < MIN_PAYOUT_SOL) {
    await dbPatch('mr_battles', `id=eq.${battle.id}`, { status: 'paid', payout_tx_hash: 'NO_BETS', winner_wallet: null, ended_at: now });
    return { success: true, battleId: battle.id, error: 'No bets placed — amount too small to refund', refunded: true };
  }
  const r = await sendSolFromTreasury(battle.creator, refund);
  if (r.success) {
    await dbPatch('mr_battles', `id=eq.${battle.id}`, { status: 'paid', payout_tx_hash: r.txHash!, winner_wallet: battle.creator, ended_at: now });
    await dbInsert('mr_activities', { wallet: shortWallet(battle.creator), action: 'refunded', amount: refund, battle: battle.id, tx_hash: r.txHash, created_at: now });
  }
  return { success: r.success, battleId: battle.id, winnerWallet: battle.creator, payoutSol: refund, txHash: r.txHash, refunded: true, error: r.error };
}

async function refundAllEntries(battle: DbBattleLocal, bets: DbBet[]): Promise<BattlePayoutResult> {
  if (bets.length === 0) return refundCreator(battle);
  const now = new Date().toISOString();
  let lastTx = ''; let lastWallet = ''; let totalRefunded = 0;

  // Group by wallet — refund full amount (no fee on refund)
  const byWallet = new Map<string, number>();
  for (const bet of bets) {
    byWallet.set(bet.wallet, parseFloat(((byWallet.get(bet.wallet) ?? 0) + (bet.amount ?? 0)).toFixed(6)));
  }

  for (const [wallet, amount] of Array.from(byWallet.entries())) {
    if (amount < MIN_PAYOUT_SOL) continue;
    const r = await sendSolFromTreasury(wallet, amount);
    if (r.success) {
      lastTx = r.txHash ?? lastTx;
      lastWallet = wallet;
      totalRefunded = parseFloat((totalRefunded + amount).toFixed(6));
      await dbInsert('mr_activities', { wallet: shortWallet(wallet), action: 'refunded', amount, battle: battle.id, tx_hash: r.txHash, created_at: now });
    }
  }

  await dbPatch('mr_battles', `id=eq.${battle.id}`, { status: 'paid', payout_tx_hash: lastTx || 'REFUND_NO_TX', winner_wallet: lastWallet || null, ended_at: now });
  return { success: true, battleId: battle.id, winnerWallet: lastWallet, winnerToken: 'REFUND', payoutSol: totalRefunded, txHash: lastTx, refunded: true, error: 'No valid opponent — full refund issued' };
}

async function sendTelegramAlert(battle: DbBattleLocal, winner: string, amount: number, txHash: string, losers: number, breakdown?: { rule: string; loserRefund: number; prizePool: number }): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const ruleNote = breakdown?.rule === 'underdog_2x_cap'
    ? `⚖️ Underdog rule — loser refunded ${breakdown.loserRefund.toFixed(4)} SOL`
    : `🏆 Full pool — favourite wins`;
  const msg = [
    `🏆 <b>Battle Paid!</b>`,
    `⚔️ ${battle.token_a} vs ${battle.token_b}`,
    `🏆 Winner: <b>${battle.winner}</b>`,
    `💰 Payout: <b>${amount.toFixed(4)} SOL</b> of ${breakdown?.prizePool?.toFixed(4) ?? '?'} SOL pool`,
    ruleNote,
    `👤 To: <code>${shortWallet(winner)}</code>`,
    `👥 ${losers} loser(s)`,
    txHash && !txHash.startsWith('PAID') ? `🔗 <a href="https://solscan.io/tx/${txHash}">Verify on Solscan</a>` : '',
  ].filter(Boolean).join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML', disable_web_page_preview: false }),
    });
  } catch {}
}
