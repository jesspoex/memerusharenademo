'use client';
import React from 'react';
import { Activity, RecentWinner, LeaderboardEntry, DbBattle, sf, fmtN, tAgo, CFG } from '../constants';

interface Props {
  stats:         { players: number; battles: number; vol: number; paid: number };
  activities:    Activity[];
  recentWinners: RecentWinner[];
  leaderboard:   LeaderboardEntry[];
  battleHistory: DbBattle[];
  dbLoaded:      boolean;
  realtimeOk:    boolean;
}

const medal = (rank: number) => rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
const rankBg = (rank: number) => rank === 1 ? 'linear-gradient(135deg,#facc15,#fb923c)' : rank === 2 ? 'linear-gradient(135deg,#cbd5e1,#64748b)' : rank === 3 ? 'linear-gradient(135deg,#fb923c,#9a3412)' : 'rgba(30,41,59,.9)';

export function TradeStats({ stats, activities, recentWinners, leaderboard, battleHistory, dbLoaded, realtimeOk }: Props) {
  const hotActivities = activities.slice(0, 12);
  const topWinners = leaderboard.slice(0, 10);
  const payoutRatio = stats.vol > 0 ? (stats.paid / stats.vol) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Trust banner */}
      <div className="rounded-2xl p-4 border border-orange-500/20" style={{ background: 'radial-gradient(circle at top right,rgba(249,115,22,.16),transparent 35%),rgba(120,53,15,.10)' }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-black text-orange-400 tracking-widest uppercase">Arena Pulse</p>
            <p className="text-xs text-slate-500 mt-0.5">Realtime public stats for trust and social proof.</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black" style={{background:realtimeOk?'rgba(16,185,129,.12)':'rgba(249,115,22,.12)',color:realtimeOk?'#34d399':'#fb923c',border:`1px solid ${realtimeOk?'rgba(16,185,129,.25)':'rgba(249,115,22,.25)'}`}}>{realtimeOk ? '● LIVE' : '● DB SYNC'}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Paid', value: sf(stats.paid, 2) + ' SOL', c: '#34d399', i:'💰' },
            { label: 'Volume', value: sf(stats.vol, 2) + ' SOL', c: '#facc15', i:'📊' },
            { label: 'Battles', value: fmtN(stats.battles), c: '#fb923c', i:'⚔️' },
            { label: 'Players', value: fmtN(stats.players), c: '#38bdf8', i:'👥' },
          ].map(s => (
            <div key={s.label} className="text-center rounded-xl p-2.5 border border-white/[.05]" style={{background:'rgba(18,18,36,.72)'}}>
              <p className="text-base leading-none mb-1">{s.i}</p>
              <p className="font-black text-sm tabular-nums" style={{color:s.c}}>{dbLoaded ? s.value : '—'}</p>
              <p className="text-[8px] text-slate-600 mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform stats */}
      <div className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">📊 Platform Stats <span className="text-xs text-orange-400">{realtimeOk ? '● Live' : '● DB'}</span></h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: 'Total Battles', v: fmtN(stats.battles), c: 'text-orange-400', i: '⚔️' },
            { l: 'SOL Volume', v: sf(stats.vol, 3) + ' SOL', c: 'text-yellow-400', i: '💰' },
            { l: 'Total Payouts', v: sf(stats.paid, 3) + ' SOL', c: 'text-amber-400', i: '🏆' },
            { l: 'Players', v: fmtN(stats.players), c: 'text-emerald-400', i: '👥' },
          ].map(s => (
            <div key={s.l} className="rounded-2xl p-4 text-center border border-white/5" style={{ background: 'rgba(18,18,40,.8)' }}>
              <div className="text-xl mb-1">{s.i}</div>
              <p className={`text-2xl font-black ${s.c}`}>{dbLoaded ? s.v : <span className="animate-pulse text-slate-600">…</span>}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl text-xs border border-white/5" style={{ background: 'rgba(18,18,40,.5)' }}>
            <span className="text-slate-500">Avg prize</span><br/><span className="text-white font-black">{sf(stats.vol / Math.max(stats.battles, 1), 4)} SOL</span>
          </div>
          <div className="p-2.5 rounded-xl text-xs border border-white/5" style={{ background: 'rgba(18,18,40,.5)' }}>
            <span className="text-slate-500">Payout ratio</span><br/><span className="text-emerald-400 font-black">{payoutRatio.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Viral live feed */}
      <section className="rounded-2xl border border-orange-500/12 overflow-hidden" style={{ background: 'rgba(8,8,22,.94)' }}>
        <div className="px-4 py-3 border-b border-white/[.05] flex items-center justify-between">
          <h3 className="font-black text-sm flex items-center gap-2">⚡ Live Arena Feed <span className="text-[10px] text-orange-400">● Live</span></h3>
          <span className="text-[10px] text-slate-600 font-mono">{hotActivities.length} events</span>
        </div>
        {hotActivities.length === 0 ? (
          <div className="text-center py-8"><p className="text-slate-600 text-sm">No activity yet — first battle will appear here.</p></div>
        ) : (
          <div className="divide-y divide-white/[.05]">
            {hotActivities.map((a, idx) => {
              const won = a.action === 'won';
              const joined = a.action === 'joined';
              const icon = won ? '🏆' : joined ? '⚔️' : '🔥';
              const color = won ? '#34d399' : joined ? '#38bdf8' : '#fb923c';
              const actionText = won ? 'WON THE POOL' : joined ? 'JOINED BATTLE' : 'CREATED BATTLE';
              return (
                <div key={a.id} className="p-3 flex items-center gap-3" style={{background:idx===0?'rgba(249,115,22,.055)':'transparent'}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:`${color}18`,border:`1px solid ${color}2b`}}>{icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-black tracking-widest" style={{color}}>{actionText}</span>
                      {idx===0 && <span className="text-[8px] px-1.5 rounded-full text-orange-300 border border-orange-500/20 bg-orange-500/10">NEW</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5"><span className="font-mono text-white/80">{a.user}</span> · {a.battle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {a.amount && <p className="font-black text-sm tabular-nums" style={{color}}>{won ? '+' : ''}{sf(a.amount)} SOL</p>}
                    {a.txHash ? <a href={`${CFG.solscan}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:text-orange-300">verify ↗</a> : <p className="text-[10px] text-slate-700">live</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section className="rounded-2xl p-4 border border-yellow-500/16" style={{ background: 'radial-gradient(circle at top left,rgba(250,204,21,.12),transparent 30%),rgba(120,53,15,.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-sm">🏆 Arena Leaderboard</h3>
          <span className="text-[10px] text-slate-600 font-mono">top winners</span>
        </div>
        <div className="space-y-2">
          {topWinners.length === 0
            ? <div className="text-center py-6 rounded-xl border border-white/[.05]" style={{background:'rgba(18,18,40,.55)'}}><p className="text-slate-600 text-sm">No winners yet — be the first legend! 🏆</p></div>
            : topWinners.map(e => (
              <div key={e.rank} className="flex items-center justify-between p-3 rounded-xl border border-white/5" style={{ background: e.rank === 1 ? 'rgba(250,204,21,.10)' : 'rgba(18,18,45,.8)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0" style={{ background: rankBg(e.rank), color: e.rank <= 3 ? '#070711' : '#e2e8f0' }}>{medal(e.rank)}</div>
                  <div className="min-w-0">
                    <p className="font-mono text-orange-300 text-xs font-bold truncate">{e.wallet}</p>
                    <p className="text-slate-600 text-xs">{e.wins} wins · arena rank</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-emerald-400 text-sm tabular-nums">+{sf(e.earnings, 3)} SOL</p>
                  <p className="text-[9px] text-slate-600">earned</p>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Battle History */}
      <section className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">📜 Battle History <span className="text-xs text-orange-400">● {battleHistory.length} on-chain</span></h3>
        {battleHistory.length === 0
          ? <div className="text-center py-8"><div className="text-4xl mb-3">{dbLoaded ? '⚔️' : '⏳'}</div><p className="text-slate-500 text-sm">{dbLoaded ? 'No battles yet' : 'Loading…'}</p></div>
          : <div className="space-y-2">
            {battleHistory.slice(0, 25).map(b => (
              <div key={b.id} className="p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors" style={{ background: 'rgba(18,18,40,.8)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">{b.token_a} <span className="text-slate-600">vs</span> {b.token_b}</span>
                    {b.status === 'paid' && b.winner && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(16,185,129,.15)', color: '#34d399', border: '1px solid rgba(16,185,129,.2)' }}>🏆 {b.winner}</span>}
                    {b.status === 'live' && <span className="text-xs px-2 py-0.5 rounded-full font-bold animate-pulse" style={{ background: 'rgba(249,115,22,.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,.2)' }}>● LIVE</span>}
                    {b.status === 'ended' && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(234,179,8,.1)', color: '#fbbf24', border: '1px solid rgba(234,179,8,.2)' }}>⏳ Paying…</span>}
                  </div>
                  <span className="text-emerald-400 font-black text-sm shrink-0">{sf(b.prize_pool)} SOL</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
                  <span>by <span className="text-slate-400 font-mono">{b.creator === 'arena' || b.creator === 'system' ? '🤖 Auto' : b.creator.slice(0, 4) + '...' + b.creator.slice(-4)}</span></span>
                  <span className="flex items-center gap-2"><span>{tAgo(b.created_at)}</span>{b.tx_hash && <a href={`${CFG.solscan}/tx/${b.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-400 font-bold">verify ↗</a>}</span>
                </div>
              </div>
            ))}
          </div>}
      </section>

      {/* On-chain proof */}
      <section className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
        <h4 className="font-bold text-sm mb-3">🔗 On-Chain Proof</h4>
        <a href={`${CFG.solscan}/account/${CFG.treasury}`} target="_blank" rel="noopener noreferrer"
          className="p-3 rounded-xl border border-white/5 hover:border-orange-500/30 flex items-start gap-3 transition-colors" style={{ background: 'rgba(18,18,40,.8)' }}>
          <span className="text-emerald-400 text-lg mt-0.5">💸</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white mb-0.5">Treasury Wallet</p>
            <p className="text-slate-500 text-xs truncate">{CFG.treasury}</p>
            <p className="text-orange-500 text-xs mt-0.5">View all fee transactions →</p>
          </div>
        </a>
      </section>
    </div>
  );
}
