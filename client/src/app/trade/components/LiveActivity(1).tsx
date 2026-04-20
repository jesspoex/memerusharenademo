'use client';
import React from 'react';
import { Activity, RecentWinner, CFG, sf } from '../constants';

interface Props {
  activities:    Activity[];
  recentWinners: RecentWinner[];
}

export function LiveActivity({ activities, recentWinners }: Props) {
  if (activities.length === 0 && recentWinners.length === 0) return null;

  return (
    <>
      {/* Live Activity feed */}
      {activities.length > 0 && (
        <section className="rounded-2xl border border-white/[.04] overflow-hidden" style={{ background: 'rgba(6,6,18,.97)' }}>
          <div className="px-4 py-2.5 border-b border-white/[.04] flex items-center justify-between" style={{ background: 'rgba(8,8,20,1)' }}>
            <div className="flex items-center gap-2">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-orange-400 opacity-50 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-orange-400" />
              </span>
              <span className="font-black text-[10px] text-orange-400 tracking-widest uppercase">Live Activity</span>
            </div>
            <span className="text-[9px] text-slate-700 font-mono">on-chain</span>
          </div>
          <div className="divide-y divide-white/[.03]">
            {activities.slice(0, 5).map(a => (
              <div key={a.id} className="flex justify-between items-center px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black shrink-0 ${a.action === 'won' ? 'text-emerald-300' : a.action === 'created' ? 'text-orange-300' : 'text-amber-300'}`}
                    style={{ background: a.action === 'won' ? 'rgba(6,78,59,.5)' : a.action === 'created' ? 'rgba(120,53,15,.5)' : 'rgba(120,80,15,.35)', border: `1px solid ${a.action === 'won' ? 'rgba(16,185,129,.2)' : 'rgba(249,115,22,.25)'}` }}>
                    {a.action.toUpperCase()}
                  </span>
                  <span className="text-slate-500 text-[10px] font-mono truncate">{a.user}</span>
                  {a.battle && <span className="text-slate-700 text-[9px] truncate hidden sm:block">· {a.battle}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.amount && <span className={`text-xs font-black tabular-nums ${a.action === 'won' ? 'text-emerald-400' : 'text-yellow-400'}`}>{a.action === 'won' ? '+' : ''}{sf(a.amount)} SOL</span>}
                  {a.txHash && <a href={`${CFG.solscan}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:text-orange-400 text-[10px] transition-colors">↗</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Winners */}
      {recentWinners.length > 0 && (
        <section className="rounded-2xl border border-yellow-500/15 overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(120,53,15,.1),rgba(5,5,14,.98))' }}>
          <div className="px-4 py-2.5 border-b border-yellow-500/[.08]">
            <span className="font-black text-[10px] text-yellow-400 tracking-widest uppercase">🏆 Recent Winners</span>
          </div>
          <div className="divide-y divide-yellow-500/[.05]">
            {recentWinners.slice(0, 3).map((w, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base flex-shrink-0" style={{ fontSize: '14px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <div className="min-w-0">
                    <p className="font-mono text-orange-400 text-[11px] font-bold truncate">{w.wallet}</p>
                    <p className="text-slate-600 text-[9px] mt-0.5 truncate">{w.battle} · {w.time}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-emerald-400 font-black text-sm tabular-nums">+{sf(w.amount, 3)} SOL</p>
                  {w.txHash && <a href={`${CFG.solscan}/tx/${w.txHash}`} target="_blank" rel="noopener noreferrer" className="text-yellow-700 hover:text-yellow-400 text-[9px] transition-colors">verify ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
