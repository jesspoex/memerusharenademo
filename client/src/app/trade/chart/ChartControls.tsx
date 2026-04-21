/**
 * components/trade/chart/ChartControls.tsx
 * Token A/B toggle + interval selector. Step 4: sharper tap targets.
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
    <div className="flex items-center justify-between py-1">

      {/* Token A / B toggle — min 44px tap height for mobile */}
      <div className="flex rounded-xl overflow-hidden border border-white/[.06]"
        style={{ background: 'rgba(12,8,2,.9)' }}>
        {(['A', 'B'] as const).map(t => (
          <button
            key={t}
            onClick={() => !disabled && onToken(t)}
            className="px-4 text-[11px] font-black transition-all"
            style={{
              minHeight: 36,
              background: activeToken === t
                ? 'linear-gradient(135deg,#ea580c,#f97316)'
                : 'transparent',
              color: activeToken === t ? '#fff' : 'rgba(100,116,139,1)',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {t === 'A' ? tokenASymbol : tokenBSymbol}
          </button>
        ))}
      </div>

      {/* Interval pills */}
      <div className="flex items-center gap-0.5">
        {INTERVALS.map(iv => {
          const active = interval === iv;
          return (
            <button
              key={iv}
              onClick={() => !disabled && onInterval(iv)}
              className="rounded-lg text-[10px] font-black transition-all"
              style={{
                minHeight: 32,
                padding: '0 8px',
                background: active ? 'rgba(249,115,22,.16)' : 'transparent',
                color:      active ? '#f97316'              : 'rgba(71,85,105,1)',
                opacity:    disabled ? 0.5 : 1,
              }}
            >
              {iv.toUpperCase()}
            </button>
          );
        })}
      </div>

    </div>
  );
});
