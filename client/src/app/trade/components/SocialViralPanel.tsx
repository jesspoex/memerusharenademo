'use client';

import React, { useMemo, useState } from 'react';
import { Battle, LeaderboardEntry, RecentWinner, UserProfile, CFG, sf, sw } from '../constants';

type Variant = 'arena' | 'profile' | 'stats';

interface SocialViralPanelProps {
  variant?: Variant;
  battles?: Battle[];
  recentWinners?: RecentWinner[];
  leaderboard?: LeaderboardEntry[];
  userProfile?: UserProfile | null;
  wallet?: string | null;
}

type Badge = { icon: string; title: string; note: string; color: string };

function calcRank(profile?: UserProfile | null) {
  const wins = profile?.wins ?? 0;
  const joined = profile?.battlesJoined ?? 0;
  const pnl = profile?.totalPnL ?? 0;
  const score = wins * 120 + joined * 18 + Math.max(0, pnl) * 900;
  if (score >= 1200) return { name: 'Arena Legend', icon: '👑', color: '#facc15', score: Math.round(score) };
  if (score >= 650) return { name: 'Pool Hunter', icon: '🏆', color: '#22c55e', score: Math.round(score) };
  if (score >= 250) return { name: 'Battle Degen', icon: '⚔️', color: '#fb923c', score: Math.round(score) };
  if (score >= 80) return { name: 'Rookie Raider', icon: '🔥', color: '#38bdf8', score: Math.round(score) };
  return { name: 'New Fighter', icon: '🛡️', color: '#94a3b8', score: Math.round(score) };
}

function buildBadges(profile?: UserProfile | null): Badge[] {
  const wins = profile?.wins ?? 0;
  const joined = profile?.battlesJoined ?? 0;
  const created = profile?.battlesCreated ?? 0;
  const pnl = profile?.totalPnL ?? 0;
  const total = wins + (profile?.losses ?? 0);
  const winRate = total > 0 ? wins / total : 0;

  const badges: Badge[] = [];
  if (wins > 0) badges.push({ icon: '🏆', title: 'Pool Claimer', note: `${wins} win${wins > 1 ? 's' : ''}`, color: '#22c55e' });
  if (wins >= 3) badges.push({ icon: '🔥', title: 'Win Streaker', note: 'multi-win wallet', color: '#fb923c' });
  if (winRate >= 0.6 && total >= 3) badges.push({ icon: '🎯', title: 'Sharp Picker', note: `${Math.round(winRate * 100)}% win rate`, color: '#38bdf8' });
  if (created > 0) badges.push({ icon: '🛠️', title: 'Battle Maker', note: `${created} created`, color: '#a78bfa' });
  if (joined >= 5) badges.push({ icon: '⚔️', title: 'Arena Regular', note: `${joined} joined`, color: '#facc15' });
  if (pnl > 0) badges.push({ icon: '💰', title: 'Green Wallet', note: `+${sf(pnl, 3)} SOL`, color: '#4ade80' });
  if (badges.length === 0) badges.push({ icon: '🌱', title: 'First Battle Soon', note: 'join to unlock badges', color: '#64748b' });
  return badges.slice(0, 4);
}

function battleScore(b: Battle) {
  const left = Math.max(0, Math.floor(((b.endTime || 0) - Date.now()) / 1000));
  const urgency = left > 0 ? Math.max(0, 600 - left) / 600 : 0;
  const movement = Math.abs(b.tokenAChange ?? 0) + Math.abs(b.tokenBChange ?? 0);
  return (b.players ?? 0) * 3 + (b.totalPool ?? b.amount ?? 0) * 70 + movement * 1.5 + urgency * 5;
}

function useCopyFlash() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return { copied, copy };
}

async function createProfileShareImage(params: {
  wallet?: string | null;
  rankName: string;
  rankIcon: string;
  wins: number;
  winRate: number;
  pnl: number;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const grad = ctx.createLinearGradient(0, 0, 1200, 675);
  grad.addColorStop(0, '#030712');
  grad.addColorStop(.42, '#180803');
  grad.addColorStop(1, '#03120a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 675);

  ctx.fillStyle = 'rgba(249,115,22,.23)';
  ctx.beginPath(); ctx.arc(1020, 120, 310, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(34,197,94,.12)';
  ctx.beginPath(); ctx.arc(170, 560, 260, 0, Math.PI * 2); ctx.fill();

  const rr = (x:number,y:number,w:number,h:number,r:number) => {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  };
  ctx.fillStyle = 'rgba(255,255,255,.075)'; rr(52, 44, 1096, 586, 44); ctx.fill();
  ctx.strokeStyle = 'rgba(249,115,22,.5)'; ctx.lineWidth = 3; ctx.stroke();

  ctx.fillStyle = '#fb923c'; ctx.font = '900 34px system-ui, sans-serif'; ctx.fillText('⚔️ MemeRush Arena Profile', 92, 112);
  ctx.fillStyle = '#fff'; ctx.font = '900 92px system-ui, sans-serif'; ctx.fillText(`${params.rankIcon} ${params.rankName}`, 92, 238);
  ctx.fillStyle = '#94a3b8'; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText(`Wallet: ${params.wallet ? sw(params.wallet) : 'MemeRush Fighter'}`, 98, 292);

  const cards = [
    ['Wins', String(params.wins), '#22c55e'],
    ['Win Rate', `${params.winRate}%`, '#38bdf8'],
    ['Net P&L', `${params.pnl >= 0 ? '+' : ''}${sf(params.pnl, 3)} SOL`, params.pnl >= 0 ? '#4ade80' : '#f87171'],
  ];
  cards.forEach((c, i) => {
    const x = 92 + i * 340;
    ctx.fillStyle = 'rgba(15,23,42,.76)'; rr(x, 352, 300, 128, 28); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = c[2]; ctx.font = '900 42px system-ui, sans-serif'; ctx.fillText(c[1], x + 28, 425);
    ctx.fillStyle = '#94a3b8'; ctx.font = '800 22px system-ui, sans-serif'; ctx.fillText(c[0], x + 28, 460);
  });

  ctx.fillStyle = '#facc15'; ctx.font = '900 32px system-ui, sans-serif'; ctx.fillText('Pick a side. Beat the market. Claim the pool.', 92, 560);
  ctx.fillStyle = '#e2e8f0'; ctx.font = '800 28px system-ui, sans-serif'; ctx.fillText('meemerush.xyz/trade', 840, 560);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'memerush-arena-profile.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'MemeRush profile', text: 'My MemeRush arena profile ⚔️' }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'memerush-arena-profile.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    }
  }, 'image/png');
}

export function SocialViralPanel({
  variant = 'arena',
  battles = [],
  recentWinners = [],
  leaderboard = [],
  userProfile,
  wallet,
}: SocialViralPanelProps) {
  const { copied, copy } = useCopyFlash();
  const rank = useMemo(() => calcRank(userProfile), [userProfile]);
  const badges = useMemo(() => buildBadges(userProfile), [userProfile]);
  const trending = useMemo(() => battles.filter(b => b.status === 'live').sort((a, b) => battleScore(b) - battleScore(a))[0], [battles]);
  const topWinners = useMemo(() => {
    const map = new Map<string, { wallet: string; amount: number; wins: number; battle: string }>();
    recentWinners.forEach(w => {
      const key = w.wallet || 'unknown';
      const old = map.get(key) ?? { wallet: key, amount: 0, wins: 0, battle: w.battle };
      old.amount += w.amount || 0;
      old.wins += 1;
      old.battle = w.battle || old.battle;
      map.set(key, old);
    });
    leaderboard.forEach(l => {
      if (!map.has(l.wallet)) map.set(l.wallet, { wallet: l.wallet, amount: l.earnings || 0, wins: l.wins || 0, battle: 'Leaderboard' });
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount || b.wins - a.wins).slice(0, 3);
  }, [recentWinners, leaderboard]);

  const wins = userProfile?.wins ?? 0;
  const losses = userProfile?.losses ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const pnl = userProfile?.totalPnL ?? 0;
  const streak = wins > 0 ? Math.max(1, Math.min(wins, wins - Math.floor(losses / 2))) : 0;

  const flexText = `My MemeRush arena profile ⚔️\nRank: ${rank.name}\nWins: ${wins}\nWin rate: ${winRate}%\nNet P&L: ${pnl >= 0 ? '+' : ''}${sf(pnl, 4)} SOL\n\nPick a side. Beat the market. Claim the pool.\n${CFG.site}/trade`;

  if (variant === 'profile') {
    return (
      <section className="rounded-2xl border overflow-hidden" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(249,115,22,.16), rgba(8,8,20,.98) 48%)', borderColor: `${rank.color}30` }}>
        <div className="p-4 border-b border-white/[.05] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ background: `${rank.color}18`, border: `1px solid ${rank.color}40` }}>{rank.icon}</div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Arena Rank</p>
              <p className="text-xl font-black truncate" style={{ color: rank.color }}>{rank.name}</p>
              <p className="text-[10px] text-slate-600 font-mono">Score {rank.score} · Streak x{streak}</p>
            </div>
          </div>
          <button onClick={() => copy(flexText)} className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black text-white active:scale-95" style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)' }}>{copied ? 'Copied ✓' : 'Copy Flex'}</button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/[.04]">
          {[{l:'Streak',v:`x${streak}`,c:'#fb923c'},{l:'Rank',v:rank.name.split(' ')[0],c:rank.color},{l:'Winrate',v:`${winRate}%`,c:'#22d3ee'}].map(s=>(
            <div key={s.l} className="p-3 text-center"><p className="font-black text-lg tabular-nums" style={{color:s.c}}>{s.v}</p><p className="text-[9px] text-slate-600 uppercase tracking-wide">{s.l}</p></div>
          ))}
        </div>

        <div className="p-4 grid grid-cols-2 gap-2">
          {badges.map(b => (
            <div key={b.title} className="rounded-xl p-3 border" style={{ background: `${b.color}0d`, borderColor: `${b.color}22` }}>
              <p className="text-lg">{b.icon}</p><p className="text-xs font-black text-white mt-1">{b.title}</p><p className="text-[9px] text-slate-500 mt-0.5">{b.note}</p>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          <button onClick={() => createProfileShareImage({ wallet, rankName: rank.name, rankIcon: rank.icon, wins, winRate, pnl })} className="rounded-xl px-3 py-3 text-xs font-black text-white" style={{ background: 'rgba(15,23,42,.78)', border: '1px solid rgba(255,255,255,.08)' }}>Create Share Card</button>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(flexText)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-3 text-center text-xs font-black text-white" style={{ background: 'rgba(14,165,233,.17)', border: '1px solid rgba(56,189,248,.18)' }}>Share on X</a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-orange-500/10 overflow-hidden" style={{ background: 'linear-gradient(160deg,rgba(20,10,4,.84),rgba(6,6,18,.98))' }}>
      <div className="px-4 py-3 border-b border-white/[.04] flex items-center justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Social Viral Layer</p><p className="text-[10px] text-slate-600 mt-0.5">Ranks, badges, trending battles and realtime winners.</p></div>
        <span className="rounded-full px-2 py-1 text-[8px] font-black text-emerald-300" style={{ background: 'rgba(6,78,59,.24)', border: '1px solid rgba(16,185,129,.22)' }}>LIVE</span>
      </div>

      {trending ? (
        <div className="p-4 border-b border-white/[.04]">
          <div className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.16)' }}>
            <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-orange-400">🔥 Trending Battle</p><p className="text-sm font-black text-white truncate">{trending.tokenA} vs {trending.tokenB}</p><p className="text-[10px] text-slate-500">{trending.players} players · {sf(trending.totalPool || trending.amount, 3)} SOL pool</p></div>
            <span className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black text-yellow-300" style={{ background: 'rgba(120,53,15,.35)' }}>HOT</span>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-white/[.04] text-center"><p className="text-sm font-black text-white">First trending battle starts soon 🔥</p><p className="text-[10px] text-slate-600 mt-1">Create or join a battle to push it into the feed.</p></div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">🏆 Top Winners Realtime</p><p className="text-[9px] text-slate-600">arena legends</p></div>
        {topWinners.length > 0 ? (
          <div className="space-y-2">
            {topWinners.map((w, i) => (
              <div key={`${w.wallet}-${i}`} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: i === 0 ? 'rgba(250,204,21,.08)' : 'rgba(15,23,42,.42)', border: '1px solid rgba(255,255,255,.05)' }}>
                <div className="flex items-center gap-2 min-w-0"><span className="text-lg">{i === 0 ? '👑' : i === 1 ? '🥈' : '🥉'}</span><div className="min-w-0"><p className="font-mono text-[11px] font-black text-white truncate">{w.wallet}</p><p className="text-[9px] text-slate-500 truncate">{w.wins} win{w.wins !== 1 ? 's' : ''} · {w.battle}</p></div></div>
                <p className="text-sm font-black text-emerald-400 tabular-nums">+{sf(w.amount, 3)} SOL</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(15,23,42,.42)', border: '1px dashed rgba(250,204,21,.22)' }}><p className="text-sm font-black text-white">First winner becomes Arena Legend 👑</p><p className="text-[10px] text-slate-600 mt-1">Top winners will appear here in realtime.</p></div>
        )}
      </div>
    </section>
  );
}
