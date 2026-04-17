"use client";

import { useState, useEffect, useCallback } from 'react';

// ── CONFIG ──────────────────────────────────────────────
const TREASURY_WALLET = 'Fwsyjj7sf64MxCNfkysQ4UoJbE1MYXBe7dp35Czd5Vew';
const MRUSH_CA        = 'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump';
const SOLANA_RPC      = 'https://api.mainnet-beta.solana.com';
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${MRUSH_CA}`;

// ── TYPES ───────────────────────────────────────────────
export interface RealActivity {
  id: string;
  type: 'won' | 'paid' | 'joined';
  wallet: string;          // shortened: "8Px...3F2"
  amount: number;          // SOL
  time: string;            // "2m ago"
  txHash: string;          // full tx hash for Solscan link
  isReal: boolean;         // true = from chain, false = placeholder
}

export interface MrushPrice {
  usd: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
}

export interface RealDataState {
  activities: RealActivity[];
  mrushPrice: MrushPrice | null;
  solBalance: number;
  totalVolume: number;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

// ── HELPERS ─────────────────────────────────────────────
function shortenWallet(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

function timeAgo(unixTimestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - unixTimestamp;
  if (seconds < 60)  return 'Just now';
  if (seconds < 120) return '1m ago';
  if (seconds < 300) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function lamportsToSol(lamports: number): number {
  return parseFloat((lamports / 1_000_000_000).toFixed(4));
}

// ── FETCH REAL TRANSACTIONS FROM SOLANA ─────────────────
async function fetchTreasuryTransactions(): Promise<RealActivity[]> {
  try {
    // Step 1: get recent signatures
    const sigRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          TREASURY_WALLET,
          { limit: 10, commitment: 'confirmed' }
        ],
      }),
    });
    const sigData = await sigRes.json();
    const signatures: { signature: string; blockTime: number }[] =
      sigData?.result ?? [];

    if (!signatures.length) return [];

    // Step 2: get transaction details
    const txRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getTransactions',
        params: [
          signatures.map(s => s.signature),
          { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
        ],
      }),
    });
    const txData = await txRes.json();
    const txList: unknown[] = txData?.result ?? [];

    const activities: RealActivity[] = [];

    txList.forEach((tx: unknown, idx: number) => {
      if (!tx) return;
      const txObj = tx as {
        meta?: {
          err?: unknown;
          preBalances?: number[];
          postBalances?: number[];
        };
        transaction?: {
          message?: {
            accountKeys?: string[];
          };
        };
        blockTime?: number;
      };

      if (txObj.meta?.err) return; // skip failed tx

      const preBalances  = txObj.meta?.preBalances  ?? [];
      const postBalances = txObj.meta?.postBalances ?? [];
      const accounts     = txObj.transaction?.message?.accountKeys ?? [];
      const blockTime    = txObj.blockTime ?? signatures[idx]?.blockTime ?? 0;

      // Calculate SOL delta for treasury wallet (index 0 or find it)
      const treasuryIdx = accounts.findIndex((a: string) => a === TREASURY_WALLET);
      const relevantIdx = treasuryIdx >= 0 ? treasuryIdx : 0;

      const delta = lamportsToSol(
        Math.abs((postBalances[relevantIdx] ?? 0) - (preBalances[relevantIdx] ?? 0))
      );

      if (delta < 0.001) return; // ignore dust

      // Determine counterparty wallet
      const otherIdx = accounts.findIndex(
        (_: string, i: number) => i !== relevantIdx && i < 3
      );
      const counterWallet = accounts[otherIdx] ?? accounts[0] ?? '';

      // Classify: incoming = someone paid (joined / paid), outgoing = payout (won)
      const incoming =
        (postBalances[relevantIdx] ?? 0) > (preBalances[relevantIdx] ?? 0);

      activities.push({
        id: signatures[idx]?.signature ?? `tx_${idx}`,
        type: incoming ? 'paid' : 'won',
        wallet: shortenWallet(counterWallet),
        amount: delta,
        time: timeAgo(blockTime),
        txHash: signatures[idx]?.signature ?? '',
        isReal: true,
      });
    });

    return activities;
  } catch (err) {
    console.warn('[useRealData] fetchTreasuryTransactions failed:', err);
    return [];
  }
}

// ── FETCH $MRUSH PRICE FROM DEXSCREENER ─────────────────
async function fetchMrushPrice(): Promise<MrushPrice | null> {
  try {
    const res = await fetch(DEXSCREENER_API, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();

    // DexScreener returns array of pairs — pick highest liquidity
    const pairs: unknown[] = data?.pairs ?? [];
    if (!pairs.length) return null;

    const best = pairs.reduce((a: unknown, b: unknown) => {
      const aLiq = (a as { liquidity?: { usd?: number } })?.liquidity?.usd ?? 0;
      const bLiq = (b as { liquidity?: { usd?: number } })?.liquidity?.usd ?? 0;
      return aLiq >= bLiq ? a : b;
    }) as {
      priceUsd?: string;
      priceChange?: { h24?: number };
      volume?: { h24?: number };
      fdv?: number;
      liquidity?: { usd?: number };
    };

    return {
      usd:        parseFloat(best.priceUsd ?? '0'),
      change24h:  best.priceChange?.h24 ?? 0,
      volume24h:  best.volume?.h24 ?? 0,
      marketCap:  best.fdv ?? 0,
      liquidity:  best.liquidity?.usd ?? 0,
    };
  } catch (err) {
    console.warn('[useRealData] fetchMrushPrice failed:', err);
    return null;
  }
}

// ── FETCH SOL BALANCE OF TREASURY ───────────────────────
async function fetchTreasuryBalance(): Promise<number> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [TREASURY_WALLET, { commitment: 'confirmed' }],
      }),
    });
    const data = await res.json();
    return lamportsToSol(data?.result?.value ?? 0);
  } catch {
    return 0;
  }
}

// ── MAIN HOOK ───────────────────────────────────────────
export function useRealData(refreshInterval = 30_000) {
  const [state, setState] = useState<RealDataState>({
    activities:   [],
    mrushPrice:   null,
    solBalance:   0,
    totalVolume:  0,
    isLoading:    true,
    lastUpdated:  null,
    error:        null,
  });

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const [activities, mrushPrice, solBalance] = await Promise.all([
        fetchTreasuryTransactions(),
        fetchMrushPrice(),
        fetchTreasuryBalance(),
      ]);

      const totalVolume = activities.reduce((sum, a) => sum + a.amount, 0);

      setState({
        activities,
        mrushPrice,
        solBalance,
        totalVolume: parseFloat(totalVolume.toFixed(4)),
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Gagal fetch data blockchain. Coba lagi.',
      }));
      console.error('[useRealData] refresh error:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(refresh, refreshInterval);
    return () => clearInterval(id);
  }, [refresh, refreshInterval]);

  return { ...state, refresh };
}
