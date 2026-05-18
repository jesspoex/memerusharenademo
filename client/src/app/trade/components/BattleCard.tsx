"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Battle, Token, sf, fmtT } from "../constants";

interface Props {
  battle: Battle;
  tokens: Token[];
  glFn: (sym: string) => string;
  onClick: () => void;
}

const REG: Record<string, string> = {
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  BONK: "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg",
  WIF: "https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg",
  POPCAT: "https://assets.coingecko.com/coins/images/33908/large/popcat.png",
  BOME: "https://assets.coingecko.com/coins/images/35215/large/bome.png",
  MYRO: "https://assets.coingecko.com/coins/images/33427/large/myro.png",
  PEPE: "https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg",
  MRUSH: "/mrush-logo.png",
  AUDD: "https://assets.coingecko.com/coins/images/31273/large/AUDD.png",
};

const BAK: Record<string, string> = {
  SOL: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  BONK: "https://dd.dexscreener.com/ds-data/tokens/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263.png?size=lg&key=2f8e8c",
  WIF: "https://dd.dexscreener.com/ds-data/tokens/solana/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm.png?size=lg&key=2f8e8c",
  POPCAT: "https://dd.dexscreener.com/ds-data/tokens/solana/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr.png?size=lg&key=2f8e8c",
  BOME: "https://dd.dexscreener.com/ds-data/tokens/solana/ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82.png?size=lg&key=2f8e8c",
  MYRO: "https://dd.dexscreener.com/ds-data/tokens/solana/HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4.png?size=lg&key=2f8e8c",
  PEPE: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
  MRUSH: "/mrush-logo.png",
};

function svgAvatar(sym: string): string {
  const label = (sym || "?").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='20' fill='%23ea580c'/><text x='20' y='26' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='bold' font-size='14' fill='white'>${label}</text></svg>`;
  return `data:image/svg+xml,${svg}`;
}

function getBestUrl(sym: string, glFn: (s: string) => string, tokens: Token[]): string {
  const key = sym.toUpperCase();
  if (REG[key]) return REG[key];
  const tok = tokens.find((t) => t.symbol.toUpperCase() === key);
  if (tok?.logoUrl && tok.logoUrl.startsWith("http") && !tok.logoUrl.includes("ui-avatars")) return tok.logoUrl;
  const g = glFn(sym);
  if (g && g.startsWith("http") && !g.includes("ui-avatars")) return g;
  return svgAvatar(sym);
}

function TokenImg({ sym, glFn, tokens, size = 40, className = "" }: {
  sym: string; glFn: (s: string) => string; tokens: Token[]; size?: number; className?: string;
}) {
  const initial = getBestUrl(sym, glFn, tokens);
  const [src, setSrc] = useState(initial);
  const stage = useRef(0);
  const key = sym.toUpperCase();

  useEffect(() => {
    const fresh = getBestUrl(sym, glFn, tokens);
    if (fresh !== src && !fresh.startsWith("data:")) { stage.current = 0; setSrc(fresh); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, glFn]);

  const onError = useCallback(() => {
    stage.current += 1;
    if (stage.current === 1 && BAK[key]) { setSrc(BAK[key]); return; }
    setSrc(svgAvatar(sym));
  }, [sym, key]);

  return (
    <img src={src} alt={sym} width={size} height={size} onError={onError}
      loading="lazy" decoding="async"
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }} />
  );
}

// ── Animated watching count ──────────────────────────────────────────────────
function WatchCount({ count }: { count: number }) {
  const [displayed, setDisplayed] = useState(count);
  useEffect(() => {
    const t = setTimeout(() => setDisplayed(count), 200);
    return () => clearTimeout(t);
  }, [count]);
  return (
    <span className="text-[9px] text-slate-500 font-bold tabular-nums transition-all duration-300">
      · 👀 {displayed}
    </span>
  );
}

// ── Animated progress bar ────────────────────────────────────────────────────
function HeatBar({ value, color, label }: { value: number; color: string; label: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(value), 60); return () => clearTimeout(t); }, [value]);
  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
        <div className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="text-[9px] font-black text-slate-500 w-6 text-right tabular-nums">{label}</span>
    </div>
  );
}

export function BattleCard({ battle, tokens, glFn, onClick }: Props) {
  const [glowPulse, setGlowPulse] = useState(false);

  const aL = battle.chartA[battle.chartA.length - 1] ?? 0;
  const bL = battle.chartB[battle.chartB.length - 1] ?? 0;
  const leadA = aL >= bL;
  const tl = Math.max(0, Math.floor((battle.endTime - Date.now()) / 1000));
  const ending = tl < 20;
  const isReal = (battle.mode ?? "arena") === "real";
  const isHot = battle.players >= 3 || isReal;
  const isEndingSoon = tl <= 60;
  const isFinalSeconds = tl <= 15;
  const isNeck = Math.abs(aL - bL) < 0.18;
  const isDominating = Math.abs(aL - bL) >= 1.2;
  const isComeback = Math.abs(aL - bL) >= 0.35 && Math.abs(aL - bL) < 0.85 && ((battle.duration - tl) / battle.duration) > 0.45;
  const pct = Math.min(100, Math.max(0, ((battle.duration - tl) / battle.duration) * 100));
  const poolLabel = `${sf(battle.prizePool, 3)} SOL`;
  const gap = Math.abs(aL - bL);
  const avgMove = (Math.abs(aL) + Math.abs(bL)) / 2;
  const playerHeat = Math.min(5, Math.max(1, battle.players));
  const leader = leadA ? battle.tokenA : battle.tokenB;
  const trailer = leadA ? battle.tokenB : battle.tokenA;
  const heatScore = Math.min(100, Math.round((playerHeat / 5) * 42 + Math.min(38, avgMove * 12) + (isEndingSoon ? 20 : 0)));

  // Dynamic battle mood badge
  const battleMoodBadge = isFinalSeconds ? { label: "FINAL SECONDS", color: "#f87171", bg: "rgba(127,29,29,.55)", border: "rgba(248,113,113,.35)" }
    : isNeck ? { label: "NECK & NECK", color: "#e879f9", bg: "rgba(88,28,135,.4)", border: "rgba(232,121,249,.3)" }
    : isDominating ? { label: `${leader} DOMINATING`, color: "#fb923c", bg: "rgba(120,53,15,.55)", border: "rgba(251,146,60,.3)" }
    : isEndingSoon ? { label: "ENDING SOON", color: "#fbbf24", bg: "rgba(120,53,15,.5)", border: "rgba(251,191,36,.28)" }
    : isHot ? { label: "🔥 HOT", color: "#f97316", bg: "rgba(154,52,18,.5)", border: "rgba(249,115,22,.3)" }
    : isComeback ? { label: `${trailer} COMEBACK`, color: "#38bdf8", bg: "rgba(8,47,73,.5)", border: "rgba(56,189,248,.28)" }
    : { label: "LIVE ROUND", color: "#a3e635", bg: "rgba(54,83,20,.4)", border: "rgba(163,230,53,.22)" };

  const momentumLabel = isNeck ? "NECK & NECK"
    : isDominating ? `${leader} DOMINATING`
    : isComeback ? `${trailer} CAN COMEBACK`
    : `${leader} LEADS`;

  const joinCopy = isFinalSeconds ? "SNIPE" : isNeck ? "PICK SIDE" : isDominating ? "CHASE" : "JOIN";

  const watching = Math.max(2, Math.min(24,
    battle.players * 2 + (battle.id.charCodeAt(0) % 7) + (isEndingSoon ? 4 : 0) + (isReal ? 3 : 0)
  ));

  const fmt = (p: number) => p <= 0 ? "" : p < 0.001 ? `$${p.toFixed(6)}` : p < 1 ? `$${p.toFixed(4)}` : `$${p.toFixed(2)}`;
  const pA = tokens.find((t) => t.symbol === battle.tokenA)?.price ?? 0;
  const pB = tokens.find((t) => t.symbol === battle.tokenB)?.price ?? 0;
  const pctA = Math.round((battle.chartA.filter((v) => v >= 0).length / Math.max(battle.chartA.length, 1)) * 100);
  const pctB = 100 - pctA;

  // Pulse on ending soon
  useEffect(() => {
    if (!isEndingSoon) return;
    const id = setInterval(() => setGlowPulse(p => !p), 700);
    return () => clearInterval(id);
  }, [isEndingSoon]);

  const cardBorder = isFinalSeconds
    ? `rgba(239,68,68,${glowPulse ? ".65" : ".35"})`
    : ending ? "rgba(239,68,68,.45)"
    : isReal ? "rgba(249,115,22,.28)"
    : isNeck ? "rgba(232,121,249,.18)"
    : "rgba(30,41,59,.55)";

  const cardShadow = isFinalSeconds
    ? `0 0 ${glowPulse ? "44" : "28"}px rgba(239,68,68,.28)`
    : isReal ? "0 4px 32px rgba(249,115,22,.15)"
    : isNeck ? "0 0 28px rgba(232,121,249,.10)"
    : "0 2px 16px rgba(0,0,0,.4)";

  return (
    <div onClick={onClick}
      className="group relative rounded-2xl overflow-hidden cursor-pointer touch-manipulation"
      style={{
        background: isReal
          ? "linear-gradient(180deg,rgba(22,10,2,.99),rgba(10,5,1,.99))"
          : "linear-gradient(180deg,rgba(11,11,24,.99),rgba(5,5,14,.99))",
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        transition: "all .25s cubic-bezier(.4,0,.2,1)",
        transform: "translateZ(0)",
      }}
    >
      {/* Top accent gradient */}
      <div className="h-[2px]" style={{
        background: isFinalSeconds
          ? "linear-gradient(90deg,transparent,#ef4444,#f97316,transparent)"
          : ending ? "linear-gradient(90deg,transparent,#ef4444,transparent)"
          : isReal ? "linear-gradient(90deg,transparent,#f97316,#fbbf24,transparent)"
          : isNeck ? "linear-gradient(90deg,transparent,#e879f9,transparent)"
          : "linear-gradient(90deg,transparent,rgba(71,85,105,.4),transparent)",
      }} />

      {/* Hover glow overlay */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: isFinalSeconds ? "rgba(239,68,68,.2)" : "rgba(249,115,22,.16)" }} />

      {/* Animated border glow for active rounds */}
      {(isEndingSoon || isReal) && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            boxShadow: `inset 0 0 0 1px ${isFinalSeconds ? "rgba(239,68,68,.25)" : "rgba(249,115,22,.18)"}`,
            animation: "mr-border-pulse 2s ease-in-out infinite",
          }} />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live pulse */}
          <span className="relative flex w-2 h-2 flex-shrink-0">
            <span className="absolute inline-flex w-full h-full rounded-full opacity-65 animate-ping"
              style={{ background: isFinalSeconds ? "#ef4444" : "#f97316" }} />
            <span className="relative inline-flex w-2 h-2 rounded-full"
              style={{ background: isFinalSeconds ? "#ef4444" : "#f97316" }} />
          </span>

          {/* Battle mood badge */}
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: battleMoodBadge.bg, color: battleMoodBadge.color, border: `1px solid ${battleMoodBadge.border}` }}>
            {battleMoodBadge.label}
          </span>

          {isReal ? (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(120,53,15,.55)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.25)" }}>
              💰 REAL · JOIN
            </span>
          ) : (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(88,28,135,.35)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,.2)" }}>
              🔓 OPEN
            </span>
          )}

          <WatchCount count={watching} />
        </div>

        {/* Timer */}
        <span className="font-mono font-black text-sm tabular-nums px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{
            color: isFinalSeconds ? "#f87171" : "#fb923c",
            background: isFinalSeconds ? "rgba(239,68,68,.12)" : "rgba(30,15,5,.7)",
            boxShadow: isFinalSeconds ? "0 0 8px rgba(239,68,68,.3)" : "none",
            animation: isFinalSeconds ? "mr-timer-pulse .6s ease-in-out infinite" : "none",
          }}>
          {fmtT(tl)}
        </span>
      </div>

      {/* Momentum strip */}
      <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl border border-white/[.055] px-2.5 py-1.5"
        style={{ background: isEndingSoon ? "rgba(127,29,29,.12)" : "rgba(15,23,42,.38)" }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px]">{isNeck ? "⚔️" : isDominating ? "🔥" : isComeback ? "↗️" : "⚡"}</span>
          <span className="text-[9px] font-black uppercase tracking-wide truncate"
            style={{ color: isEndingSoon ? "#fca5a5" : "#fdba74" }}>
            {momentumLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-[9px] text-slate-500">live chart</span>
        </div>
      </div>

      {/* VS layout */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-1.5 items-stretch">
        {/* Token A */}
        <div className={`rounded-xl p-3 flex flex-col gap-2 border transition-all duration-500 ${leadA ? "border-orange-500/40" : "border-white/5"}`}
          style={{ background: leadA ? "rgba(249,115,22,.08)" : "rgba(255,255,255,.02)", boxShadow: leadA ? "inset 0 0 20px rgba(249,115,22,.06)" : "none" }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <TokenImg sym={battle.tokenA} glFn={glFn} tokens={tokens} size={40}
                className={`border-2 transition-all ${leadA ? "border-orange-400/55" : "border-white/10"}`} />
              {leadA && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[7px] font-black text-black animate-bounce">
                  ▲
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-white text-sm leading-none truncate">{battle.tokenA}</p>
              <p className={`text-xs font-black mt-0.5 tabular-nums transition-colors duration-300 ${aL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {aL >= 0 ? "+" : ""}{aL.toFixed(2)}%
              </p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full py-2 rounded-lg text-xs font-black text-white transition-all active:scale-95"
            style={{
              background: leadA ? "linear-gradient(135deg,#059669,#047857)" : "linear-gradient(135deg,#1c0e06,#292010)",
              boxShadow: leadA ? "0 2px 12px rgba(5,150,105,.32)" : "none",
            }}>
            {leadA ? "✅ LEADING" : `📈 ${joinCopy}`} {battle.tokenA}
          </button>
          <HeatBar value={pctA} color={leadA ? "#10b981" : "rgba(249,115,22,.3)"} label={`${pctA}%`} />
        </div>

        {/* VS center */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 cursor-pointer" onClick={onClick}>
          <div className="w-9 h-9 rounded-full border border-white/8 flex items-center justify-center text-[9px] font-black text-slate-500"
            style={{ background: "rgba(30,41,59,.5)" }}>
            vs
          </div>
          {gap > 0.01 && (
            <span className={`text-[8px] font-black tabular-nums ${leadA ? "text-emerald-500" : "text-orange-400"}`}>
              {gap.toFixed(2)}%
            </span>
          )}
          {(pA > 0 || pB > 0) && (
            <div className="mt-0.5 text-center space-y-0.5 leading-none">
              {pA > 0 && <p className="text-[7px] tabular-nums" style={{ color: "rgba(100,116,139,.5)" }}>{fmt(pA)}</p>}
              {pB > 0 && <p className="text-[7px] tabular-nums" style={{ color: "rgba(100,116,139,.5)" }}>{fmt(pB)}</p>}
            </div>
          )}
        </div>

        {/* Token B */}
        <div className={`rounded-xl p-3 flex flex-col gap-2 border transition-all duration-500 ${!leadA ? "border-orange-500/40" : "border-white/5"}`}
          style={{ background: !leadA ? "rgba(249,115,22,.08)" : "rgba(255,255,255,.02)", boxShadow: !leadA ? "inset 0 0 20px rgba(249,115,22,.06)" : "none" }}>
          <div className="flex items-center gap-2 flex-row-reverse">
            <div className="relative flex-shrink-0">
              <TokenImg sym={battle.tokenB} glFn={glFn} tokens={tokens} size={40}
                className={`border-2 transition-all ${!leadA ? "border-orange-400/55" : "border-white/10"}`} />
              {!leadA && (
                <div className="absolute -top-1 -left-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[7px] font-black text-black animate-bounce">
                  ▲
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="font-black text-white text-sm leading-none truncate">{battle.tokenB}</p>
              <p className={`text-xs font-black mt-0.5 tabular-nums transition-colors duration-300 ${bL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {bL >= 0 ? "+" : ""}{bL.toFixed(2)}%
              </p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full py-2 rounded-lg text-xs font-black text-white transition-all active:scale-95"
            style={{
              background: !leadA ? "linear-gradient(135deg,#c2410c,#9a3412)" : "linear-gradient(135deg,#1c0e06,#292010)",
              boxShadow: !leadA ? "0 2px 12px rgba(249,115,22,.32)" : "none",
            }}>
            {!leadA ? "✅ LEADING" : `📈 ${joinCopy}`} {battle.tokenB}
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-black text-slate-500 w-6 tabular-nums">{pctB}%</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctB}%`, background: !leadA ? "#f97316" : "rgba(249,115,22,.3)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pool + Heat strip */}
      <div className="mx-3 mb-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl px-2 py-2 text-center border border-white/[.05]" style={{ background: "rgba(15,23,42,.42)" }}>
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-wide">Prize Pool</p>
          <p className="text-[12px] font-black text-emerald-400 tabular-nums">{poolLabel}</p>
        </div>
        <div className="rounded-xl px-2 py-2 text-center border border-white/[.05]" style={{ background: "rgba(120,53,15,.10)" }}>
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-wide">Arena Heat</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
              <div className="h-full rounded-full" style={{
                width: `${heatScore}%`,
                background: `linear-gradient(90deg,#f97316,${heatScore > 70 ? "#ef4444" : "#fbbf24"})`,
              }} />
            </div>
            <span className="text-[10px] font-black text-orange-300 flex-shrink-0">{heatScore}%</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-3 mb-1.5 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(30,41,59,.5)" }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: isFinalSeconds
              ? "linear-gradient(90deg,#ef4444,#f97316)"
              : pct > 70 ? "linear-gradient(90deg,#f59e0b,#f97316)"
              : "linear-gradient(90deg,#f97316,#fbbf24)",
            boxShadow: isFinalSeconds ? "0 0 6px rgba(239,68,68,.5)" : "0 0 4px rgba(249,115,22,.4)",
          }} />
      </div>
      <div className="px-3 pb-3 flex items-center justify-between text-[8px] text-slate-600">
        <span>{Math.round(pct)}% elapsed</span>
        <span className="font-bold text-slate-700">tap to battle ⚔️</span>
      </div>
    </div>
  );
}
