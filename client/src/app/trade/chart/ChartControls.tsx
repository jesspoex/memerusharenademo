/**
 * components/trade/chart/ChartControls.tsx
 * Token toggle (A/B) + interval selector row. MemeRush orange theme.
 */
'use client';
import React, { memo } from 'react';
import type { Interval } from '../../../hooks/useBattleChart';

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h'];

interface Props {
  interval:     Interval;
  onInterval:   (i: Interval) => void;
  activeToken:  'A' | 'B';
  onToken:      (t: 'A' | 'B') => void;
  tokenASymbol: string;
  tokenBSymbol: string;
  disabled?:    boolean;
}

export const ChartControls = memo(function ChartControls({
  interval, onInterval, activeToken, onToken,
  tokenASymbol, tokenBSymbol, disabled,
}: Props) {
  return (
    <div className="flex items-center justify-between mt-2 mb-1">

      {/* Token A / B toggle */}
      <div className="flex rounded-lg overflow-hidden border border-white/[.07]" style={{ background: 'rgba(18,12,4,.9)' }}>
        {(['A', 'B'] as const).map(t => (
          <button
            key={t}
            onClick={() => !disabled && onToken(t)}
            className="px-3 py-1.5 text-[11px] font-black transition-all"
            style={{
              background: activeToken === t ? 'linear-gradient(135deg,#ea580c,#f97316)' : 'transparent',
              color:      activeToken === t ? '#fff' : 'rgba(100,116,139,1)',
            }}
          >
            {t === 'A' ? tokenASymbol : tokenBSymbol}
          </button>
        ))}
      </div>

      {/* Interval pills */}
      <div className="flex items-center gap-0.5">
        {INTERVALS.map(iv => (
          <button
            key={iv}
            onClick={() => !disabled && onInterval(iv)}
            className="px-2 py-1 text-[10px] font-black rounded-lg transition-all"
            style={{
              background: interval === iv ? 'rgba(249,115,22,.18)' : 'transparent',
              color:      interval === iv ? '#f97316'              : 'rgba(71,85,105,1)',
            }}
          >
            {iv.toUpperCase()}
          </button>
        ))}
      </div>

    </div>
  );
});
