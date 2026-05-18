/**
 * app/api/join-battle/route.ts
 * Validates TX on-chain, records bet, updates pool.
 * Also credits referrer 0.1% reward if referrer wallet passed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateJoinBattleRequest, shortWallet } from '@/lib/validation';
import { validateSolTransaction, getTreasuryPublicKey } from '@/lib/solana';
import { getBattleById, getBetsForBattle, dbInsert, dbPatch, dbSelect, incrementStats } from '@/lib/supabase';
import { checkJoinBattleLimit, getClientIP } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const ip   = getClientIP(req);
    const body = await req.json().catch(() => null);
    const { data, error } = validateJoinBattleRequest(body);
    if (error || !data) return NextResponse.json({ success: false, error }, { status: 400 });

    // referrer is optional — passed when user arrived via a share link
    const { battleId, wallet, txHash, side, amount } = data;
    const referrer = (body?.referrer as string | undefined)?.trim() || null;

    // Rate limit
    const rl = checkJoinBattleLimit(ip, wallet);
    if (!rl.allowed) return NextResponse.json({ success: false, error: 'Too many join requests. Please wait.' }, { status: 429 });

    // Load battle
    const battle = await getBattleById(battleId);
    if (!battle)                  return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    if (battle.status !== 'live') return NextResponse.json({ success: false, error: 'Battle is not live' }, { status: 409 });
    if (battle.end_time && new Date(battle.end_time) <= new Date()) return NextResponse.json({ success: false, error: 'Battle has expired' }, { status: 409 });

    // Arena battles (mode='arena') CAN be joined by real users.
    // When a user joins an arena battle, the battle is upgraded to mixed mode:
    //   - SOL is deposited to treasury and tracked in mr_bets
    //   - If no opponent joins within the time window → full refund
    //   - If a second real user joins on the other side → fair payout applies
    // The battle is NOT silently display-only once a real user has bet.
    // We just note it was originally an arena battle for logging.

    // Duplicate TX check
    const bets = await getBetsForBattle(battleId);
    if (bets.some(b => b.tx_hashes?.includes(txHash))) return NextResponse.json({ success: false, error: 'Transaction already used in this battle' }, { status: 409 });

    // Validate TX on-chain
    const treasury = getTreasuryPublicKey();
    if (!treasury) return NextResponse.json({ success: false, error: 'Server configuration error.' }, { status: 500 });

    const validation = await validateSolTransaction(txHash, wallet, treasury, Math.floor(amount * 1e9));
    if (!validation.valid) {
      console.warn(`[JoinBattle] TX invalid: wallet=${wallet} err=${validation.error}`);
      return NextResponse.json({ success: false, error: `Transaction invalid: ${validation.error}` }, { status: 422 });
    }

    // Fee calculation
    const feeSol  = parseFloat((amount * 0.02).toFixed(6));
    const netSol  = parseFloat((amount - feeSol).toFixed(6));
    const now     = new Date().toISOString();

    // Check if same wallet already bet (top-up)
    const existing = bets.find(b => b.wallet === wallet);
    if (existing) {
      if (existing.side !== side) return NextResponse.json({ success: false, error: `You already bet on side ${existing.side}` }, { status: 409 });
      await dbPatch('mr_bets', `battle_id=eq.${battleId}&wallet=eq.${wallet}`, {
        amount:     parseFloat((existing.amount + amount).toFixed(6)),
        fee_total:  parseFloat((existing.fee_total + feeSol).toFixed(6)),
        net_amount: parseFloat((existing.net_amount + netSol).toFixed(6)),
        tx_hashes:  [...(existing.tx_hashes ?? []), txHash],
        updated_at: now,
      });
    } else {
      await dbInsert('mr_bets', {
        battle_id: battleId, wallet, side, amount, fee_total: feeSol,
        net_amount: netSol, payment: 'SOL', tx_hashes: [txHash],
        created_at: now, updated_at: now,
      });
    }

    const newPlayers   = existing ? battle.players : battle.players + 1;
    const newPool      = parseFloat((battle.prize_pool + netSol).toFixed(6));
    const newDeposited = parseFloat(((battle.total_deposited ?? 0) + amount).toFixed(6));
    const newFees      = parseFloat(((battle.fee_collected ?? 0) + feeSol).toFixed(6));

    // ── Referral credit ────────────────────────────────────────────────────────
    // Only credit on first join (not top-ups), and only if referrer != joiner
    let referralCredited = false;
    if (!existing && referrer && referrer !== wallet) {
      try {
        const referralReward = parseFloat((amount * 0.001).toFixed(6)); // 0.1%
        // Record in mr_activities for tracking
        await dbInsert('mr_activities', {
          wallet:     referrer,
          action:     'referral',
          amount:     referralReward,
          battle:     `${battle.token_a} vs ${battle.token_b}`,
          tx_hash:    txHash,
          created_at: now,
        });
        // Record in mr_winners (referral earnings visible in profile)
        await dbInsert('mr_winners', {
          wallet:     referrer,
          amount_sol: referralReward,
          battle:     `ref:${battleId}`,
          tx_hash:    txHash,
          created_at: now,
        });
        referralCredited = true;
        console.log(`[JoinBattle] Referral credited: ${referrer} +${referralReward} SOL`);
      } catch (e) {
        console.warn('[JoinBattle] Referral credit failed (non-fatal):', e);
      }
    }

    await Promise.all([
      dbPatch('mr_battles', `id=eq.${battleId}`, {
        players:         newPlayers,
        prize_pool:      newPool,
        total_deposited: newDeposited,
        fee_collected:   newFees,
      }),
      dbInsert('mr_activities', {
        wallet:     shortWallet(wallet),
        action:     'joined',
        amount,
        battle:     `${battle.token_a} vs ${battle.token_b}`,
        tx_hash:    txHash,
        created_at: now,
      }),
      incrementStats(amount),
    ]).catch(e => console.error('[JoinBattle] side-effects error:', e));

    return NextResponse.json({
      success: true,
      bet: { battleId, wallet, side, amount, feeSol, netSol, txHash, isTopUp: !!existing, newPool, newPlayers, referralCredited },
    });
  } catch (e) {
    console.error('[JoinBattle] Error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
