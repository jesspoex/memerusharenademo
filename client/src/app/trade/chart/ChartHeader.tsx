/**
 * components/trade/chart/ChartHeader.tsx
 * Price + stats header above the battle chart.
 *
 * LIVE FEEL (Issue 1 fix):
 * - Accepts `pricePulse` prop (increments on each tick from useBattleChart).
 * - Price flashes briefly with a CSS transition when pricePulse changes.
 * - Small live dot shown when `isLive` is true.
 * - No layout shift. Skeleton has fixed minHeight.
 */
'use client';
import React, { memo, useEffect, useRef, useState } from 'react';
import { TokenLogo } from '../../../hooks/useTokenMeta';

function fmtPrice(p: number): string {
  if (!p) return '$—';
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.001)    return `$${p.toFixed(7)}`;
  if (p < 1)        return `$${p.toFixed(5)}`;
  if (p < 10_000)   return `$${p.toFixed(3)}`;
  return `$${p.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
}

function fmtK(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function Skeleton() {
  return (
    <div className="flex items-start justify-between mb-1 animate-pulse" style={{minHeight:52}}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full shrink-0" style={{background:'rgba(255,255,255,.07)'}}/>
        <div className="space-y-1.5">
          <div className="h-2 w-10 rounded-full" style={{background:'rgba(255,255,255,.07)'}}/>
          <div className="h-5 w-24 rounded-full" style={{background:'rgba(255,255,255,.07)'}}/>
          <div className="h-2 w-16 rounded-full" style={{background:'rgba(255,255,255,.04)'}}/>
        </div>
      </div>
      <div className="h-6 w-16 rounded-xl" style={{background:'rgba(255,255,255,.07)'}}/>
    </div>
  );
}

interface Props {
  symbol:        string;
  logoUrl?:      string;
  priceUsd:      number;
  change24h:     number;
  volume24h?:    number;
  liquidityUsd?: number;
  loading?:      boolean;
  isLive?:       boolean;  // show live dot
  pricePulse?:   number;   // increments on each tick — triggers flash
}

export const ChartHeader = memo(function ChartHeader({
  symbol, logoUrl, priceUsd, change24h,
  volume24h, liquidityUsd, loading,
  isLive = false, pricePulse = 0,
}: Props) {
  const pos   = change24h >= 0;
  const chCol = pos ? '#22c55e' : '#f87171';
  const chBg  = pos ? 'rgba(34,197,94,.1)' : 'rgba(248,113,113,.1)';

  // Flash price text briefly when pricePulse increments
  const [flash, setFlash]  = useState(false);
  const prevPulse          = useRef(pricePulse);
  useEffect(() => {
    if (pricePulse !== prevPulse.current && pricePulse > 0) {
      prevPulse.current = pricePulse;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(t);
    }
  }, [pricePulse]);

  if (loading) return <Skeleton />;

  return (
    <div className="flex items-start justify-between mb-1" style={{minHeight:52}}>
      {/* Left: logo + symbol + price */}
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenLogo
          symbol={symbol}
          logoUrl={logoUrl}
          size={32}
          className="border border-white/10 shrink-0"
        />
        <div className="min-w-0">
          {/* Symbol + live dot */}
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-black text-slate-500 leading-none tracking-[.12em] uppercase">
              {symbol}
            </p>
            {isLive && (
              <span className="relative flex w-1.5 h-1.5 shrink-0">
                <span className="absolute inline-flex w-full h-full rounded-full bg-orange-400 opacity-60 animate-ping"/>
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-orange-400"/>
              </span>
            )}
          </div>

          {/* Price — flashes on tick */}
          <p
            className="text-xl font-black leading-tight tabular-nums mt-0.5 transition-colors duration-300"
            style={{
              color: flash
                ? (pos ? '#4ade80' : '#fb923c')
                : '#ffffff',
            }}
          >
            {fmtPrice(priceUsd)}
          </p>

          {/* Volume / liquidity */}
          {(volume24h || liquidityUsd) ? (
            <div className="flex items-center gap-2.5 mt-0.5">
              {(volume24h ?? 0)    > 0 && (
                <span className="text-[9px] text-slate-600 tabular-nums">
                  Vol&thinsp;{fmtK(volume24h ?? 0)}
                </span>
              )}
              {(liquidityUsd ?? 0) > 0 && (
                <span className="text-[9px] text-slate-600 tabular-nums">
                  Liq&thinsp;{fmtK(liquidityUsd ?? 0)}
                </span>
              )}
            </div>
          ) : (
            <div style={{height:13}}/>
          )}
        </div>
      </div>

      {/* Right: 24h change badge */}
      <span
        className="text-sm font-black px-2.5 py-1 rounded-xl tabular-nums shrink-0 mt-0.5"
        style={{ background: chBg, color: chCol }}
      >
        {pos ? '+' : ''}{change24h.toFixed(2)}%
      </span>
    </div>
  );
});
