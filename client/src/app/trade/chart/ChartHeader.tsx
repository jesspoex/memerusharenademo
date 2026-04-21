/**
 * components/trade/chart/ChartHeader.tsx
 * Price + stats row above the chart. Matches MemeRush dark/orange theme.
 */
'use client';
import React, { memo } from 'react';
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

interface Props {
  symbol:       string;
  logoUrl?:     string;
  priceUsd:     number;
  change24h:    number;
  volume24h?:   number;
  liquidityUsd?: number;
  loading?:     boolean;
}

export const ChartHeader = memo(function ChartHeader({
  symbol, logoUrl, priceUsd, change24h, volume24h, liquidityUsd, loading,
}: Props) {
  const pos    = change24h >= 0;
  const chCol  = pos ? '#22c55e' : '#f87171';
  const chBg   = pos ? 'rgba(34,197,94,.1)' : 'rgba(248,113,113,.1)';

  if (loading) return (
    <div className="flex items-center justify-between animate-pulse mb-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/8"/>
        <div className="space-y-1.5">
          <div className="h-2.5 w-12 bg-white/8 rounded-full"/>
          <div className="h-4 w-20 bg-white/8 rounded-full"/>
        </div>
      </div>
      <div className="h-5 w-14 bg-white/8 rounded-full"/>
    </div>
  );

  return (
    <div className="flex items-start justify-between mb-1">
      {/* Left: logo + symbol + price */}
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenLogo symbol={symbol} logoUrl={logoUrl} size={32} className="border border-white/10 shrink-0"/>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-slate-400 leading-none tracking-widest uppercase">{symbol}</p>
          <p className="text-xl font-black text-white leading-tight tabular-nums mt-0.5">{fmtPrice(priceUsd)}</p>
          {(volume24h || liquidityUsd) && (
            <div className="flex items-center gap-2 mt-0.5">
              {volume24h    > 0 && <span className="text-[9px] text-slate-600">Vol {fmtK(volume24h)}</span>}
              {liquidityUsd > 0 && <span className="text-[9px] text-slate-600">Liq {fmtK(liquidityUsd)}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Right: 24h change badge */}
      <div
        className="px-2.5 py-1 rounded-xl text-sm font-black tabular-nums shrink-0"
        style={{ background: chBg, color: chCol }}
      >
        {pos ? '+' : ''}{change24h.toFixed(2)}%
      </div>
    </div>
  );
});
