/**
 * hooks/useBattleChart.ts
 * Fetches pair price + generates candlestick data for the battle chart.
 * Uses DexScreener search by symbol → picks best scored pair → synthetic OHLCV.
 * No external charting library required.
 */
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h';

export interface Candle {
  time:   number; // unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface ChartData {
  candles:      Candle[];
  priceUsd:     number;
  change24h:    number;
  volume24h:    number;
  liquidityUsd: number;
  pairAddress:  string | null;
  symbol:       string;
  loading:      boolean;
  error:        string | null;
}

// ── Candle counts per interval ────────────────────────────────────────────────
const CANDLE_COUNT: Record<Interval, number> = {
  '1m': 120, '5m': 96, '15m': 72, '1h': 60, '4h': 48,
};

// ── Module-level pair info cache (2 min) ──────────────────────────────────────
interface PairInfo {
  pairAddress:  string;
  priceUsd:     number;
  change24h:    number;
  volume24h:    number;
  liquidityUsd: number;
  fetchedAt:    number;
}
const _pairCache = new Map<string, PairInfo>();

async function fetchPairInfo(symbol: string): Promise<PairInfo | null> {
  const hit = _pairCache.get(symbol.toUpperCase());
  if (hit && Date.now() - hit.fetchedAt < 120_000) return hit;

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol + ' solana')}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7_000) },
    );
    if (!r.ok) return null;
    const d = await r.json() as {
      pairs?: Array<{
        chainId: string; pairAddress: string;
        baseToken: { symbol: string };
        quoteToken: { symbol: string };
        priceUsd?: string;
        priceChange?: { h24?: number };
        volume?: { h24?: number };
        liquidity?: { usd?: number };
      }>;
    };

    const matching = (d.pairs ?? [])
      .filter(p =>
        p.chainId === 'solana' &&
        p.baseToken.symbol.toUpperCase() === symbol.toUpperCase()
      )
      .sort((a, b) => {
        const sA = (a.liquidity?.usd ?? 0) * 0.6 + (a.volume?.h24 ?? 0) * 0.3
          + (a.quoteToken.symbol === 'SOL' ? 40_000 : 0);
        const sB = (b.liquidity?.usd ?? 0) * 0.6 + (b.volume?.h24 ?? 0) * 0.3
          + (b.quoteToken.symbol === 'SOL' ? 40_000 : 0);
        return sB - sA;
      });

    if (!matching.length) return null;
    const best = matching[0];
    const info: PairInfo = {
      pairAddress:  best.pairAddress,
      priceUsd:     parseFloat(best.priceUsd ?? '0') || 0,
      change24h:    best.priceChange?.h24 ?? 0,
      volume24h:    best.volume?.h24 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      fetchedAt:    Date.now(),
    };
    _pairCache.set(symbol.toUpperCase(), info);
    return info;
  } catch {
    return null;
  }
}

// ── Synthetic OHLCV generator ─────────────────────────────────────────────────
// Realistic random walk anchored to current price + 24h drift.
// Replaced 1:1 when DexScreener releases a public OHLCV endpoint.
function buildCandles(price: number, change24h: number, interval: Interval): Candle[] {
  if (price <= 0) return [];
  const n       = CANDLE_COUNT[interval];
  const volMap: Record<Interval, number> = {
    '1m': 0.003, '5m': 0.006, '15m': 0.011, '1h': 0.019, '4h': 0.032,
  };
  const stepSec: Record<Interval, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400,
  };
  const vol   = volMap[interval];
  const drift = (change24h / 100) / n;
  const start = price / (1 + change24h / 100);
  const now   = Math.floor(Date.now() / 1000);

  const candles: Candle[] = [];
  let cur = start;

  for (let i = 0; i < n; i++) {
    const t     = now - (n - i) * stepSec[interval];
    const chg   = (Math.random() - 0.48) * vol + drift;
    const open  = cur;
    const close = Math.max(cur * (1 + chg), cur * 0.001);
    const wick  = Math.abs(close - open) * (0.3 + Math.random() * 0.7);
    const high  = Math.max(open, close) + wick;
    const low   = Math.max(Math.min(open, close) - wick, cur * 0.001);
    candles.push({ time: t, open, high, low, close, volume: 5_000 + Math.random() * 50_000 });
    cur = close;
  }

  // Pin final close to actual price
  if (candles.length) {
    const ratio = price / candles[candles.length - 1].close;
    const adj   = Math.max(1, Math.floor(n * 0.08));
    for (let i = n - adj; i < n; i++) {
      const t = (i - (n - adj)) / adj;
      const f = 1 + (ratio - 1) * t;
      candles[i].open  *= f; candles[i].close *= f;
      candles[i].high  *= f; candles[i].low   *= f;
    }
    candles[n - 1].close = price;
  }
  return candles;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useBattleChart(opts: {
  tokenASymbol: string;
  tokenBSymbol: string;
  tokenAPrice?: number;
  tokenBPrice?: number;
  tokenAChange24h?: number;
  tokenBChange24h?: number;
}) {
  const { tokenASymbol, tokenBSymbol,
    tokenAPrice = 0, tokenBPrice = 0,
    tokenAChange24h = 0, tokenBChange24h = 0 } = opts;

  const [interval,    setIntervalState] = useState<Interval>('5m');
  const [activeToken, setActiveToken]   = useState<'A' | 'B'>('A');
  const [data,        setData]          = useState<ChartData>({
    candles: [], priceUsd: 0, change24h: 0, volume24h: 0,
    liquidityUsd: 0, pairAddress: null,
    symbol: tokenASymbol, loading: true, error: null,
  });
  const loading = useRef(false);

  const load = useCallback(async (token: 'A' | 'B', iv: Interval) => {
    if (loading.current) return;
    loading.current = true;
    setData(p => ({ ...p, loading: true, error: null }));

    const symbol  = token === 'A' ? tokenASymbol  : tokenBSymbol;
    const kPrice  = token === 'A' ? tokenAPrice    : tokenBPrice;
    const kChange = token === 'A' ? tokenAChange24h : tokenBChange24h;

    try {
      const info = await fetchPairInfo(symbol);
      const price  = info?.priceUsd   || kPrice;
      const change = info?.change24h   ?? kChange;

      setData({
        candles:      buildCandles(price, change, iv),
        priceUsd:     price,
        change24h:    change,
        volume24h:    info?.volume24h    ?? 0,
        liquidityUsd: info?.liquidityUsd ?? 0,
        pairAddress:  info?.pairAddress  ?? null,
        symbol,
        loading:      false,
        error:        null,
      });
    } catch (e) {
      setData(p => ({ ...p, loading: false, error: 'Chart load failed' }));
    } finally {
      loading.current = false;
    }
  }, [tokenASymbol, tokenBSymbol, tokenAPrice, tokenBPrice, tokenAChange24h, tokenBChange24h]);

  // Initial load
  useEffect(() => { load('A', '5m'); }, [tokenASymbol, tokenBSymbol]);

  const changeInterval = useCallback((iv: Interval) => {
    setIntervalState(iv); load(activeToken, iv);
  }, [activeToken, load]);

  const changeToken = useCallback((t: 'A' | 'B') => {
    setActiveToken(t); load(t, interval);
  }, [interval, load]);

  return { data, interval, activeToken, changeInterval, changeToken };
}
