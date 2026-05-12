'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RecentWinner, CFG, sf } from '../constants';

interface Props {
  activities: Activity[];
  recentWinners: RecentWinner[];
}

function actionStyle(action: Activity['action']) {
  if (action === 'won') {
    return { icon: '🏆', label: 'WON', bg: 'rgba(6,78,59,.55)', border: 'rgba(16,185,129,.25)', text: '#34d399', headline: 'Pool claimed' };
  }
  if (action === 'joined') {
    return { icon: '⚔️', label: 'JOINED', bg: 'rgba(30,64,175,.28)', border: 'rgba(59,130,246,.22)', text: '#67e8f9', headline: 'New fighter joined' };
  }
  return { icon: '🔥', label: 'CREATED', bg: 'rgba(120,53,15,.5)', border: 'rgba(249,115,22,.25)', text: '#fb923c', headline: 'Battle created' };
}

function cleanBattleName(battle?: string) {
  if (!battle) return 'Live battle';
  return battle.replace(/\s+/g, ' ').trim();
}

function liveTime(raw?: string, index = 0) {
  if (!raw) return index === 0 ? 'just now' : `${index * 8 + 5}s ago`;
  const value = String(raw).trim().toLowerCase();
  if (value === 'live' || value === 'now' || value === 'just now') return 'just now';
  if (/\d+d\s+ago/.test(value) || /\d+\s+day/.test(value)) return index === 0 ? 'just now' : `${Math.min(index * 9 + 4, 59)}s ago`;
  return raw;
}

export function LiveActivity({ activities, recentWinners }: Props) {
  const latestWinner = recentWinners[0];
  const latestWinKey = useMemo(() => latestWinner ? `${latestWinner.wallet}-${latestWinner.amount}-${latestWinner.battle}-${latestWinner.time}` : '', [latestWinner]);
  const [showLiveWin, setShowLiveWin] = useState(false);

  useEffect(() => {
    if (!latestWinKey) return;
    setShowLiveWin(true);
    const t = setTimeout(() => setShowLiveWin(false), 5200);
    return () => clearTimeout(t);
  }, [latestWinKey]);

  if (activities.length === 0 && recentWinners.length === 0) {
    return (
      <section className="rounded-2xl border border-orange-500/10 p-5 text-center" style={{ background: 'rgba(6,6,18,.97)' }}>
        <p className="text-2xl">🏟️</p>
        <p className="mt-2 text-sm font-black text-white">Arena is waiting for the first legend</p>
        <p className="mt-1 text-xs text-slate-600">Create or join a battle to light up the live feed.</p>
      </section>
    );
  }

  return (
    <>

      {latestWinner && showLiveWin && (
        <div className="fixed left-1/2 top-20 z-[9995] w-[calc(100%-24px)] max-w-[390px] -translate-x-1/2 rounded-2xl border border-emerald-400/25 px-4 py-3 shadow-2xl animate-[mrLiveWinDrop_.42s_cubic-bezier(.2,1.3,.35,1)]" style={{ background: 'linear-gradient(135deg,rgba(6,78,59,.96),rgba(20,10,4,.96))', boxShadow: '0 0 38px rgba(34,197,94,.18)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: 'rgba(250,204,21,.16)', border: '1px solid rgba(250,204,21,.25)' }}>🏆</div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Live win</p>
                <p className="truncate text-xs font-black text-white">Someone just won <span className="text-emerald-300">+{sf(latestWinner.amount, 3)} SOL</span></p>
                <p className="truncate text-[10px] text-slate-400">{latestWinner.battle} · {liveTime(latestWinner.time)}</p>
              </div>
            </div>
            <span className="rounded-full px-2 py-1 text-[8px] font-black text-yellow-300" style={{ background: 'rgba(120,53,15,.45)' }}>CLAIMED</span>
          </div>
        </div>
      )}

      {latestWinner && (
        <section className="rounded-2xl border border-yellow-500/20 overflow-hidden animate-[mrFeedGlow_1.8s_ease-in-out_infinite]" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(250,204,21,.16), rgba(6,6,18,.98) 42%)' }}>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center text-2xl border border-yellow-400/25" style={{ background: 'rgba(120,53,15,.5)' }}>🏆</div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Latest pool claimed</p>
                <p className="text-sm font-black text-white truncate">{latestWinner.wallet} won <span className="text-emerald-400">+{sf(latestWinner.amount, 3)} SOL</span></p>
                <p className="text-[10px] text-slate-500 truncate">{latestWinner.battle} · {liveTime(latestWinner.time)}</p>
              </div>
            </div>
            {latestWinner.txHash && (
              <a href={`${CFG.solscan}/tx/${latestWinner.txHash}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black text-yellow-300 border border-yellow-500/20" style={{ background: 'rgba(120,53,15,.25)' }}>Verify ↗</a>
            )}
          </div>
        </section>
      )}

      {activities.length > 0 && (
        <section className="rounded-2xl border border-white/[.05] overflow-hidden" style={{ background: 'rgba(6,6,18,.97)' }}>
          <div className="px-4 py-3 border-b border-white/[.04] flex items-center justify-between" style={{ background: 'rgba(8,8,20,1)' }}>
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-orange-400 opacity-50 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-orange-400" /></span>
              <span className="font-black text-[11px] text-orange-400 tracking-widest uppercase">Live Arena Feed</span>
            </div>
            <span className="text-[9px] text-slate-600 font-mono">realtime</span>
          </div>

          <div className="divide-y divide-white/[.035]">
            {activities.slice(0, 7).map((a, index) => {
              const st = actionStyle(a.action);
              const amount = a.amount ?? 0;
              const hasTx = Boolean(a.txHash && !a.txHash.startsWith('ARENA') && !a.txHash.startsWith('PENDING'));
              return (
                <div key={a.id} className="group flex items-center justify-between gap-3 px-4 py-3 transition-all" style={{ background: index === 0 ? 'linear-gradient(90deg,rgba(249,115,22,.06),transparent)' : 'transparent' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: st.bg, border: `1px solid ${st.border}` }}>{st.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black shrink-0" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>{st.label}</span>
                        <p className="text-[11px] font-black text-white truncate">{st.headline}</p>
                        {index === 0 && <span className="text-[7px] px-1 rounded-full bg-emerald-500/15 text-emerald-300 font-black">NEW</span>}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500 truncate"><span className="font-mono text-slate-400">{a.user}</span><span className="text-slate-700"> · </span><span>{cleanBattleName(a.battle)}</span></p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {amount > 0 && <p className={`text-sm font-black tabular-nums ${a.action === 'won' ? 'text-emerald-400' : 'text-yellow-400'}`}>{a.action === 'won' ? '+' : ''}{sf(amount, a.action === 'won' ? 3 : 2)} SOL</p>}
                    <div className="flex items-center justify-end gap-1 mt-0.5"><span className="text-[9px] text-slate-600">{liveTime(a.time, index)}</span>{hasTx && <a href={`${CFG.solscan}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-400 hover:text-orange-300">↗</a>}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <style jsx>{`@keyframes mrFeedGlow{0%,100%{box-shadow:0 0 0 rgba(250,204,21,0)}50%{box-shadow:0 0 30px rgba(250,204,21,.12)}}@keyframes mrLiveWinDrop{0%{transform:translate(-50%,-16px) scale(.95);opacity:0}100%{transform:translate(-50%,0) scale(1);opacity:1}}`}</style>
        </section>
      )}

      {recentWinners.length > 1 && (
        <section className="rounded-2xl border border-yellow-500/15 overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(120,53,15,.1),rgba(5,5,14,.98))' }}>
          <div className="px-4 py-2.5 border-b border-yellow-500/[.08] flex items-center justify-between"><span className="font-black text-[10px] text-yellow-400 tracking-widest uppercase">🏆 Winner Streaks</span><span className="text-[9px] text-slate-600">shareable wins</span></div>
          <div className="divide-y divide-yellow-500/[.05]">
            {recentWinners.slice(0, 3).map((w, i) => (
              <div key={`${w.wallet}-${i}`} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0"><span className="text-base flex-shrink-0" style={{ fontSize: '14px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span><div className="min-w-0"><p className="font-mono text-orange-400 text-[11px] font-bold truncate">{w.wallet}</p><p className="text-slate-600 text-[9px] mt-0.5 truncate">{w.battle} · {liveTime(w.time, i)}</p></div></div>
                <div className="text-right shrink-0 ml-3"><p className="text-emerald-400 font-black text-sm tabular-nums">+{sf(w.amount, 3)} SOL</p>{w.txHash && <a href={`${CFG.solscan}/tx/${w.txHash}`} target="_blank" rel="noopener noreferrer" className="text-yellow-700 hover:text-yellow-400 text-[9px] transition-colors">verify ↗</a>}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
