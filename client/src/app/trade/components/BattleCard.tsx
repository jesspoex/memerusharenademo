'use client';
import React from 'react';
import { Battle, Token, CFG, sf, fmtT } from '../constants';

interface Props {
  battle:   Battle;
  tokens:   Token[];
  glFn:     (sym: string) => string;
  onClick:  () => void;
}

export function BattleCard({ battle, tokens, glFn, onClick }: Props) {
  const aL     = battle.chartA[battle.chartA.length - 1] ?? 0;
  const bL     = battle.chartB[battle.chartB.length - 1] ?? 0;
  const leadA  = aL >= bL;
  const tl     = Math.max(0, Math.floor((battle.endTime - Date.now()) / 1000));
  const ending = tl < 20;
  const isReal = (battle.mode ?? 'arena') === 'real';
  const isHot  = battle.players >= 3 || isReal;
  const pct    = Math.min(100, Math.max(0, ((battle.duration - tl) / battle.duration) * 100));

  const fmt = (p: number) => p <= 0 ? '' : p < 0.001 ? `$${p.toFixed(6)}` : p < 1 ? `$${p.toFixed(4)}` : `$${p.toFixed(2)}`;
  const pA  = tokens.find(t => t.symbol === battle.tokenA)?.price ?? 0;
  const pB  = tokens.find(t => t.symbol === battle.tokenB)?.price ?? 0;

  const pctA  = Math.round((battle.chartA.filter(v => v >= 0).length / Math.max(battle.chartA.length, 1)) * 100);
  const pctB  = 100 - pctA;

  const ph = (s: string) => `https://ui-avatars.com/api/?name=${s}&background=ea580c&color=fff&size=40`;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden transition-all hover:scale-[1.005] active:scale-[.99] cursor-pointer"
      style={{
        background: isReal ? 'linear-gradient(180deg,rgba(20,8,2,.99),rgba(8,4,1,.99))' : 'linear-gradient(180deg,rgba(10,10,22,.99),rgba(5,5,14,.99))',
        border: `1px solid ${ending ? 'rgba(239,68,68,.45)' : isReal ? 'rgba(249,115,22,.22)' : 'rgba(30,41,59,.55)'}`,
        boxShadow: isReal ? '0 4px 24px rgba(249,115,22,.1)' : 'none',
      }}
    >
      {/* Top accent */}
      <div className="h-[1.5px]" style={{ background: ending ? 'linear-gradient(90deg,transparent,#ef4444,transparent)' : isReal ? 'linear-gradient(90deg,transparent,#f97316,transparent)' : 'linear-gradient(90deg,transparent,rgba(71,85,105,.4),transparent)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ background: ending ? '#ef4444' : '#f97316' }} />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: ending ? '#ef4444' : '#f97316' }} />
          </span>
          {isReal && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(120,53,15,.55)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.25)' }}>💰 REAL</span>}
          {!isReal && isHot && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(154,52,18,.5)', color: '#f97316', border: '1px solid rgba(249,115,22,.3)' }}>🔥 HOT</span>}
          {!isReal && !isHot && <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(30,41,59,.5)', color: 'rgba(71,85,105,1)' }}>AUTO</span>}
          <span className="text-[9px] text-slate-600">· {battle.players} in</span>
        </div>
        <span className={`font-mono font-black text-sm tabular-nums px-2 py-0.5 rounded-lg ${ending ? 'text-red-400 animate-pulse' : ''}`}
          style={{ color: ending ? '#f87171' : '#fb923c', background: ending ? 'rgba(239,68,68,.1)' : 'rgba(30,15,5,.6)' }}>
          {fmtT(tl)}
        </span>
      </div>

      {/* VS layout */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-2.5 items-stretch">
        {/* Token A */}
        <div className={`rounded-xl p-3 flex flex-col gap-2 border transition-all ${leadA ? 'border-orange-500/35' : 'border-white/5'}`}
          style={{ background: leadA ? 'rgba(249,115,22,.07)' : 'rgba(255,255,255,.02)' }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <img src={glFn(battle.tokenA)} alt={battle.tokenA} className={`w-10 h-10 rounded-full border-2 transition-all ${leadA ? 'border-orange-400/50' : 'border-white/10'}`} onError={e => (e.target as HTMLImageElement).src = ph(battle.tokenA)} />
              {leadA && <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[7px] font-black text-black">▲</div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-white text-sm leading-none truncate">{battle.tokenA}</p>
              <p className={`text-xs font-black mt-0.5 tabular-nums ${aL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{aL >= 0 ? '+' : ''}{aL.toFixed(2)}%</p>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onClick(); }} className="w-full py-2 rounded-lg text-xs font-black text-white transition-all active:scale-95"
            style={{ background: leadA ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#1c0e06,#292010)', boxShadow: leadA ? '0 2px 10px rgba(5,150,105,.3)' : 'none' }}>
            {leadA ? '✅' : '📈'} BUY {battle.tokenA}
          </button>
          <div className="flex items-center gap-1">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctA}%`, background: leadA ? '#10b981' : 'rgba(249,115,22,.3)' }} />
            </div>
            <span className="text-[9px] font-black text-slate-500 w-6 text-right tabular-nums">{pctA}%</span>
          </div>
        </div>

        {/* VS + prices */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 cursor-pointer" onClick={onClick}>
          <div className="w-8 h-8 rounded-full border border-white/8 flex items-center justify-center text-[9px] font-black text-slate-500" style={{ background: 'rgba(30,41,59,.5)' }}>vs</div>
          {Math.abs(aL - bL) > 0.01 && (
            <span className={`text-[8px] font-black tabular-nums ${leadA ? 'text-emerald-500' : 'text-orange-400'}`}>
              {Math.abs(aL - bL).toFixed(2)}%
            </span>
          )}
          {(pA > 0 || pB > 0) && (
            <div className="mt-0.5 text-center space-y-0.5 leading-none">
              {pA > 0 && <p className="text-[7px] tabular-nums" style={{ color: 'rgba(100,116,139,.55)' }}>{fmt(pA)}</p>}
              {pB > 0 && <p className="text-[7px] tabular-nums" style={{ color: 'rgba(100,116,139,.55)' }}>{fmt(pB)}</p>}
            </div>
          )}
        </div>

        {/* Token B */}
        <div className={`rounded-xl p-3 flex flex-col gap-2 border transition-all ${!leadA ? 'border-orange-500/35' : 'border-white/5'}`}
          style={{ background: !leadA ? 'rgba(249,115,22,.07)' : 'rgba(255,255,255,.02)' }}>
          <div className="flex items-center gap-2 flex-row-reverse">
            <div className="relative flex-shrink-0">
              <img src={glFn(battle.tokenB)} alt={battle.tokenB} className={`w-10 h-10 rounded-full border-2 transition-all ${!leadA ? 'border-orange-400/50' : 'border-white/10'}`} onError={e => (e.target as HTMLImageElement).src = ph(battle.tokenB)} />
              {!leadA && <div className="absolute -top-1 -left-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[7px] font-black text-black">▲</div>}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="font-black text-white text-sm leading-none truncate">{battle.tokenB}</p>
              <p className={`text-xs font-black mt-0.5 tabular-nums ${bL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{bL >= 0 ? '+' : ''}{bL.toFixed(2)}%</p>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onClick(); }} className="w-full py-2 rounded-lg text-xs font-black text-white transition-all active:scale-95"
            style={{ background: !leadA ? 'linear-gradient(135deg,#c2410c,#9a3412)' : 'linear-gradient(135deg,#1c0e06,#292010)', boxShadow: !leadA ? '0 2px 10px rgba(249,115,22,.3)' : 'none' }}>
            {!leadA ? '✅' : '📈'} BUY {battle.tokenB}
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-black text-slate-500 w-6 tabular-nums">{pctB}%</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctB}%`, background: !leadA ? '#f97316' : 'rgba(249,115,22,.3)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-3 mb-2 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,.5)' }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{
          width: `${pct}%`,
          background: ending ? 'linear-gradient(90deg,#ef4444,#f97316)' : pct > 70 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'linear-gradient(90deg,#f97316,#fbbf24)',
        }} />
      </div>
    </div>
  );
}
