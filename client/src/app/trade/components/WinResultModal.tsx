'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CFG, sf, sw } from '../constants';

interface WinResultModalProps {
  open: boolean;
  amount: number;
  battle: string;
  winnerToken: string;
  pickedToken?: string | null;
  txHash?: string;
  wallet?: string;
  battleId?: string;
  isReal?: boolean;
  onClose: () => void;
}

function buildShareText(amount: number, battle: string, winnerToken: string, isReal?: boolean, streak = 1, battleUrl = `${CFG.site}/trade`) {
  const payoutText = isReal ? `${sf(amount, 4)} SOL` : 'arena points';
  const rankText = streak >= 5 ? 'Arena Legend 👑' : streak >= 3 ? 'Hot Streak 🔥' : 'Pool Hunter ⚔️';
  return `I just claimed the pool on MemeRush 🏆\n\n+${payoutText} from ${battle}\nWinner: ${winnerToken}\nRank: ${rankText} · Streak x${streak}\n\nPick a side. Beat the market. Claim the pool.\n${battleUrl}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function useAnimatedNumber(target: number, enabled: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) { setValue(0); return; }
    let raf = 0;
    const start = performance.now();
    const duration = 1350;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return value;
}

function useWinStreak(open: boolean, battle: string) {
  const [streak, setStreak] = useState(1);
  const seenRef = useRef('');
  useEffect(() => {
    if (!open || !battle || seenRef.current === battle) return;
    seenRef.current = battle;
    try {
      const lastDay = localStorage.getItem('mr_last_win_day');
      const today = new Date().toISOString().slice(0, 10);
      const old = parseInt(localStorage.getItem('mr_win_streak') || '0', 10) || 0;
      const next = lastDay === today ? Math.max(1, old + 1) : 1;
      localStorage.setItem('mr_win_streak', String(next));
      localStorage.setItem('mr_last_win_day', today);
      setStreak(next);
    } catch { setStreak(1); }
  }, [open, battle]);
  return streak;
}

export function WinResultModal({
  open,
  amount,
  battle,
  winnerToken,
  pickedToken,
  txHash,
  wallet,
  battleId,
  isReal = true,
  onClose,
}: WinResultModalProps) {
  const [copied, setCopied] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [makingImage, setMakingImage] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const streak = useWinStreak(open, battle);
  const animatedAmount = useAnimatedNumber(amount, open && revealDone);

  useEffect(() => {
    if (!open) { setRevealDone(false); return; }
    const t = setTimeout(() => setRevealDone(true), 780);
    return () => clearTimeout(t);
  }, [open, battle]);

  const battleUrl = useMemo(() => {
    const ref = wallet ? `&ref=${encodeURIComponent(wallet)}` : '';
    return battleId ? `${CFG.site}/trade?battle=${encodeURIComponent(battleId)}${ref}` : `${CFG.site}/trade${wallet ? `?ref=${encodeURIComponent(wallet)}` : ''}`;
  }, [battleId, wallet]);
  const shareText = useMemo(() => buildShareText(amount, battle, winnerToken, isReal, streak, battleUrl), [amount, battle, winnerToken, isReal, streak, battleUrl]);
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const shortTx = txHash && !txHash.startsWith('PENDING') && !txHash.startsWith('ARENA') ? `${txHash.slice(0, 8)}…${txHash.slice(-6)}` : '';
  const payoutLabel = isReal ? 'SOL POOL CLAIMED' : 'ARENA RESULT';
  const rankLabel = streak >= 5 ? 'Arena Legend' : streak >= 3 ? 'Hot Streak' : 'Pool Hunter';

  const rematch = () => {
    try { window.location.href = `${CFG.site}/trade`; } catch { window.location.href = '/trade'; }
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const makeResultImage = async () => {
    try {
      setMakingImage(true);
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 675;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const grd = ctx.createLinearGradient(0, 0, 1200, 675);
      grd.addColorStop(0, '#020617');
      grd.addColorStop(0.36, '#190803');
      grd.addColorStop(0.68, '#261004');
      grd.addColorStop(1, '#03120a');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 1200, 675);

      ctx.fillStyle = 'rgba(249,115,22,.32)';
      ctx.beginPath(); ctx.arc(1000, 110, 330, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(34,197,94,.20)';
      ctx.beginPath(); ctx.arc(170, 590, 270, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(250,204,21,.16)';
      ctx.beginPath(); ctx.arc(590, 340, 280, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.078)';
      roundedRect(ctx, 48, 42, 1104, 590, 44); ctx.fill();
      ctx.strokeStyle = 'rgba(250,204,21,.62)';
      ctx.lineWidth = 4; ctx.stroke();

      ctx.fillStyle = '#fb923c';
      ctx.font = '900 34px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('⚔️ MemeRush', 88, 103);

      ctx.fillStyle = '#facc15';
      ctx.font = '900 52px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('🏆 YOU WON THE POOL', 88, 185);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 112px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`+${sf(amount, 4)} SOL`, 88, 315);

      ctx.fillStyle = '#22c55e';
      ctx.font = '900 34px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`${rankLabel}  •  Streak x${streak}`, 92, 374);

      ctx.fillStyle = '#facc15';
      ctx.font = '900 36px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`${battle}`, 92, 430);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 28px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`Winner: ${winnerToken}  •  Pick: ${pickedToken || winnerToken}  •  ${wallet ? sw(wallet) : 'MemeRush Fighter'}`, 92, 477);

      ctx.fillStyle = 'rgba(15,23,42,.82)';
      roundedRect(ctx, 88, 520, 1024, 78, 28); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = 2; ctx.stroke();

      ctx.fillStyle = '#fb923c';
      ctx.font = '900 27px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('Pick a side. Beat the market. Claim the pool.', 122, 570);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '800 26px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(battleUrl.replace('https://', '').replace('http://', '').slice(0, 28), 800, 570);

      canvas.toBlob(async (blob) => {
        setMakingImage(false);
        if (!blob) return;
        const file = new File([blob], 'memerush-you-won-the-pool.png', { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
        if (nav.canShare?.({ files: [file] }) && navigator.share) {
          await navigator.share({ files: [file], title: 'MemeRush win', text: shareText }).catch(() => {});
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'memerush-you-won-the-pool.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1200);
        }
        setImageReady(true);
        setTimeout(() => setImageReady(false), 1800);
      }, 'image/png');
    } catch {
      setMakingImage(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center px-4 bg-black/90 backdrop-blur-xl animate-[mrScreenFlash_.55s_ease-out]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 animate-[mrVictoryShake_.55s_ease-out]" />
        <div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/14 blur-3xl animate-pulse" />
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/22 blur-3xl animate-pulse" />
        <div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/15 blur-3xl animate-[mrPoolPulse_1.2s_ease-in-out_infinite]" />
        {Array.from({ length: 132 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-[-30px] animate-[mrBigConfetti_3.3s_ease-in-out_infinite]"
            style={{
              left: `${(i * 29) % 100}%`,
              width: i % 4 === 0 ? 10 : i % 4 === 1 ? 7 : 5,
              height: i % 4 === 0 ? 16 : i % 4 === 1 ? 12 : 8,
              borderRadius: i % 5 === 0 ? '999px' : '3px',
              background: i % 6 === 0 ? '#f97316' : i % 6 === 1 ? '#22c55e' : i % 6 === 2 ? '#facc15' : i % 6 === 3 ? '#38bdf8' : i % 6 === 4 ? '#e879f9' : '#ffffff',
              animationDelay: `${(i % 31) * 0.045}s`,
              transform: `rotate(${i * 31}deg)`,
              boxShadow: i % 6 === 2 ? '0 0 14px rgba(250,204,21,.65)' : undefined,
            }}
          />
        ))}
      </div>

      {!revealDone && (
        <div className="relative z-10 flex flex-col items-center text-center animate-[mrRevealFade_.8s_ease-out]">
          <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-full border border-yellow-300/45 text-7xl shadow-2xl animate-[mrTrophyBounce_.8s_ease-in-out_infinite]" style={{ background: 'radial-gradient(circle,#facc15,#b45309)', boxShadow: '0 0 70px rgba(250,204,21,.48)' }}>🏆</div>
          <p className="text-[11px] font-black uppercase tracking-[.30em] text-yellow-300">revealing result</p>
          <h2 className="mt-2 text-4xl font-black text-white">POOL CLAIMED</h2>
        </div>
      )}

      {revealDone && (
        <div
          className="relative w-full max-w-[460px] overflow-hidden rounded-[34px] border border-yellow-300/35 p-5 text-center shadow-2xl animate-[mrWinPop_.42s_cubic-bezier(.2,1.45,.4,1)]"
          style={{ background: 'radial-gradient(circle at 50% 0%, rgba(250,204,21,.20), rgba(34,197,94,.22) 24%, rgba(249,115,22,.20) 44%, rgba(12,8,4,.99) 68%, rgba(4,4,14,.99))', boxShadow: '0 0 90px rgba(34,197,94,.22), 0 0 70px rgba(249,115,22,.28)' }}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 h-10 w-10 rounded-full text-slate-300 active:scale-95"
            style={{ background: 'rgba(15,23,42,.76)', border: '1px solid rgba(255,255,255,.10)' }}
            aria-label="Close win result"
          >
            ✕
          </button>

          <div className="absolute left-4 top-4 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-yellow-200 animate-[mrStreakPop_.85s_ease-out]" style={{ background: 'rgba(120,53,15,.45)', border: '1px solid rgba(250,204,21,.28)' }}>
            🔥 {rankLabel} · x{streak}
          </div>

          <div className="mx-auto mb-3 mt-8 flex h-28 w-28 items-center justify-center rounded-full border border-yellow-300/50 text-7xl shadow-2xl animate-[mrTrophyBounce_1.05s_ease-in-out_infinite]" style={{ background: 'radial-gradient(circle,#facc15,#b45309)', boxShadow: '0 0 62px rgba(250,204,21,.48)' }}>
            🏆
          </div>

          <p className="text-[11px] font-black uppercase tracking-[.28em] text-emerald-300">{payoutLabel}</p>
          <h2 className="mt-1 text-[42px] font-black leading-none text-white drop-shadow-lg sm:text-5xl">YOU WON THE POOL</h2>

          <div className="mt-4 rounded-[26px] border border-emerald-300/34 px-4 py-5 animate-[mrPoolPulse_1.25s_ease-in-out_infinite]" style={{ background: 'linear-gradient(135deg,rgba(6,78,59,.35),rgba(22,101,52,.18))' }}>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200">Claimed payout</p>
            <p className="mt-1 text-6xl font-black tabular-nums text-emerald-300 drop-shadow-lg">+{sf(animatedAmount, 4)}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-emerald-200">{isReal ? 'SOL' : 'Arena result'}</p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Rank', value: rankLabel, icon: '⚡' },
              { label: 'Streak', value: `x${streak}`, icon: '🔥' },
              { label: 'Next', value: 'Rematch', icon: '⚔️' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-yellow-400/10 px-2.5 py-2 text-center" style={{ background: 'rgba(120,53,15,.18)' }}>
                <p className="text-base leading-none">{item.icon}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
                <p className="mt-0.5 truncate text-[11px] font-black text-yellow-200">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            <div className="rounded-2xl border border-white/[.06] p-3" style={{ background: 'rgba(15,23,42,.50)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Battle</p>
              <p className="mt-1 truncate text-sm font-black text-white">{battle}</p>
            </div>
            <div className="rounded-2xl border border-white/[.06] p-3" style={{ background: 'rgba(15,23,42,.50)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Winner</p>
              <p className="mt-1 truncate text-sm font-black text-orange-400">{winnerToken}</p>
            </div>
            <div className="rounded-2xl border border-white/[.06] p-3" style={{ background: 'rgba(15,23,42,.50)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your pick</p>
              <p className="mt-1 truncate text-sm font-black text-cyan-300">{pickedToken || '—'}</p>
            </div>
            <div className="rounded-2xl border border-white/[.06] p-3" style={{ background: 'rgba(15,23,42,.50)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Wallet</p>
              <p className="mt-1 truncate text-sm font-mono font-black text-slate-300">{wallet ? sw(wallet) : 'Connected'}</p>
            </div>
          </div>

          {shortTx && (
            <a
              href={`${CFG.solscan}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-2xl border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300"
              style={{ background: 'rgba(6,78,59,.12)' }}
            >
              Verify payout on Solscan · {shortTx} ↗
            </a>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl px-2 py-3 text-xs font-black text-white active:scale-95"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)', boxShadow: '0 0 24px rgba(14,165,233,.30)' }}
            >
              Share on X
            </a>
            <button
              onClick={copyResult}
              className="rounded-2xl px-2 py-3 text-xs font-black text-white active:scale-95"
              style={{ background: copied ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#ea580c,#f97316)', boxShadow: copied ? '0 0 22px rgba(16,185,129,.24)' : '0 0 22px rgba(249,115,22,.25)' }}
            >
              {copied ? 'Copied ✓' : 'Copy Result'}
            </button>
            <button
              onClick={rematch}
              className="rounded-2xl px-2 py-3 text-xs font-black text-white active:scale-95"
              style={{ background: 'linear-gradient(135deg,#7c2d12,#f59e0b)', boxShadow: '0 0 22px rgba(245,158,11,.22)' }}
            >
              Rematch
            </button>
          </div>

          <button
            onClick={makeResultImage}
            disabled={makingImage}
            className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-black text-white active:scale-95 disabled:opacity-70"
            style={{ background: imageReady ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#7c2d12,#ea580c)', border: '1px solid rgba(251,146,60,.32)', boxShadow: '0 0 26px rgba(249,115,22,.24)' }}
          >
            {makingImage ? 'Creating flex image…' : imageReady ? 'Share Image Ready ✓' : 'Create Auto Flex Image'}
          </button>

          <div className="mt-3 rounded-2xl border border-orange-500/15 px-3 py-2 text-left" style={{ background: 'rgba(120,53,15,.12)' }}>
            <p className="text-[9px] font-black uppercase tracking-widest text-orange-300">Viral loop</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Your result includes a battle link + referral. Share it, bring fighters back to the same arena, and run the rematch while it is hot.</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes mrScreenFlash {
          0% { background: rgba(250,204,21,.38); }
          35% { background: rgba(249,115,22,.18); }
          100% { background: rgba(0,0,0,.90); }
        }
        @keyframes mrVictoryShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes mrBigConfetti {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(112vh) rotate(860deg); opacity: 0; }
        }
        @keyframes mrRevealFade {
          0% { transform: scale(.88); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mrWinPop {
          0% { transform: scale(.84) translateY(20px); opacity: 0; }
          72% { transform: scale(1.025) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes mrTrophyBounce {
          0%,100% { transform: translateY(0) rotate(-3deg) scale(1); }
          50% { transform: translateY(-9px) rotate(3deg) scale(1.04); }
        }
        @keyframes mrPoolPulse {
          0%,100% { box-shadow: 0 0 22px rgba(34,197,94,.16); }
          50% { box-shadow: 0 0 52px rgba(34,197,94,.38), 0 0 34px rgba(250,204,21,.16); }
        }
        @keyframes mrStreakPop {
          0% { transform: translateY(-10px) scale(.82); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
