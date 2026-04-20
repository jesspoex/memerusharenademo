/**
 * trade/hooks/useBattleData.ts
 * All data fetching, realtime subscriptions, and battle animation.
 * Lifted out of TradeContent — no JSX, no rendering.
 */
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CFG, TOKENS, ARENA_PAIRS,
  toLocalBattle, tAgo, sw,
  playTick, playWinner,
  Battle, DbBattle, DbActivity, DbStats, DbWinner,
  Activity, RecentWinner, LeaderboardEntry,
} from '../constants';
import { sbGet, sbInsert, createRealtimeChannel } from '../supabase-client';

export interface BattleDataState {
  battles:       Battle[];
  battleHistory: DbBattle[];
  activities:    Activity[];
  recentWinners: RecentWinner[];
  leaderboard:   LeaderboardEntry[];
  dbStats:       DbStats | null;
  dbLoaded:      boolean;
  realtimeOk:    boolean;
  newBattleToast: string | null;
}

export interface BattleDataActions {
  setBattles:       React.Dispatch<React.SetStateAction<Battle[]>>;
  setActiveBattle:  React.Dispatch<React.SetStateAction<Battle | null>>;
  setBattleTimeLeft:React.Dispatch<React.SetStateAction<number>>;
  setPickedSide:    React.Dispatch<React.SetStateAction<'A'|'B'|null>>;
  loadBattles:      () => Promise<number>;
  checkAndRespawn:  () => Promise<void>;
  soundedRef:       React.MutableRefObject<Record<string,boolean>>;
}

export function useBattleData(
  activeBattleRef: React.MutableRefObject<Battle | null>,
  setActiveBattle: React.Dispatch<React.SetStateAction<Battle | null>>,
  setBattleTimeLeft: React.Dispatch<React.SetStateAction<number>>,
  setPickedSide: React.Dispatch<React.SetStateAction<'A'|'B'|null>>,
): BattleDataState & { loadBattles: () => Promise<number>; checkAndRespawn: () => Promise<void>; soundedRef: React.MutableRefObject<Record<string,boolean>>; setBattles: React.Dispatch<React.SetStateAction<Battle[]>> } {
  const [battles,        setBattles]        = useState<Battle[]>([]);
  const [battleHistory,  setBattleHistory]  = useState<DbBattle[]>([]);
  const [activities,     setActivities]     = useState<Activity[]>([]);
  const [recentWinners,  setRecentWinners]  = useState<RecentWinner[]>([]);
  const [leaderboard,    setLeaderboard]    = useState<LeaderboardEntry[]>([]);
  const [dbStats,        setDbStats]        = useState<DbStats | null>(null);
  const [dbLoaded,       setDbLoaded]       = useState(false);
  const [realtimeOk,     setRealtimeOk]     = useState(false);
  const [newBattleToast, setNewBattleToast] = useState<string | null>(null);

  const respawnLock   = useRef(false);
  const battleEndedRef = useRef<Set<string>>(new Set());
  const soundedRef    = useRef<Record<string, boolean>>({});

  // ── Fetch functions ─────────────────────────────────────────────────────────
  const loadBattles = useCallback(async () => {
    try {
      const res  = await fetch('/api/battles?status=live,ended&limit=30', { cache: 'no-store' });
      const data = await res.json() as { battles?: DbBattle[] };
      const rows = data.battles ?? [];
      setBattles(prev => rows.map((db: DbBattle) => toLocalBattle(db, prev.find(b => b.id === db.id))));
      return rows.length;
    } catch { return 0; }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/stats', { cache: 'no-store' });
      const data = await res.json() as { players?:number; battles?:number; volSol?:number; paidSol?:number };
      setDbStats({ id:1, players:data.players??0, battles:data.battles??0, vol_sol:data.volSol??0, paid_sol:data.paidSol??0, updated_at:new Date().toISOString() });
    } catch {}
  }, []);

  const loadActivity = useCallback(async () => {
    const rows = await sbGet<DbActivity>('mr_activities', 'select=*&order=created_at.desc&limit=20');
    if (rows?.length) {
      setActivities(rows.map(a => ({
        id: String(a.id ?? Date.now()), user: a.wallet,
        action: a.action as Activity['action'], amount: a.amount,
        battle: a.battle, time: tAgo(a.created_at), isReal: true, txHash: a.tx_hash,
      })));
    }
  }, []);

  const loadWinners = useCallback(async () => {
    try {
      const res  = await fetch('/api/recent-winners', { cache: 'no-store' });
      const data = await res.json() as { winners?: Array<{wallet:string;fullWallet:string;amountSol:number;battle:string;txHash?:string;time:string}> };
      const rows = data.winners ?? [];
      if (rows.length) {
        setRecentWinners(rows.slice(0, 10).map(w => ({
          wallet: w.wallet, amount: w.amountSol,
          battle: w.battle, txHash: w.txHash, time: tAgo(w.time),
        })));
        const grouped: Record<string, { total: number; wins: number }> = {};
        rows.forEach(w => {
          grouped[w.wallet] = { total: (grouped[w.wallet]?.total ?? 0) + w.amountSol, wins: (grouped[w.wallet]?.wins ?? 0) + 1 };
        });
        setLeaderboard(
          Object.entries(grouped)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5)
            .map(([w, d], i) => ({ rank: i + 1, wallet: w, earnings: parseFloat(d.total.toFixed(3)), wins: d.wins })),
        );
      }
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res  = await fetch('/api/battles?status=live,ended,paid&limit=100', { cache: 'no-store' });
      const data = await res.json() as { battles?: DbBattle[] };
      if (data.battles?.length) setBattleHistory(data.battles);
    } catch {}
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const rows = await sbGet<{ wallet: string; total_pnl: number; wins: number }>(
        'mr_user_stats', 'select=wallet,total_pnl,wins&order=total_pnl.desc&limit=10',
      );
      if (rows?.length) {
        setLeaderboard(
          rows
            .filter(r => (r.total_pnl ?? 0) > 0)
            .map((r, i) => ({ rank: i + 1, wallet: sw(r.wallet), earnings: parseFloat((r.total_pnl ?? 0).toFixed(4)), wins: r.wins ?? 0 })),
        );
      }
    } catch {}
  }, []);

  // ── Realtime subscriptions ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubBattles = createRealtimeChannel('mr_battles', (payload) => {
      const db = payload.new as DbBattle;
      if (!db.id) return;
      if (payload.eventType === 'INSERT') {
        setBattles(prev => {
          if (prev.find(b => b.id === db.id)) return prev;
          if (db.creator !== 'arena') {
            setNewBattleToast(`⚔️ New battle: ${db.token_a} vs ${db.token_b}!`);
            setTimeout(() => setNewBattleToast(null), 4000);
          }
          return [toLocalBattle(db), ...prev].slice(0, 30);
        });
      } else if (payload.eventType === 'UPDATE') {
        setBattles(prev => prev.map(b => b.id !== db.id ? b : toLocalBattle(db, b)));
        setActiveBattle(prev => (!prev || prev.id !== db.id) ? prev : toLocalBattle(db, prev));
      }
    }, () => setRealtimeOk(true));

    const unsubActivity = createRealtimeChannel('mr_activities', (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const a = payload.new as DbActivity;
      setActivities(prev => [{
        id: String(a.id ?? Date.now()), user: a.wallet,
        action: a.action as Activity['action'], amount: a.amount,
        battle: a.battle, time: 'Just now', isReal: true, txHash: a.tx_hash,
      }, ...prev].slice(0, 20));
    });

    const unsubWinners = createRealtimeChannel('mr_winners', (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const w = payload.new as DbWinner;
      setRecentWinners(prev => [{
        wallet: w.wallet, amount: w.amount_sol,
        battle: w.battle, txHash: w.tx_hash, time: 'Just now',
      }, ...prev].slice(0, 10));
    });

    const unsubStats = createRealtimeChannel('mr_stats', (payload) => {
      if (payload.eventType === 'UPDATE') setDbStats(payload.new as DbStats);
    });

    return () => { unsubBattles(); unsubActivity(); unsubWinners(); unsubStats(); };
  }, [setActiveBattle]);

  // ── Initial load + fallback polling ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadBattles(), loadStats(), loadActivity(), loadWinners(), loadHistory()])
      .then(([battleCount]) => {
        setDbLoaded(true);
        setBattles(prev => {
          if (prev.filter(b => b.status === 'live').length < CFG.KEEP_LIVE_MIN) {
            setTimeout(() => checkAndRespawn(), 300);
          }
          return prev;
        });
        const openBattleId = sessionStorage.getItem('mr_open_battle');
        if (openBattleId) {
          sessionStorage.removeItem('mr_open_battle');
          setTimeout(() => {
            setBattles(prev => {
              const target = prev.find(b => b.id === openBattleId);
              if (target) {
                setActiveBattle(target);
                setBattleTimeLeft(Math.max(0, Math.floor((target.endTime - Date.now()) / 1000)));
                setPickedSide(null);
                soundedRef.current = {};
              }
              return prev;
            });
          }, 500);
        }
        return battleCount;
      })
      .catch(() => setDbLoaded(true));

    loadLeaderboard();
    const pollBattles     = setInterval(loadBattles,     10_000);
    const pollStats       = setInterval(loadStats,       30_000);
    const pollActivity    = setInterval(loadActivity,    15_000);
    const pollWinners     = setInterval(loadWinners,     30_000);
    const pollHistory     = setInterval(loadHistory,     60_000);
    const pollLeaderboard = setInterval(loadLeaderboard, 60_000);

    return () => {
      clearInterval(pollBattles);
      clearInterval(pollStats);
      clearInterval(pollActivity);
      clearInterval(pollWinners);
      clearInterval(pollHistory);
      clearInterval(pollLeaderboard);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-respawn ─────────────────────────────────────────────────────────────
  const checkAndRespawn = useCallback(async () => {
    if (respawnLock.current) return;
    respawnLock.current = true;
    try {
      const res = await fetch('/api/battles?status=live', { signal: AbortSignal.timeout(8_000) });
      if (res.ok) { await loadBattles(); return; }
    } catch {}
    try {
      const now  = new Date();
      const live = await sbGet<DbBattle>('mr_battles', `status=eq.live&end_time=gt.${now.toISOString()}&select=id,token_a,token_b`);
      const needed   = CFG.KEEP_LIVE_MIN - live.length;
      if (needed <= 0) return;
      const existing = new Set(live.map(b => `${b.token_a}_${b.token_b}`));
      const shuffled = [...ARENA_PAIRS]
        .filter(p => !existing.has(`${p[0]}_${p[1]}`) && !existing.has(`${p[1]}_${p[0]}`))
        .sort(() => Math.random() - 0.5)
        .slice(0, needed);
      await Promise.all(shuffled.map((pair, i) => {
        const dur = [180, 300, 420, 600][i % 4];
        const end = new Date(now.getTime() + dur * 1000);
        const amt = parseFloat((CFG.MIN_BET_SOL + Math.random() * 0.007).toFixed(4));
        return sbInsert('mr_battles', {
          id: `sys_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          creator: 'system', mode: 'arena', type: 'system',
          token_a: pair[0], token_b: pair[1],
          amount: amt, prize_pool: parseFloat((amt * 0.98).toFixed(4)),
          status: 'live', payment: 'SOL',
          players: Math.floor(Math.random() * 3) + 1,
          start_time: now.toISOString(), end_time: end.toISOString(), created_at: now.toISOString(),
        });
      }));
      await loadBattles();
    } finally { respawnLock.current = false; }
  }, [loadBattles]);

  useEffect(() => {
    const t0 = setTimeout(() => checkAndRespawn(), 1_500);
    const id  = setInterval(() => checkAndRespawn(), CFG.RESPAWN_INTERVAL);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [checkAndRespawn]);

  // ── 1-second chart animation ticker ─────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setBattles(prev => {
        const updated = prev.map(b => {
          if (b.status !== 'live') return b;
          const tokA  = TOKENS.find(t => t.symbol === b.tokenA);
          const tokB  = TOKENS.find(t => t.symbol === b.tokenB);
          const biasA = tokA ? (tokA.priceChange24h > 0 ? 0.004 : -0.004) : 0;
          const biasB = tokB ? (tokB.priceChange24h > 0 ? 0.004 : -0.004) : 0;
          const la = b.chartA[b.chartA.length - 1] ?? 0;
          const lb = b.chartB[b.chartB.length - 1] ?? 0;
          const na = parseFloat((la + biasA + (Math.random() - 0.5) * 0.05).toFixed(5));
          const nb = parseFloat((lb + biasB + (Math.random() - 0.5) * 0.05).toFixed(5));
          const cA = [...b.chartA.slice(-300), na];
          const cB = [...b.chartB.slice(-300), nb];

          const timeLeft = Math.max(0, Math.floor((b.endTime - now) / 1000));
          if (timeLeft === 0 && !battleEndedRef.current.has(b.id)) {
            battleEndedRef.current.add(b.id);
            const winner = na >= nb ? b.tokenA : b.tokenB;
            console.info('[Battle] Expired:', b.id, '— awaiting server resolution');
            return { ...b, status: 'ended' as const, winner, tokenAChange: na, tokenBChange: nb, chartA: cA, chartB: cB };
          }
          return { ...b, tokenAChange: na, tokenBChange: nb, chartA: cA, chartB: cB };
        });

        // Sync active battle chart
        setBattles(cur => {
          setActiveBattle(prevActive => {
            if (!prevActive || prevActive.status !== 'live') return prevActive;
            const tl = Math.max(0, Math.floor((prevActive.endTime - now) / 1000));
            setBattleTimeLeft(tl);
            if (tl <= 10 && tl > 0 && !soundedRef.current[`${prevActive.id}_${tl}`]) {
              soundedRef.current[`${prevActive.id}_${tl}`] = true; playTick();
            }
            if (tl === 0 && !soundedRef.current[`${prevActive.id}_win`]) {
              soundedRef.current[`${prevActive.id}_win`] = true; setTimeout(playWinner, 300);
            }
            const up = cur.find(b => b.id === prevActive.id);
            if (!up) return prevActive;
            return { ...prevActive, chartA: up.chartA, chartB: up.chartB, tokenAChange: up.tokenAChange, tokenBChange: up.tokenBChange, status: up.status, winner: up.winner };
          });
          return cur;
        });

        return updated;
      });
    }, 1000);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    battles, setBattles,
    battleHistory, activities, recentWinners, leaderboard,
    dbStats, dbLoaded, realtimeOk, newBattleToast,
    loadBattles, checkAndRespawn, soundedRef,
  };
}
