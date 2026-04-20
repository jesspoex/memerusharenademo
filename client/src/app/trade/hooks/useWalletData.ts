/**
 * trade/hooks/useWalletData.ts
 * Wallet balances, user profile, prices — all wallet-dependent data.
 */
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { CFG, TOKENS, Token, UserProfile, lsSave, lsLoad, sw, sf, getTier, calcFee } from '../constants';
import { sbGet, sbUpsert } from '../supabase-client';
import type { DbWinner, DbStats } from '../constants';

async function fetchPrices(): Promise<Record<string, { price: number; ch24: number }>> {
  const ids = TOKENS.filter(t => t.coingeckoId).map(t => t.coingeckoId).join(',');
  const out: Record<string, { price: number; ch24: number }> = {};
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, { cache: 'no-store' });
    const d = await r.json() as Record<string, { usd: number; usd_24h_change: number }>;
    TOKENS.filter(t => t.coingeckoId).forEach(t => {
      if (t.coingeckoId && d[t.coingeckoId]) out[t.symbol] = { price: d[t.coingeckoId].usd, ch24: d[t.coingeckoId].usd_24h_change ?? 0 };
    });
  } catch {}
  return out;
}

async function fetchMrushPrice(): Promise<{ price: number; ch24: number; logo: string | null }> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CFG.mrushMint}`, { cache: 'no-store' });
    const d = await r.json() as { pairs?: Array<{ priceUsd: string; priceChange?: { h24?: string }; info?: { imageUrl?: string } }> };
    if (d.pairs?.[0]) return { price: parseFloat(d.pairs[0].priceUsd) || 0, ch24: parseFloat(d.pairs[0].priceChange?.h24 || '0'), logo: d.pairs[0].info?.imageUrl || null };
  } catch {}
  return { price: 0, ch24: 0, logo: null };
}

export function useWalletData(
  publicKey: PublicKey | null,
  connected: boolean,
  dbStats: DbStats | null,
) {
  const connRef = useRef<Connection | null>(null);

  const [tokens,           setTokens]           = useState<Token[]>(TOKENS);
  const [mrushLive,        setMrushLive]         = useState<{ price: number; ch24: number } | null>(null);
  const [solBal,           setSolBal]            = useState<number | null>(null);
  const [mrushBal,         setMrushBal]          = useState<number | null>(null);
  const [balLoading,       setBalLoading]        = useState(false);
  const [userProfile,      setUserProfile]       = useState<UserProfile | null>(null);
  const [referralCount,    setReferralCount]     = useState(0);
  const [referralEarnings, setReferralEarnings]  = useState(0);
  const [shareRewardPending, setShareRewardPending] = useState(0);

  const tier   = getTier(mrushBal ?? 0);
  const glFn   = useCallback((sym: string) => tokens.find(t => t.symbol === sym)?.logoUrl ?? `https://ui-avatars.com/api/?name=${sym}&background=ea580c&color=fff&size=40`, [tokens]);

  // ── Prices ──────────────────────────────────────────────────────────────────
  const refreshPrices = useCallback(async () => {
    const [prices, mrush] = await Promise.all([fetchPrices(), fetchMrushPrice()]);
    setTokens(prev => prev.map(t => {
      if (t.symbol === 'MRUSH') {
        const logo = mrush.logo || t.logoUrl;
        return mrush.price > 0 ? { ...t, price: mrush.price, basePrice: mrush.price, priceChange24h: mrush.ch24, priceDirection: mrush.ch24 > 0 ? 'up' : 'down', logoUrl: logo } as Token : { ...t, logoUrl: logo };
      }
      if (prices[t.symbol]) return { ...t, price: prices[t.symbol].price, basePrice: prices[t.symbol].price, priceChange24h: prices[t.symbol].ch24, priceDirection: prices[t.symbol].ch24 > 0 ? 'up' : 'down' } as Token;
      return t;
    }));
    if (mrush.price > 0) setMrushLive({ price: mrush.price, ch24: mrush.ch24 });
  }, []);

  useEffect(() => {
    refreshPrices();
    const id = setInterval(refreshPrices, 30_000);
    return () => clearInterval(id);
  }, [refreshPrices]);

  // ── Balances ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey || !connected) { setSolBal(null); setMrushBal(null); return; }
    const fetch_ = async () => {
      setBalLoading(true);
      let conn: Connection | null = null;
      for (const url of [CFG.rpcUrl, CFG.fallbackRpcUrl, 'https://api.mainnet-beta.solana.com']) {
        try { const c = new Connection(url, { commitment: 'confirmed' }); await c.getSlot(); conn = c; break; } catch {}
      }
      if (!conn) { setBalLoading(false); return; }
      if (!connRef.current) connRef.current = conn;
      try { setSolBal((await conn.getBalance(publicKey, 'confirmed')) / LAMPORTS_PER_SOL); } catch { setSolBal(0); }
      let found = false;
      try {
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const ata = await getAssociatedTokenAddress(new PublicKey(CFG.mrushMint), publicKey);
        const b   = await conn.getTokenAccountBalance(ata, 'confirmed');
        setMrushBal(b.value.uiAmount ?? 0); found = true;
      } catch {}
      if (!found) {
        try {
          const accs = await conn.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(CFG.mrushMint) }, 'confirmed');
          setMrushBal(accs.value.length > 0 ? (accs.value[0].account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0) : 0);
        } catch { setMrushBal(0); }
      }
      setBalLoading(false);
    };
    fetch_();
    const id = setInterval(fetch_, 20_000);
    return () => clearInterval(id);
  }, [publicKey, connected]);

  // ── Per-wallet profile ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey) return;
    const localProfile = lsLoad<UserProfile | null>(`mr_profile_${publicKey}`, null);
    if (localProfile) setUserProfile(localProfile);

    sbGet<{ wallet: string; wins: number; losses: number; battles_created: number; battles_joined: number; total_pnl: number }>(
      'mr_user_stats', `wallet=eq.${publicKey.toString()}&select=*`,
    ).then(rows => {
      if (rows?.[0]) {
        const r = rows[0];
        const p: UserProfile = { wallet: publicKey.toString(), wins: r.wins ?? 0, losses: r.losses ?? 0, battlesCreated: r.battles_created ?? 0, battlesJoined: r.battles_joined ?? 0, totalPnL: r.total_pnl ?? 0, lastUpdated: Date.now(), shareEarnings: 0 };
        setUserProfile(p);
        lsSave(`mr_profile_${publicKey}`, p);
      }
    }).catch(() => {});

    sbGet<DbWinner>('mr_winners', `wallet=eq.${publicKey.toString()}&select=*`)
      .then(rows => { if (rows?.length) { setReferralCount(rows.length); setReferralEarnings(rows.reduce((s, r) => s + r.amount_sol, 0)); } });

    sbUpsert('mr_stats', {
      id: 1, players: (dbStats?.players ?? 0) + 1, battles: dbStats?.battles ?? 0,
      vol_sol: dbStats?.vol_sol ?? 0, paid_sol: dbStats?.paid_sol ?? 0, updated_at: new Date().toISOString(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  // ── Save profile (localStorage + Supabase) ──────────────────────────────────
  const saveProfile = useCallback((u: Partial<UserProfile>) => {
    if (!publicKey) return;
    const k   = `mr_profile_${publicKey}`;
    const cur = lsLoad<UserProfile>(k, { wallet: publicKey.toString(), wins: 0, losses: 0, battlesCreated: 0, battlesJoined: 0, totalPnL: 0, lastUpdated: Date.now(), shareEarnings: 0 });
    const nw  = { ...cur, ...u, lastUpdated: Date.now() };
    lsSave(k, nw);
    setUserProfile(nw);
    sbUpsert('mr_user_stats', {
      wallet: publicKey.toString(), wins: nw.wins, losses: nw.losses,
      battles_created: nw.battlesCreated, battles_joined: nw.battlesJoined,
      total_pnl: parseFloat((nw.totalPnL ?? 0).toFixed(6)), updated_at: new Date().toISOString(),
    }).catch(() => {});
  }, [publicKey]);

  return {
    connRef, tokens, setTokens, mrushLive,
    solBal, mrushBal, balLoading,
    userProfile, saveProfile,
    referralCount, referralEarnings,
    shareRewardPending, setShareRewardPending,
    tier, glFn,
    calcJoinFee: (amt: number) => calcFee(amt, mrushBal ?? 0),
  };
}
