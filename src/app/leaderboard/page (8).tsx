'use client';
// src/app/leaderboard/page.tsx
import { useState } from 'react';
import { MOCK_LEADERBOARD, MOCK_PAST_BATTLES } from '@/lib/mock';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'players' | 'battles'>('players');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pb-16">

      {/* Banner */}
      <div className="py-2 px-4 text-center" style={{ background: 'linear-gradient(90deg,rgba(6,78,59,.9),rgba(6,95,70,.9))', borderBottom: '1px solid rgba(16,185,129,.2)' }}>
        <p className="text-xs text-emerald-200 font-medium">🏆 Meme Battle Arena — Hackathon Demo · Mock Data</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              🏆 Leaderboard
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Top players by wins & earnings (mock data)</p>
          </div>
          <a href="/battle" className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            ⚔️ Battle Arena
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(18,18,40,.8)' }}>
          {(['players', 'battles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize"
              style={{
                background: tab === t ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'transparent',
                color: tab === t ? 'white' : 'rgba(100,116,139,1)',
              }}>
              {t === 'players' ? '👥 Players' : '📜 Battle History'}
            </button>
          ))}
        </div>

        {/* Players Tab */}
        {tab === 'players' && (
          <div className="space-y-3">
            {/* Top 3 podium */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {MOCK_LEADERBOARD.slice(0, 3).map((e, i) => {
                const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd visually
                const entry = MOCK_LEADERBOARD[podiumOrder[i]];
                const colors = ['#94a3b8', '#fbbf24', '#fb923c'];
                const sizes  = ['h-20', 'h-28', 'h-16'];
                return (
                  <div key={entry.rank} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-black"
                      style={{ background: colors[i] }}>
                      {podiumOrder[i] === 0 ? '🥇' : podiumOrder[i] === 1 ? '🥈' : '🥉'}
                    </div>
                    <p className="font-mono text-xs font-bold text-white">{entry.wallet}</p>
                    <p className="text-emerald-400 font-black text-sm">+{entry.totalEarned} SOL</p>
                    <div className={`w-full rounded-t-xl flex items-end justify-center pb-2 ${sizes[i]}`}
                      style={{ background: `${colors[i]}22`, border: `1px solid ${colors[i]}44` }}>
                      <span className="text-xs font-bold" style={{ color: colors[i] }}>#{entry.rank}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Full list */}
            <div className="rounded-2xl overflow-hidden border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
              {/* Header row */}
              <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-xs font-bold text-slate-500 border-b border-white/5">
                <span>Rank</span>
                <span className="col-span-2">Wallet</span>
                <span className="text-center">Wins</span>
                <span className="text-right">Earned</span>
              </div>

              {MOCK_LEADERBOARD.map((e) => {
                const medalColor = e.rank === 1 ? '#fbbf24' : e.rank === 2 ? '#94a3b8' : e.rank === 3 ? '#fb923c' : '#475569';
                return (
                  <div key={e.rank}
                    className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-black"
                      style={{ background: medalColor }}>
                      {e.rank}
                    </div>
                    <div className="col-span-2">
                      <p className="font-mono text-cyan-400 text-xs font-bold">{e.wallet}</p>
                      {e.winStreak > 0 && (
                        <p className="text-orange-400 text-xs">🔥 {e.winStreak} win streak</p>
                      )}
                    </div>
                    <p className="text-center font-black text-white">{e.wins}</p>
                    <p className="text-right text-emerald-400 font-black text-sm">+{e.totalEarned}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-slate-600 text-xs">Mock data for demo purposes only</p>
          </div>
        )}

        {/* Battle History Tab */}
        {tab === 'battles' && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
              {MOCK_PAST_BATTLES.map((b, i) => (
                <div key={i} className="p-4 border-b border-white/5 last:border-0 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-sm">
                      <span className="text-cyan-400">{b.tokenA}</span>
                      <span className="text-slate-500 mx-2">vs</span>
                      <span className="text-pink-400">{b.tokenB}</span>
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">{b.endedAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-400 text-sm">🏆 {b.winner}</p>
                    <p className="text-yellow-400 text-xs">{b.prizePool} SOL prize</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-4 border border-white/5 text-center" style={{ background: 'rgba(8,8,22,.9)' }}>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { l: 'Total Battles', v: '127', c: 'text-purple-400' },
                  { l: 'SOL Volume',    v: '48.2',   c: 'text-yellow-400' },
                  { l: 'Players',       v: '312',    c: 'text-emerald-400' },
                ].map(s => (
                  <div key={s.l}>
                    <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
              <p className="text-slate-600 text-xs mt-3">All numbers are mock/simulated</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
