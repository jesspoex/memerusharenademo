'use client';
import React from 'react';
import { Battle, Activity, RecentWinner, LeaderboardEntry, DbBattle, DbStats, sf, fmtN, tAgo, CFG } from '../constants';

interface Props {
  stats:         { players: number; battles: number; vol: number; paid: number };
  activities:    Activity[];
  recentWinners: RecentWinner[];
  leaderboard:   LeaderboardEntry[];
  battleHistory: DbBattle[];
  dbLoaded:      boolean;
  realtimeOk:    boolean;
}

export function TradeStats({ stats, activities, recentWinners, leaderboard, battleHistory, dbLoaded, realtimeOk }: Props) {
  return (
    <div className="space-y-5">
      {/* Trust banner */}
      <div className="rounded-2xl p-4 border border-orange-500/20 flex flex-wrap items-center justify-between gap-4" style={{ background: 'rgba(120,53,15,.1)' }}>
        {[
          { label: '💰 Total Paid Out', value: sf(stats.paid, 2) + ' SOL', c: 'text-emerald-400' },
          { label: '📊 Total Volume',   value: sf(stats.vol, 2) + ' SOL',  c: 'text-yellow-400' },
          { label: '⚔️ Battles Played', value: fmtN(stats.battles),        c: 'text-orange-400' },
          { label: '👥 Players',        value: fmtN(stats.players),        c: 'text-amber-400'  },
        ].map(s => (
          <div key={s.label} className="text-center flex-1 min-w-[80px]">
            <p className="text-slate-400 text-xs font-semibold mb-0.5">{s.label}</p>
            <p className={`font-black text-xl ${s.c}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Platform stats */}
      <div className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          📊 Platform Stats
          <span className="text-xs text-orange-400">{realtimeOk ? '● Live' : '● DB'}</span>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: 'Total Battles', v: fmtN(stats.battles), c: 'text-orange-400', i: '⚔️' },
            { l: 'SOL Volume',    v: sf(stats.vol, 3) + ' SOL', c: 'text-yellow-400', i: '💰' },
            { l: 'Total Payouts', v: sf(stats.paid, 3) + ' SOL', c: 'text-amber-400', i: '🏆' },
            { l: 'Players',       v: fmtN(stats.players), c: 'text-emerald-400', i: '👥' },
          ].map(s => (
            <div key={s.l} className="rounded-2xl p-4 text-center border border-white/5" style={{ background: 'rgba(18,18,40,.8)' }}>
              <div className="text-xl mb-1">{s.i}</div>
              <p className={`text-2xl font-black ${s.c}`}>{dbLoaded ? s.v : <span className="animate-pulse text-slate-600">…</span>}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
        {stats.battles > 0 && (
          <div className="mt-3 p-2.5 rounded-xl text-xs text-center border border-white/5" style={{ background: 'rgba(18,18,40,.5)' }}>
            Avg prize: <span className="text-white font-bold">{sf(stats.vol / Math.max(stats.battles, 1), 4)} SOL</span>
            {' · '}Payout ratio: <span className="text-emerald-400 font-bold">{stats.vol > 0 ? ((stats.paid / stats.vol) * 100).toFixed(1) : 0}%</span>
          </div>
        )}
      </div>

      {/* Live Activity */}
      {activities.length > 0 && (
        <section className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">⚡ Live Activity <span className="text-xs text-orange-400">● Live</span></h3>
          <div className="space-y-2">
            {activities.slice(0, 10).map(a => (
              <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${a.action === 'won' ? 'text-emerald-400' : a.action === 'created' ? 'text-orange-400' : 'text-amber-400'}`}
                    style={{ background: a.action === 'won' ? 'rgba(16,185,129,.15)' : a.action === 'created' ? 'rgba(249,115,22,.15)' : 'rgba(251,191,36,.15)' }}>
                    {a.action}
                  </span>
                  <span className="text-slate-400 text-xs truncate">{a.user} · {a.battle}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {a.amount && <span className={`text-xs font-bold ${a.action === 'won' ? 'text-emerald-400' : 'text-yellow-400'}`}>{a.action === 'won' ? '+' : ''}{sf(a.amount)} SOL</span>}
                  {a.txHash && <a href={`${CFG.solscan}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="text-orange-700 hover:text-orange-400 text-xs">↗</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section className="rounded-2xl p-4 border border-yellow-500/12" style={{ background: 'rgba(120,53,15,.08)' }}>
        <h3 className="font-bold text-sm mb-3">🏆 Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.length === 0
            ? <p className="text-slate-600 text-sm text-center py-4">No winners yet — be the first! 🏆</p>
            : leaderboard.map(e => (
              <div key={e.rank} className="flex items-center justify-between p-3 rounded-xl border border-white/5" style={{ background: 'rgba(18,18,45,.8)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" style={{ background: e.rank === 1 ? '#fbbf24' : e.rank === 2 ? '#94a3b8' : '#fb923c', color: '#000' }}>{e.rank}</div>
                  <div>
                    <p className="font-mono text-orange-400 text-xs font-bold">{e.wallet}</p>
                    <p className="text-slate-600 text-xs">{e.wins} wins</p>
                  </div>
                </div>
                <p className="font-black text-emerald-400 text-sm">+{sf(e.earnings, 3)} SOL</p>
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
        <div className="grid grid-cols-1 gap-3">
          <a href={`${CFG.solscan}/account/${CFG.treasury}`} target="_blank" rel="noopener noreferrer"
            className="p-3 rounded-xl border border-white/5 hover:border-orange-500/30 flex items-start gap-3 transition-colors" style={{ background: 'rgba(18,18,40,.8)' }}>
            <span className="text-emerald-400 text-lg mt-0.5">💸</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white mb-0.5">Treasury Wallet</p>
              <p className="text-slate-500 text-xs truncate">{CFG.treasury}</p>
              <p className="text-orange-500 text-xs mt-0.5">View all fee transactions →</p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
