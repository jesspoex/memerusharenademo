/**
 * hooks/useBattleChart.ts
 * Fetches pair price + generates candlestick data for the battle chart.
 *
 * LIVE TICK (Issue 1 fix):
 * - After initial load, a 5-second interval appends a new synthetic candle
 *   using the last known price + small volatility step.
 * - Every 30 seconds the real DexScreener price is re-fetched (fresh pair cache)
 *   and the last candle is pinned to the real price.
 * - `priceUsd` and `change24h` update on every tick so ChartHeader feels live.
 * - `pricePulse` increments on each tick so ChartHeader can flash the price.
 * - Performance: only runs while `isLive=true` prop is set.
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
  pricePulse:   number; // increments on every live tick — use for CSS flash
}

// ── Candle counts per interval ────────────────────────────────────────────────
const CANDLE_COUNT: Record<Interval, number> = {
  '1m': 120, '5m': 96, '15m': 72, '1h': 60, '4h': 48,
};

// ── Interval step in seconds ──────────────────────────────────────────────────
const STEP_SEC: Record<Interval, number> = {
  '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400,
};

// ── Volatility per candle per interval ───────────────────────────────────────
const VOL_MAP: Record<Interval, number> = {
  '1m': 0.003, '5m': 0.006, '15m': 0.011, '1h': 0.019, '4h': 0.032,
};

// ── Module-level pair info cache ──────────────────────────────────────────────
interface PairInfo {
  pairAddress:  string;
  priceUsd:     number;
  change24h:    number;
  volume24h:    number;
  liquidityUsd: number;
  fetchedAt:    number;
}
const _pairCache = new Map<string, PairInfo>();

async function fetchPairInfo(symbol: string, forceRefresh = false): Promise<PairInfo | null> {
  const key = symbol.toUpperCase();
  const hit = _pairCache.get(key);
  if (!forceRefresh && hit && Date.now() - hit.fetchedAt < 120_000) return hit;

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol + ' solana')}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7_000) },
    );
    if (!r.ok) return hit ?? null; // return stale on network error

    const d = await r.json() as {
      pairs?: Array<{
        chainId:    string;
        pairAddress: string;
        baseToken:  { symbol: string };
        quoteToken: { symbol: string };
        priceUsd?:  string;
        priceChange?: { h24?: number };
        volume?:    { h24?: number };
        liquidity?: { usd?: number };
      }>;
    };

    const matching = (d.pairs ?? [])
      .filter(p =>
        p.chainId === 'solana' &&
        p.baseToken.symbol.toUpperCase() === key,
      )
      .sort((a, b) => {
        const score = (p: typeof a) =>
          (p.liquidity?.usd ?? 0) * 0.6 +
          (p.volume?.h24 ?? 0) * 0.3 +
          (p.quoteToken.symbol === 'SOL' ? 40_000 : 0);
        return score(b) - score(a);
      });

    if (!matching.length) return hit ?? null;

    const best = matching[0];
    const info: PairInfo = {
      pairAddress:  best.pairAddress,
      priceUsd:     parseFloat(best.priceUsd ?? '0') || 0,
      change24h:    best.priceChange?.h24 ?? 0,
      volume24h:    best.volume?.h24 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      fetchedAt:    Date.now(),
    };
    _pairCache.set(key, info);
    return info;
  } catch {
    return hit ?? null; // stale on error
  }
}

// ── Build full candle history ─────────────────────────────────────────────────
function buildCandles(price: number, change24h: number, interval: Interval): Candle[] {
  if (price <= 0) return [];
  const n     = CANDLE_COUNT[interval];
  const vol   = VOL_MAP[interval];
  const drift = (change24h / 100) / n;
  const start = price / (1 + change24h / 100);
  const now   = Math.floor(Date.now() / 1000);
  const step  = STEP_SEC[interval];

  const candles: Candle[] = [];
  let cur = start;

  for (let i = 0; i < n; i++) {
    const t     = now - (n - i) * step;
    const chg   = (Math.random() - 0.48) * vol + drift;
    const open  = cur;
    const close = Math.max(cur * (1 + chg), cur * 0.001);
    const wick  = Math.abs(close - open) * (0.3 + Math.random() * 0.7);
    const high  = Math.max(open, close) + wick;
    const low   = Math.max(Math.min(open, close) - wick, cur * 0.001);
    candles.push({ time: t, open, high, low, close, volume: 5_000 + Math.random() * 50_000 });
    cur = close;
  }

  // Pin last close to real price
  if (candles.length) {
    const ratio = price / candles[candles.length - 1].close;
    const adj   = Math.max(1, Math.floor(n * 0.08));
    for (let i = n - adj; i < n; i++) {
      const t = (i - (n - adj)) / adj;
      const f = 1 + (ratio - 1) * t;
      candles[i].open  *= f;
      candles[i].close *= f;
      candles[i].high  *= f;
      candles[i].low   *= f;
    }
    candles[n - 1].close = price;
  }
  return candles;
}

// ── Append one new synthetic candle to existing array ─────────────────────────
// Called every TICK_MS while battle is live.
function appendTick(
  candles: Candle[],
  newPrice: number,
  interval: Interval,
): Candle[] {
  if (!candles.length || newPrice <= 0) return candles;

  const step   = STEP_SEC[interval];
  const vol    = VOL_MAP[interval] * 0.4; // smaller tick volatility
  const last   = candles[candles.length - 1];
  const now    = Math.floor(Date.now() / 1000);

  // If within the current candle's time bucket, extend the current candle
  if (now < last.time + step) {
    const updated = { ...last };
    updated.close = newPrice;
    updated.high  = Math.max(updated.high,  newPrice);
    updated.low   = Math.min(updated.low,   newPrice);
    return [...candles.slice(0, -1), updated];
  }

  // New candle
  const chg   = (Math.random() - 0.48) * vol;
  const open  = last.close;
  const close = newPrice;
  const wick  = Math.abs(close - open) * (0.2 + Math.random() * 0.5);
  const high  = Math.max(open, close) + wick;
  const low   = Math.max(Math.min(open, close) - wick, open * 0.001);

  const newCandle: Candle = {
    time:   now,
    open,
    high,
    low,
    close,
    volume: 3_000 + Math.random() * 20_000,
  };

  // Keep at most CANDLE_COUNT candles
  const maxLen = CANDLE_COUNT[interval];
  return [...candles, newCandle].slice(-maxLen);
}

// ── Tiny price walk for sub-second smoothness ─────────────────────────────────
function walkPrice(price: number, vol: number): number {
  if (price <= 0) return price;
  const factor = 1 + (Math.random() - 0.495) * vol;
  return parseFloat((price * factor).toPrecision(6));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
const TICK_MS   = 5_000;  // append/update candle every 5 s
const REFETCH_MS = 30_000; // re-fetch real price every 30 s

export function useBattleChart(opts: {
  tokenASymbol:    string;
  tokenBSymbol:    string;
  tokenAPrice?:    number;
  tokenBPrice?:    number;
  tokenAChange24h?: number;
  tokenBChange24h?: number;
  isLive?:         boolean; // pass true while battle timer is running
}) {
  const {
    tokenASymbol, tokenBSymbol,
    tokenAPrice = 0, tokenBPrice = 0,
    tokenAChange24h = 0, tokenBChange24h = 0,
    isLive = true,
  } = opts;

  const [interval,    setIntervalState] = useState<Interval>('5m');
  const [activeToken, setActiveToken]   = useState<'A' | 'B'>('A');
  const [data,        setData]          = useState<ChartData>({
    candles: [], priceUsd: 0, change24h: 0, volume24h: 0,
    liquidityUsd: 0, pairAddress: null,
    symbol: tokenASymbol, loading: true, error: null, pricePulse: 0,
  });

  const loadingRef   = useRef(false);
  const livePriceRef = useRef(0);     // latest known price for tick
  const intervalRef  = useRef<Interval>('5m');
  const tokenRef     = useRef<'A' | 'B'>('A');

  const load = useCallback(async (token: 'A' | 'B', iv: Interval, force = false) => {
    if (loadingRef.current && !force) return;
    loadingRef.current = true;

    const symbol  = token === 'A' ? tokenASymbol  : tokenBSymbol;
    const kPrice  = token === 'A' ? tokenAPrice    : tokenBPrice;
    const kChange = token === 'A' ? tokenAChange24h : tokenBChange24h;

    if (!force) {
      setData(p => ({ ...p, loading: true, error: null }));
    }

    try {
      const info  = await fetchPairInfo(symbol, force);
      const price = (info?.priceUsd ?? 0) || kPrice;
      const change = info?.change24h ?? kChange;

      livePriceRef.current = price;

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
        pricePulse:   0,
      });
    } catch {
      setData(p => ({ ...p, loading: false, error: 'Chart load failed' }));
    } finally {
      loadingRef.current = false;
    }
  }, [tokenASymbol, tokenBSymbol, tokenAPrice, tokenBPrice, tokenAChange24h, tokenBChange24h]);

  // Initial load when tokens change
  useEffect(() => {
    intervalRef.current = '5m';
    tokenRef.current    = 'A';
    setIntervalState('5m');
    setActiveToken('A');
    load('A', '5m');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenASymbol, tokenBSymbol]);

  // ── Live tick — runs every TICK_MS while battle is live ───────────────────
  useEffect(() => {
    if (!isLive) return;

    let tickCount = 0;

    const tickId = setInterval(() => {
      tickCount += 1;

      setData(prev => {
        if (prev.loading || !prev.candles.length) return prev;

        // Tiny price walk from last known real price
        const vol      = VOL_MAP[intervalRef.current] * 0.3;
        const newPrice = walkPrice(
          livePriceRef.current > 0 ? livePriceRef.current : prev.priceUsd,
          vol,
        );

        livePriceRef.current = newPrice;

        // Recompute change from start of candle history
        const firstOpen = prev.candles[0]?.open ?? newPrice;
        const liveChange = firstOpen > 0
          ? ((newPrice - firstOpen) / firstOpen) * 100
          : prev.change24h;

        const updatedCandles = appendTick(prev.candles, newPrice, intervalRef.current);

        return {
          ...prev,
          candles:    updatedCandles,
          priceUsd:   newPrice,
          change24h:  liveChange,
          pricePulse: prev.pricePulse + 1,
        };
      });
    }, TICK_MS);

    // Re-fetch real price every REFETCH_MS to stay anchored
    const refetchId = setInterval(async () => {
      const symbol = tokenRef.current === 'A' ? tokenASymbol : tokenBSymbol;
      const info   = await fetchPairInfo(symbol, true);
      if (info && info.priceUsd > 0) {
        livePriceRef.current = info.priceUsd;
        setData(prev => ({
          ...prev,
          // Gently update price — don't jump if walking smoothly
          change24h:    info.change24h,
          volume24h:    info.volume24h,
          liquidityUsd: info.liquidityUsd,
        }));
      }
    }, REFETCH_MS);

    return () => {
      clearInterval(tickId);
      clearInterval(refetchId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, tokenASymbol, tokenBSymbol]);

  const changeInterval = useCallback((iv: Interval) => {
    intervalRef.current = iv;
    setIntervalState(iv);
    load(tokenRef.current, iv);
  }, [load]);

  const changeToken = useCallback((t: 'A' | 'B') => {
    tokenRef.current = t;
    setActiveToken(t);
    load(t, intervalRef.current);
  }, [load]);

  return { data, interval, activeToken, changeInterval, changeToken };
}
