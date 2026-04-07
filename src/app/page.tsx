'use client';
// src/app/battle/page.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenData, Battle } from '@/types';
import { makeBattleId, simulateWinner, MOCK_PAST_BATTLES } from '@/lib/mock';
import { formatPrice } from '@/lib/dexscreener';
import TokenCard from '@/components/TokenCard';
import TokenSearch from '@/components/TokenSearch';
import MiniChart from '@/components/MiniChart';

type Phase = 'setup' | 'live' | 'result';

const BATTLE_DURATION = 30; // seconds for demo

function fmtT(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function BattlePage() {
  const [phase,     setPhase]     = useState<Phase>('setup');
  const [tokenA,    setTokenA]    = useState<TokenData | null>(null);
  const [tokenB,    setTokenB]    = useState<TokenData | null>(null);
  const [pickedSide,setPickedSide]= useState<'A' | 'B' | null>(null);
  const [battle,    setBattle]    = useState<Battle | null>(null);
  const [timeLeft,  setTimeLeft]  = useState(BATTLE_DURATION);
  const [chartA,    setChartA]    = useState<number[]>([0]);
  const [chartB,    setChartB]    = useState<number[]>([0]);
  const [votes,     setVotes]     = useState({ A: 0, B: 0 });
  const [betAmount, setBetAmount] = useState('0.1');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chart animation tick
  const startTick = useCallback(() => {
    tickRef.current = setInterval(() => {
      setChartA(prev => {
        const last = prev[prev.length - 1] ?? 0;
        const bias = tokenA ? (tokenA.priceChange24h > 0 ? 0.005 : -0.005) : 0;
        return [...prev.slice(-100), parseFloat((last + bias + (Math.random() - 0.5) * 0.06).toFixed(5))];
      });
      setChartB(prev => {
        const last = prev[prev.length - 1] ?? 0;
        const bias = tokenB ? (tokenB.priceChange24h > 0 ? 0.005 : -0.005) : 0;
        return [...prev.slice(-100), parseFloat((last + bias + (Math.random() - 0.5) * 0.06).toFixed(5))];
      });
      setTimeLeft(t => {
        if (t <= 1) { endBattle(); return 0; }
        return t - 1;
      });
    }, 1000);
  }, [tokenA, tokenB]);

  function endBattle() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!tokenA || !tokenB) return;
    const winner = simulateWinner(tokenA, tokenB);
    const winnerToken = winner === 'A' ? tokenA : tokenB;
    setBattle(prev => prev ? { ...prev, status: 'ended', winner, winnerToken, endedAt: Date.now() } : prev);
    setPhase('result');
  }

  function startBattle() {
    if (!tokenA || !tokenB) return;
    const b: Battle = {
      id:         makeBattleId(),
      tokenA,     tokenB,
      status:     'live',
      startedAt:  Date.now(),
      votes:      { A: Math.floor(Math.random() * 15) + 3, B: Math.floor(Math.random() * 10) + 2 },
      prizePool:  parseFloat(betAmount) * (Math.floor(Math.random() * 8) + 4),
    };
    setBattle(b);
    setVotes(b.votes);
    setChartA([0]); setChartB([0]);
    setTimeLeft(BATTLE_DURATION);
    setPhase('live');
    startTick();
  }

  function resetBattle() {
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase('setup');
    setBattle(null);
    setPickedSide(null);
    setTokenA(null);
    setTokenB(null);
    setChartA([0]); setChartB([0]);
    setTimeLeft(BATTLE_DURATION);
  }

  // Mock vote by user picking side
  function pickSide(side: 'A' | 'B') {
    if (phase !== 'live' || pickedSide) return;
    setPickedSide(side);
    setVotes(v => ({ ...v, [side]: v[side] + 1 }));
  }

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const isLive    = phase === 'live';
  const isResult  = phase === 'result';
  const userWon   = isResult && battle?.winner === pickedSide;
  const userLost  = isResult && pickedSide && battle?.winner !== pickedSide;
  const totalVotes = votes.A + votes.B;
  const pctA = totalVotes ? Math.round((votes.A / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;
  const progress = ((BATTLE_DURATION - timeLeft) / BATTLE_DURATION) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pb-16">

      {/* Banner */}
      <div className="sticky top-0 z-50 py-2 px-4 text-center backdrop-blur-sm"
        style={{ background: 'linear-gradient(90deg,rgba(6,78,59,.9),rgba(6,95,70,.9))', borderBottom: '1px solid rgba(16,185,129,.2)' }}>
        <p className="text-xs text-emerald-200 font-medium flex items-center justify-center gap-2 flex-wrap">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          🏆 Meme Battle Arena — Hackathon Demo · Read-only · No real money
        </p>
      </div>

      {/* Header */}
      <header className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
            ⚔️ Meme Battle Arena
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Pick your token · Watch it battle · See who wins</p>
        </div>
        <div className="flex gap-2">
          <a href="/leaderboard" className="px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/20 transition-colors">
            🏆 Leaderboard
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 space-y-6">

        {/* ── SETUP PHASE ── */}
        {phase === 'setup' && (
          <>
            <div className="rounded-2xl p-5 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
              <h2 className="font-black text-lg mb-1">Create a Battle</h2>
              <p className="text-slate-400 text-sm mb-5">Search two tokens by contract address (CA) from Solana. Winner decided by highest % gain.</p>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="p-4 rounded-2xl border border-cyan-500/20" style={{ background: 'rgba(34,211,238,.04)' }}>
                  <TokenSearch
                    label="🔵 Token A"
                    color="#22d3ee"
                    onToken={setTokenA}
                    disabled={false}
                  />
                  {tokenA && (
                    <div className="mt-4">
                      <TokenCard token={tokenA} side="A" />
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl border border-pink-500/20" style={{ background: 'rgba(244,114,182,.04)' }}>
                  <TokenSearch
                    label="🔴 Token B"
                    color="#f472b6"
                    onToken={setTokenB}
                    disabled={false}
                  />
                  {tokenB && (
                    <div className="mt-4">
                      <TokenCard token={tokenB} side="B" />
                    </div>
                  )}
                </div>
              </div>

              {/* Bet amount (mock) */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block font-bold">Mock Bet Amount (SOL)</label>
                  <div className="flex gap-2">
                    {['0.1', '0.5', '1', '2'].map(v => (
                      <button key={v} onClick={() => setBetAmount(v)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                        style={{ borderColor: betAmount === v ? 'rgba(139,92,246,.8)' : 'rgba(71,85,105,.3)', background: betAmount === v ? 'rgba(139,92,246,.2)' : 'rgba(30,41,59,.5)', color: betAmount === v ? 'white' : 'rgba(100,116,139,1)' }}>
                        {v}◎
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block font-bold">Battle Duration</label>
                  <p className="text-white font-bold py-2 px-3 rounded-xl border border-white/10 text-sm" style={{ background: 'rgba(30,41,59,.5)' }}>
                    {BATTLE_DURATION}s (demo)
                  </p>
                </div>
              </div>

              <button
                onClick={startBattle}
                disabled={!tokenA || !tokenB || tokenA.symbol === tokenB.symbol}
                className="mt-5 w-full py-4 rounded-xl font-black text-lg transition-all disabled:opacity-40"
                style={{ background: tokenA && tokenB ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(139,92,246,.2)', boxShadow: tokenA && tokenB ? '0 0 30px rgba(139,92,246,.4)' : 'none' }}
              >
                {!tokenA ? '← Add Token A first'
                  : !tokenB ? 'Add Token B →'
                  : tokenA.symbol === tokenB.symbol ? 'Pick different tokens'
                  : `⚔️ START BATTLE — ${tokenA.symbol} vs ${tokenB.symbol}`}
              </button>
            </div>

            {/* Past battles */}
            <div className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
              <h3 className="font-bold text-sm mb-3">📜 Recent Battles (Demo History)</h3>
              <div className="space-y-2">
                {MOCK_PAST_BATTLES.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/5 text-sm" style={{ background: 'rgba(18,18,40,.8)' }}>
                    <span className="font-mono text-white">{b.tokenA} <span className="text-slate-500">vs</span> {b.tokenB}</span>
                    <span className="text-emerald-400 font-bold">🏆 {b.winner}</span>
                    <span className="text-yellow-400 text-xs">{b.prizePool} SOL</span>
                    <span className="text-slate-500 text-xs">{b.endedAt}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── LIVE PHASE ── */}
        {(isLive || isResult) && battle && tokenA && tokenB && (
          <>
            {/* Status bar */}
            <div className={`rounded-2xl p-4 text-center ${isResult ? 'border-2' : 'border border-white/10'}`}
              style={{
                background: isResult ? (userWon ? 'rgba(6,78,59,.3)' : userLost ? 'rgba(127,29,29,.25)' : 'rgba(88,28,135,.2)') : 'rgba(8,8,22,.9)',
                borderColor: isResult ? (userWon ? '#22c55e' : userLost ? '#ef4444' : '#a855f7') : undefined,
              }}>

              {isLive && (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black text-emerald-400" style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)' }}>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />LIVE
                    </span>
                  </div>
                  <h2 className="text-2xl font-black mb-1">{tokenA.symbol} <span className="text-slate-500 text-lg">vs</span> {tokenB.symbol}</h2>
                  <p className="font-mono font-black text-5xl text-cyan-400 mb-1">{fmtT(timeLeft)}</p>
                  <div className="w-full h-2 rounded-full overflow-hidden mt-2 mb-1" style={{ background: 'rgba(30,41,59,.8)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%`, background: timeLeft < 10 ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#22d3ee,#a855f7,#ec4899)' }} />
                  </div>
                  {timeLeft < 10 && <p className="text-red-400 text-xs font-bold animate-pulse">⚡ ENDING SOON!</p>}
                </>
              )}

              {isResult && (
                <>
                  <div className="text-5xl mb-2">{userWon ? '🏆' : userLost ? '😔' : '⚔️'}</div>
                  <p className="text-3xl font-black" style={{ color: battle.winner === 'A' ? '#22d3ee' : '#f472b6' }}>
                    {battle.winnerToken?.symbol} WON!
                  </p>
                  {userWon  && <p className="text-emerald-300 font-bold text-lg mt-1">🎉 You won! +{(parseFloat(betAmount) * 1.85).toFixed(2)} SOL (mock)</p>}
                  {userLost && <p className="text-red-300 mt-1">Better luck next time!</p>}
                  {!pickedSide && <p className="text-slate-400 mt-1 text-sm">You didn't pick a side this round</p>}
                </>
              )}
            </div>

            {/* Prize pool */}
            <div className="text-center py-4 rounded-2xl" style={{ background: 'linear-gradient(135deg,rgba(120,53,15,.4),rgba(120,53,15,.15))', border: '1px solid rgba(251,191,36,.2)' }}>
              <p className="text-slate-400 text-xs mb-1">💰 Mock Prize Pool</p>
              <p className="text-5xl font-black text-yellow-400">{battle.prizePool.toFixed(2)}</p>
              <p className="text-yellow-500 font-bold">SOL (simulated)</p>
            </div>

            {/* Token cards */}
            <div className="grid grid-cols-2 gap-4">
              <TokenCard
                token={tokenA}
                side="A"
                selected={pickedSide === 'A'}
                winner={isResult && battle.winner === 'A'}
                loser={isResult && battle.winner !== 'A'}
                onSelect={isLive && !pickedSide ? () => pickSide('A') : undefined}
              />
              <TokenCard
                token={tokenB}
                side="B"
                selected={pickedSide === 'B'}
                winner={isResult && battle.winner === 'B'}
                loser={isResult && battle.winner !== 'B'}
                onSelect={isLive && !pickedSide ? () => pickSide('B') : undefined}
              />
            </div>

            {isLive && !pickedSide && (
              <div className="text-center p-3 border border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-400 font-semibold">👆 Tap a token to pick your side</p>
              </div>
            )}
            {isLive && pickedSide && (
              <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.3)' }}>
                <p className="text-purple-300 font-bold">✓ You picked {pickedSide === 'A' ? tokenA.symbol : tokenB.symbol} — watching the battle…</p>
              </div>
            )}

            {/* Live chart */}
            <div className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(5,5,18,.95)' }}>
              <MiniChart
                dataA={chartA} dataB={chartB}
                colorA="#22d3ee" colorB="#f472b6"
                height={140}
                labelA={tokenA.symbol}
                labelB={tokenB.symbol}
              />
            </div>

            {/* Community vote bar */}
            <div className="rounded-2xl p-4 border border-white/5" style={{ background: 'rgba(8,8,22,.9)' }}>
              <p className="text-xs text-slate-400 font-bold mb-2">🗳️ Community Vote ({totalVotes} participants)</p>
              <div className="flex rounded-full overflow-hidden h-6">
                <div className="flex items-center justify-center text-xs font-black text-black transition-all duration-500"
                  style={{ width: `${pctA}%`, background: '#22d3ee' }}>
                  {pctA > 15 && `${tokenA.symbol} ${pctA}%`}
                </div>
                <div className="flex items-center justify-center text-xs font-black text-black transition-all duration-500"
                  style={{ width: `${pctB}%`, background: '#f472b6' }}>
                  {pctB > 15 && `${tokenB.symbol} ${pctB}%`}
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>👥 {votes.A} voted {tokenA.symbol}</span>
                <span>{votes.B} voted {tokenB.symbol} 👥</span>
              </div>
            </div>

            {/* On-chain proof (read-only links) */}
            <div className="rounded-2xl p-3 border border-emerald-500/20 text-xs" style={{ background: 'rgba(6,78,59,.08)' }}>
              <p className="text-emerald-400 font-bold mb-2">🔗 On-Chain References (Read-only)</p>
              <div className="space-y-1">
                <a href={`https://dexscreener.com/solana/${tokenA.pairAddress}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />{tokenA.symbol} — View chart on DexScreener ↗
                </a>
                <a href={`https://dexscreener.com/solana/${tokenB.pairAddress}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300">
                  <span className="w-1.5 h-1.5 bg-pink-400 rounded-full" />{tokenB.symbol} — View chart on DexScreener ↗
                </a>
              </div>
            </div>

            {/* Price comparison */}
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              {[
                { l: tokenA.symbol, price: tokenA.price, ch: tokenA.priceChange24h, color: '#22d3ee' },
                { l: tokenB.symbol, price: tokenB.price, ch: tokenB.priceChange24h, color: '#f472b6' },
              ].map(t => (
                <div key={t.l} className="p-3 rounded-xl border border-white/5" style={{ background: 'rgba(18,18,40,.8)' }}>
                  <p className="font-bold text-white mb-1" style={{ color: t.color }}>{t.l}</p>
                  <p className="text-lg font-black text-white">{formatPrice(t.price)}</p>
                  <p className={`font-bold ${t.ch >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.ch >= 0 ? '▲' : '▼'} {Math.abs(t.ch).toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>

            {/* Reset */}
            {isResult && (
              <button onClick={resetBattle}
                className="w-full py-4 rounded-xl font-black text-lg transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                ⚔️ Start New Battle
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
