/**
 * lib/payout.ts
 * All winner calculation and payout logic — server-side ONLY.
 */

import { sendSolFromTreasury } from './solana';
import { getBattleById, getBetsForBattle, dbPatch, dbInsert, incrementStats, DbBattle, DbBet } from './supabase';
import { shortWallet } from './validation';

const MIN_PAYOUT_SOL = 0.001;
const FEE_PCT        = 2; // 2% platform fee

export interface BattlePayoutResult {
  success: boolean; battleId: string;
  winnerWallet?: string; winnerToken?: string;
  payoutSol?: number; txHash?: string;
  alreadyPaid?: boolean; isArena?: boolean; error?: string;
}

export async function executePayout(battleId: string): Promise<BattlePayoutResult> {
  const battle = await getBattleById(battleId);
  if (!battle)               return { success: false, battleId, error: 'Battle not found' };
  if (battle.mode !== 'real') return { success: true,  battleId, isArena: true };
  if (battle.status === 'paid' && battle.payout_tx_hash) {
    return { success: true, battleId, alreadyPaid: true, txHash: battle.payout_tx_hash, winnerWallet: battle.winner_wallet, winnerToken: battle.winner, payoutSol: battle.prize_pool };
  }
  if (battle.status === 'live') return { success: false, battleId, error: 'Battle still live' };
  if (!battle.winner)            return { success: false, battleId, error: 'Winner not set yet' };

  const bets = await getBetsForBattle(battleId);
  if (bets.length === 0) return refundCreator(battle);

  const winnerSide = battle.winner === battle.token_a ? 'A' : 'B';
  const winnerBets = bets.filter(b => b.side === winnerSide);
  if (winnerBets.length === 0) return refundAll(battle, bets);
  if (winnerBets.length === 1)  return payoutSingle(battle, winnerBets[0], bets);
  return payoutProportional(battle, winnerBets, bets);
}

async function payoutSingle(battle: DbBattle, winBet: DbBet, allBets: DbBet[]): Promise<BattlePayoutResult> {
  const totalDeposited = allBets.reduce((s, b) => s + b.amount, 0);
  const totalFees      = allBets.reduce((s, b) => s + b.fee_total, 0);
  const prizePool      = parseFloat((totalDeposited - totalFees).toFixed(6));

  if (prizePool < MIN_PAYOUT_SOL) {
    await markPaid(battle.id, 'TOO_SMALL', winBet.wallet, battle.winner!, prizePool);
    return { success: true, battleId: battle.id, winnerWallet: winBet.wallet, winnerToken: battle.winner, payoutSol: prizePool, error: 'Prize too small to send on-chain' };
  }

  const result = await sendSolFromTreasury(winBet.wallet, prizePool);
  if (!result.success) return { success: false, battleId: battle.id, error: result.error };

  await markPaid(battle.id, result.txHash!, winBet.wallet, battle.winner!, prizePool);
  await sendTelegramAlert(battle, winBet.wallet, prizePool, result.txHash!, allBets.length - 1);
  return { success: true, battleId: battle.id, winnerWallet: winBet.wallet, winnerToken: battle.winner, payoutSol: prizePool, txHash: result.txHash };
}

async function payoutProportional(battle: DbBattle, winnerBets: DbBet[], allBets: DbBet[]): Promise<BattlePayoutResult> {
  const totalDeposited = allBets.reduce((s, b) => s + b.amount, 0);
  const totalFees      = allBets.reduce((s, b) => s + b.fee_total, 0);
  const prizePool      = parseFloat((totalDeposited - totalFees).toFixed(6));
  const winnerTotal    = winnerBets.reduce((s, b) => s + b.amount, 0);
  let lastTx = ''; let lastWallet = '';

  for (const bet of winnerBets) {
    const share  = bet.amount / winnerTotal;
    const payout = parseFloat((prizePool * share).toFixed(6));
    if (payout < MIN_PAYOUT_SOL) continue;
    const result = await sendSolFromTreasury(bet.wallet, payout);
    if (result.success) {
      lastTx     = result.txHash!;
      lastWallet = bet.wallet;
      await dbInsert('mr_winners', { wallet: bet.wallet, amount_sol: payout, battle: `${battle.token_a} vs ${battle.token_b}`, tx_hash: result.txHash, created_at: new Date().toISOString() });
    }
  }

  if (lastWallet) await markPaid(battle.id, lastTx, lastWallet, battle.winner!, prizePool);
  return { success: !!lastWallet, battleId: battle.id, winnerWallet: lastWallet, winnerToken: battle.winner, payoutSol: prizePool, txHash: lastTx };
}

async function refundCreator(battle: DbBattle): Promise<BattlePayoutResult> {
  const refund = parseFloat((battle.total_deposited * 0.98).toFixed(6));
  if (refund < MIN_PAYOUT_SOL) {
    await markPaid(battle.id, 'NO_BETS', battle.creator, 'REFUND', 0);
    return { success: true, battleId: battle.id, error: 'No bets placed' };
  }
  const result = await sendSolFromTreasury(battle.creator, refund);
  if (result.success) await markPaid(battle.id, result.txHash!, battle.creator, 'REFUND', refund);
  return { success: result.success, battleId: battle.id, winnerWallet: battle.creator, payoutSol: refund, txHash: result.txHash, error: result.error };
}

async function refundAll(battle: DbBattle, bets: DbBet[]): Promise<BattlePayoutResult> {
  for (const bet of bets) {
    const refund = parseFloat((bet.net_amount * 0.98).toFixed(6));
    if (refund >= MIN_PAYOUT_SOL) await sendSolFromTreasury(bet.wallet, refund);
  }
  await markPaid(battle.id, 'NO_WINNER_BETS', '', battle.winner ?? '', 0);
  return { success: true, battleId: battle.id, error: 'No bets on winning side — refunded' };
}

async function markPaid(battleId: string, txHash: string, winnerWallet: string, winnerToken: string, payoutSol: number): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    dbPatch('mr_battles', `id=eq.${battleId}`, { status: 'paid', payout_tx_hash: txHash, winner_wallet: winnerWallet, ended_at: now }),
    payoutSol > 0 && winnerWallet ? dbInsert('mr_winners', { wallet: winnerWallet, amount_sol: payoutSol, battle: battleId, tx_hash: txHash, created_at: now }) : Promise.resolve(),
    payoutSol > 0 && winnerWallet ? dbInsert('mr_activities', { wallet: shortWallet(winnerWallet), action: 'won', amount: payoutSol, battle: battleId, tx_hash: txHash, created_at: now }) : Promise.resolve(),
    payoutSol > 0 ? incrementStats(0, payoutSol) : Promise.resolve(),
  ]);
}

async function sendTelegramAlert(battle: DbBattle, winner: string, amount: number, txHash: string, losers: number): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const msg = [
    `🏆 <b>Battle Paid!</b>`,
    `⚔️ ${battle.token_a} vs ${battle.token_b}`,
    `🏆 Winner: <b>${battle.winner}</b>`,
    `💰 Payout: <b>${amount.toFixed(4)} SOL</b>`,
    `👤 To: <code>${shortWallet(winner)}</code>`,
    `👥 ${losers} loser(s)`,
    `🔗 <a href="https://solscan.io/tx/${txHash}">Verify on Solscan</a>`,
  ].join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML', disable_web_page_preview: false }),
    });
  } catch {}
}
