"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  TREASURY: process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "Fwsyjj7sf64MxCNfkysQ4UoJbE1MYXBe7dp35Czd5Vew",
  TWITTER: "https://x.com/memerusharena",
  TELEGRAM: "https://t.me/memerusharena",
  DISCORD: "https://discord.gg/xWYWxe5wxG",
  LOGO: "/mrush-logo.png",
  MIN_SOL: "0.001",
  MIN_USD: "~$0.10",
};

type Battle = {
  id: string; token_a: string; token_b: string;
  prize_pool?: number; players?: number; status?: string;
  end_time?: string; start_time?: string; mode?: string; type?: string;
};
type Stats = { players?: number; battles?: number; volSol?: number; paidSol?: number };

const TOKEN_LOGOS: Record<string, string[]> = {
  BONK: ["https://coin-images.coingecko.com/coins/images/28600/large/bonk.jpg"],
  WIF: ["https://coin-images.coingecko.com/coins/images/33566/large/dogwifhat.jpg", "https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg"],
  POPCAT: ["https://coin-images.coingecko.com/coins/images/33760/large/image.jpg", "https://assets.coingecko.com/coins/images/33908/large/popcat.png"],
  BOME: ["https://coin-images.coingecko.com/coins/images/36071/large/bome.png"],
  MYRO: ["https://coin-images.coingecko.com/coins/images/33427/large/myro.png"],
  SOL: ["https://coin-images.coingecko.com/coins/images/4128/large/solana.png"],
  PEPE: ["https://coin-images.coingecko.com/coins/images/29850/large/pepe-token.jpeg"],
  MRUSH: ["/mrush-logo.png"],
};

const short = (w = "") => w.length > 12 ? `${w.slice(0, 6)}...${w.slice(-6)}` : w;
const fallbackLogo = (s: string) => `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='20' fill='%23ea580c'/><text x='20' y='26' text-anchor='middle' font-family='system-ui' font-weight='bold' font-size='14' fill='white'>${(s||"?").slice(0,2).toUpperCase()}</text></svg>`;

function TokenLogo({ symbol, className = "" }: { symbol: string; className?: string }) {
  const key = (symbol || "").toUpperCase();
  const sources = TOKEN_LOGOS[key] ?? [];
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [key]);
  const src = sources[idx] ?? fallbackLogo(key);
  return (
    <img src={src} alt={key} referrerPolicy="no-referrer" className={`object-cover ${className}`}
      onError={() => { if (idx < sources.length - 1) setIdx(i => i + 1); }} />
  );
}

function Countdown({ end }: { end?: string }) {
  const calc = () => end ? Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000)) : 0;
  const [sec, setSec] = useState(calc);
  useEffect(() => {
    setSec(calc());
    const id = setInterval(() => setSec(calc()), 1000);
    return () => clearInterval(id);
  }, [end]);
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  const urgent = sec < 30 && sec > 0;
  return (
    <span className={`font-mono font-black tabular-nums ${urgent ? "text-red-300" : "text-orange-300"}`}
      style={{ animation: urgent ? "hp-timer-blink .8s ease-in-out infinite" : "none" }}>
      {m}:{s}
    </span>
  );
}

function MiniBattle({ b, onJoin }: { b: Battle; onJoin: () => void }) {
  const [a, setA] = useState(() => Number(((Math.random() - 0.45) * 3).toFixed(2)));
  const [bv, setBv] = useState(() => Number(((Math.random() - 0.55) * 3).toFixed(2)));
  useEffect(() => {
    const id = setInterval(() => {
      setA(v => Number((v + (Math.random() - 0.5) * 0.25).toFixed(2)));
      setBv(v => Number((v + (Math.random() - 0.5) * 0.25).toFixed(2)));
    }, 2000);
    return () => clearInterval(id);
  }, []);
  const leadA = a >= bv;
  const pool = Number(b.prize_pool ?? 0);
  const left = b.end_time ? Math.max(0, Math.floor((new Date(b.end_time).getTime() - Date.now()) / 1000)) : 999;
  const ending = left < 60;

  return (
    <button onClick={onJoin}
      className="group text-left rounded-2xl border transition-all duration-200 active:scale-[0.97] overflow-hidden relative"
      style={{
        background: "linear-gradient(180deg,rgba(14,8,2,.96),rgba(7,4,1,.98))",
        border: ending ? "1px solid rgba(239,68,68,.35)" : "1px solid rgba(249,115,22,.18)",
        boxShadow: ending ? "0 0 20px rgba(239,68,68,.12)" : "0 0 16px rgba(249,115,22,.08)",
      }}>
      {/* Top accent */}
      <div className="h-[1.5px]" style={{ background: ending ? "linear-gradient(90deg,transparent,#ef4444,transparent)" : "linear-gradient(90deg,transparent,#f97316 40%,#fbbf24 60%,transparent)" }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: ending ? "#ef4444" : "#f97316" }} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: ending ? "#f87171" : "#fb923c" }}>
              {ending ? "ENDING NOW" : "LIVE"}
            </span>
          </div>
          <div className="px-3 py-1 rounded-xl text-sm" style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.07)" }}>
            <Countdown end={b.end_time} />
          </div>
        </div>

        {/* VS Grid */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Token A */}
          <div className={`rounded-xl border p-3 transition-all ${leadA ? "border-orange-400/45" : "border-white/8"}`}
            style={{ background: leadA ? "rgba(249,115,22,.09)" : "rgba(255,255,255,.02)", boxShadow: leadA ? "inset 0 0 14px rgba(249,115,22,.06)" : "none" }}>
            <div className="flex items-center gap-2">
              <TokenLogo symbol={b.token_a} className="h-9 w-9 rounded-full border border-white/15 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-black text-white text-sm leading-none truncate">{b.token_a}</p>
                <p className={`text-xs font-black mt-0.5 tabular-nums ${a >= 0 ? "text-emerald-400" : "text-red-400"}`}>{a >= 0 ? "+" : ""}{a.toFixed(2)}%</p>
              </div>
            </div>
            {leadA && <div className="mt-2 text-[9px] font-black text-emerald-400 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"/> LEADING</div>}
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-slate-600"
              style={{ background: "rgba(30,41,59,.5)", border: "1px solid rgba(255,255,255,.06)" }}>VS</div>
          </div>

          {/* Token B */}
          <div className={`rounded-xl border p-3 transition-all ${!leadA ? "border-orange-400/45" : "border-white/8"}`}
            style={{ background: !leadA ? "rgba(249,115,22,.09)" : "rgba(255,255,255,.02)", boxShadow: !leadA ? "inset 0 0 14px rgba(249,115,22,.06)" : "none" }}>
            <div className="flex flex-row-reverse items-center gap-2">
              <TokenLogo symbol={b.token_b} className="h-9 w-9 rounded-full border border-white/15 flex-shrink-0" />
              <div className="min-w-0 text-right flex-1">
                <p className="font-black text-white text-sm leading-none truncate">{b.token_b}</p>
                <p className={`text-xs font-black mt-0.5 tabular-nums ${bv >= 0 ? "text-emerald-400" : "text-red-400"}`}>{bv >= 0 ? "+" : ""}{bv.toFixed(2)}%</p>
              </div>
            </div>
            {!leadA && <div className="mt-2 text-[9px] font-black text-emerald-400 flex items-center justify-end gap-1">LEADING <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"/></div>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[.04]">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-yellow-300 tabular-nums">{pool.toFixed(3)} <span className="text-[10px] text-orange-400">SOL</span></span>
            <span className="text-[10px] text-slate-600">👥 {b.players ?? 1}</span>
          </div>
          <div className="rounded-xl px-4 py-2 text-xs font-black text-white transition-all group-hover:scale-105"
            style={{ background: "linear-gradient(135deg,#c2410c,#f97316)", boxShadow: "0 0 14px rgba(249,115,22,.3)" }}>
            Join ⚔️
          </div>
        </div>
      </div>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [statsLoaded, setStatsLoaded] = useState(false);

  const fetchBattles = useCallback(async () => {
    try {
      const res = await fetch("/api/battles?status=live&limit=6", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.battles) ? data.battles : [];
      setBattles(list.slice(0, 6));
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const data = await res.json();
      setStats(data || {});
      setStatsLoaded(true);
    } catch {}
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchBattles(); fetchStats();
    const a = setInterval(fetchBattles, 5000);
    const s = setInterval(fetchStats, 30000);
    return () => { clearInterval(a); clearInterval(s); };
  }, [fetchBattles, fetchStats]);

  if (!mounted) return <main className="min-h-screen" style={{ background: "#040410" }} />;

  const liveBattleCount = battles.length;
  const totalBattleCount = Number(stats.battles || battles.length || 0);
  const battleCount = liveBattleCount || totalBattleCount;
  const playerCount = Number(stats.players || 0) || battles.reduce((n, b) => n + Number(b.players || 0), 0);

  return (
    <main className="min-h-screen overflow-x-hidden text-white" style={{ background: "#030208" }}>
      <style>{`
        @keyframes hp-timer-blink{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes hp-hero-glow{0%{opacity:.5}100%{opacity:.9}}
        @keyframes hp-line-scan{0%{background-position:0%}100%{background-position:200%}}
        @keyframes hp-fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes hp-shimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
        html,body{overflow-x:hidden}
        input,select,textarea{font-size:16px!important}
        button:active{opacity:.88;transform:scale(.97)}
      `}</style>

      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0" style={{
        background: "radial-gradient(circle at 50% 0%,rgba(249,115,22,.14),transparent 40%),radial-gradient(circle at 100% 60%,rgba(20,184,166,.06),transparent 30%),radial-gradient(circle at 0% 80%,rgba(168,85,247,.05),transparent 28%)",
      }} />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{
        background: "rgba(3,2,8,.95)",
        borderColor: "rgba(249,115,22,.12)",
        boxShadow: "0 1px 20px rgba(0,0,0,.5)",
      }}>
        <div className="h-[1.5px]" style={{ background: "linear-gradient(90deg,transparent,rgba(249,115,22,.55),rgba(251,191,36,.35),transparent)" }} />
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button onClick={() => router.push("/")} className="flex items-center gap-2.5">
            <div className="relative">
              <img src={C.LOGO} className="h-9 w-9 rounded-full border border-orange-500/25 object-cover bg-white"
                alt="MemeRush" onError={e => (e.currentTarget.src = fallbackLogo("MR"))} />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black" />
            </div>
            <div>
              <span className="text-base font-black" style={{
                background: "linear-gradient(90deg,#f97316,#fbbf24,#f97316)", backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "hp-shimmer 3s linear infinite",
              }}>MemeRush</span>
              <p className="text-[9px] text-slate-600 leading-none mt-0.5">Solana Mainnet · PvP Arena</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {battleCount > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black"
                style={{ background: "rgba(249,115,22,.1)", border: "1px solid rgba(249,115,22,.2)", color: "#fb923c" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />{battleCount} LIVE
              </div>
            )}
            <button onClick={() => router.push("/trade")}
              className="rounded-xl px-5 py-2.5 text-sm font-black text-white active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#ea580c,#f97316)", boxShadow: "0 0 20px rgba(249,115,22,.4)" }}>
              Enter Arena ⚔️
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-4">

        {/* ── HERO ── */}
        <section className="relative py-12 text-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 30%,rgba(249,115,22,.10),transparent)",
            animation: "hp-hero-glow 4s ease-in-out infinite alternate",
          }} />

          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[.16em]"
            style={{ background: "rgba(249,115,22,.08)", border: "1px solid rgba(249,115,22,.22)", color: "#fb923c" }}>
            <span className="h-2 w-2 animate-ping rounded-full bg-orange-500 inline-block" />
            {liveBattleCount ? `${liveBattleCount} Live Battles` : "Live MVP on Solana"}
          </div>

          <p className="text-xs font-black uppercase tracking-[.22em] text-slate-500 mb-3">Realtime PvP Meme Trading Arena</p>

          <h1 className="text-4xl font-black leading-[.95] tracking-tight sm:text-6xl">
            <span style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Pick a side.
            </span>
            <br />
            <span className="text-white">Beat the timer.</span>
            <br />
            <span className="text-white">Claim the pool.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-base font-semibold leading-relaxed text-slate-400">
            A live PvP meme coin arena on Solana. Start from{" "}
            <span className="text-white font-bold">{C.MIN_SOL} SOL ({C.MIN_USD})</span>,
            pick a token side, and let verified price movement decide the winner.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => router.push("/trade")}
              className="rounded-2xl px-8 py-4 text-lg font-black text-white active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#ea580c,#f97316)", boxShadow: "0 0 40px rgba(249,115,22,.50)", animation: "hp-cta-breathe 2.4s ease-in-out infinite" }}>
              ⚔️ Enter Arena
            </button>
            <button onClick={() => router.push("/demo")}
              className="rounded-2xl border px-8 py-4 text-lg font-black text-emerald-300 active:scale-95 transition-all"
              style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)", boxShadow: "0 0 20px rgba(16,185,129,.12)" }}>
              🧪 Try Demo
            </button>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">
            No signup · No KYC · Wallet identity · Demo available before deposit
          </p>
        </section>

        {/* ── STATS ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: statsLoaded ? Number(stats.paidSol ?? 0).toFixed(2) : "—", l: "SOL Paid", c: "#4ade80", bg: "rgba(34,197,94,.07)", border: "rgba(34,197,94,.14)" },
            { v: statsLoaded ? Number(stats.volSol ?? 0).toFixed(1) : "—", l: "SOL Volume", c: "#fbbf24", bg: "rgba(250,204,21,.07)", border: "rgba(250,204,21,.12)" },
            { v: statsLoaded ? String(totalBattleCount || liveBattleCount) : "—", l: "Battles", c: "#f97316", bg: "rgba(249,115,22,.07)", border: "rgba(249,115,22,.14)" },
            { v: statsLoaded ? String(playerCount || "—") : "—", l: "Players", c: "#67e8f9", bg: "rgba(103,232,249,.06)", border: "rgba(103,232,249,.12)" },
          ].map(s => (
            <div key={s.l} className="rounded-2xl border p-4 text-center transition-all"
              style={{ background: s.bg, borderColor: s.border, boxShadow: statsLoaded ? `0 0 14px ${s.bg}` : "none" }}>
              <div className="text-2xl font-black tabular-nums" style={{ color: s.c }}>{s.v}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{s.l}</div>
            </div>
          ))}
        </div>

        {/* ── DEMO BANNER ── */}
        <div className="mb-8 rounded-2xl border p-5 overflow-hidden relative"
          style={{ background: "rgba(3,22,13,.85)", border: "1px solid rgba(16,185,129,.18)", boxShadow: "0 0 28px rgba(16,185,129,.07)" }}>
          <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full blur-3xl opacity-30"
            style={{ background: "rgba(16,185,129,.4)" }} />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full border border-emerald-400/22 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-3">
                ✅ Free Demo Mode
              </span>
              <h2 className="text-lg font-black text-white">Try the battle loop before depositing.</h2>
              <p className="mt-1 text-sm text-slate-500 max-w-xs">No wallet, no payment. Same battle flow — perfect for first-time users and hackathon judges.</p>
            </div>
            <button onClick={() => router.push("/demo")}
              className="flex-shrink-0 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-6 py-3 font-black text-emerald-300 active:scale-95 transition-all whitespace-nowrap"
              style={{ boxShadow: "0 0 16px rgba(16,185,129,.15)" }}>
              Open Demo →
            </button>
          </div>
        </div>

        {/* ── LIVE BATTLE FEED ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="relative flex w-3 h-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-55 animate-ping" />
                <span className="relative inline-flex w-3 h-3 rounded-full bg-orange-500" />
              </span>
              <h2 className="text-sm font-black uppercase tracking-[.2em] text-orange-300">Live Battle Feed</h2>
              {liveBattleCount > 0 && (
                <span className="text-[10px] font-bold text-slate-600">{liveBattleCount} active</span>
              )}
            </div>
            <button onClick={() => router.push("/trade")}
              className="text-sm font-bold text-slate-500 hover:text-orange-400 transition-colors">
              View all →
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(battles.length ? battles : Array.from({ length: 4 }).map((_, i) => ({
              id: String(i), token_a: ["BONK","PEPE","MRUSH","BOME"][i], token_b: ["WIF","SOL","POPCAT","MYRO"][i],
              prize_pool: 0.001 + i * 0.002, players: i + 1,
              end_time: new Date(Date.now() + (i + 2) * 70000).toISOString(),
            }))).map((b, i) => (
              <div key={b.id} style={{ animation: `hp-fade-up .25s ease-out ${i * 0.04}s both` }}>
                <MiniBattle b={b} onJoin={() => router.push(`/trade?battle=${b.id}`)} />
              </div>
            ))}
          </div>
        </section>

        {/* ── TRUST + STATUS ── */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {/* Trust */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: "rgba(6,6,18,.96)", border: "1px solid rgba(255,255,255,.06)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,.05)", background: "rgba(15,15,30,.5)" }}>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-400">Why users can trust the battle</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                ["🔗", "Treasury visible", "Real entries route through a public Solana treasury wallet for easier verification."],
                ["📊", "Clear winner logic", "Each battle compares token percentage movement from battle start to finish."],
                ["🔐", "Wallet-first flow", "Users keep custody and sign their own actions. Demo stays separate from real entries."],
              ].map(([e, t, d]) => (
                <div key={t} className="flex gap-3 p-3 rounded-xl border border-white/[.05]"
                  style={{ background: "rgba(255,255,255,.02)" }}>
                  <span className="text-xl flex-shrink-0">{e}</span>
                  <div>
                    <h3 className="font-black text-white text-sm">{t}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch Status */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: "rgba(6,6,18,.96)", border: "1px solid rgba(255,255,255,.06)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,.05)", background: "rgba(15,15,30,.5)" }}>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-400">Launch status</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { t: "Battle Engine", d: "Live MVP battle feed", s: "Online", c: "emerald" },
                { t: "Treasury Wallet", d: short(C.TREASURY), s: "Public", c: "emerald" },
                { t: "Hybrid Mainnet", d: "MVP live while full mainnet polish continues", s: "Active", c: "orange" },
                { t: "MRUSH Token", d: "Rewards, fees, and perks planned", s: "Soon", c: "slate" },
              ].map(item => (
                <div key={item.t} className="flex items-center justify-between py-2 border-b border-white/[.04] last:border-0">
                  <div>
                    <h3 className="font-black text-white text-sm">{item.t}</h3>
                    <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{item.d}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black flex-shrink-0 ${
                    item.c === "emerald" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
                    item.c === "orange" ? "bg-orange-500/10 text-orange-300 border border-orange-500/20" :
                    "bg-slate-500/10 text-slate-500 border border-slate-500/15"
                  }`}>{item.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div className="mb-8 rounded-2xl border overflow-hidden"
          style={{ background: "rgba(6,6,18,.96)", border: "1px solid rgba(255,255,255,.06)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,.05)", background: "rgba(15,15,30,.5)" }}>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-400">How it works</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-white/[.04] sm:divide-y-0">
            {[
              { n: "01", t: "Connect Wallet", e: "🔗", d: "Phantom, Solflare, or Mobile Wallet" },
              { n: "02", t: "Join Battle", e: "⚔️", d: "Pick your token side and entry amount" },
              { n: "03", t: "Token Race", e: "📈", d: "Realtime % movement tracked on-chain" },
              { n: "04", t: "Winner Paid", e: "💸", d: "Pool routed to winner wallet on-chain" },
            ].map((s, i) => (
              <div key={s.n} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{s.e}</span>
                  <span className="text-[10px] font-black text-slate-700">{s.n}</span>
                </div>
                <h3 className="font-black text-white text-sm">{s.t}</h3>
                <p className="mt-1 text-[11px] text-slate-600 leading-snug">{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="border-t border-orange-500/10 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <img src={C.LOGO} className="h-7 w-7 rounded-full bg-white object-cover" alt="MemeRush"
                onError={e => (e.currentTarget.src = fallbackLogo("MR"))} />
              <span className="font-black text-orange-300">MemeRush</span>
              <span className="text-sm text-slate-700">· Solana Mainnet · 2026</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "X Twitter", href: C.TWITTER, color: "rgba(255,255,255,.08)", text: "#94a3b8" },
                { label: "Telegram", href: C.TELEGRAM, color: "rgba(34,211,238,.08)", text: "#67e8f9" },
                { label: "Discord", href: C.DISCORD, color: "rgba(99,102,241,.08)", text: "#a5b4fc" },
                { label: "Treasury", href: `https://solscan.io/account/${C.TREASURY}`, color: "rgba(34,197,94,.08)", text: "#86efac" },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                  className="rounded-xl px-4 py-2 text-sm font-bold transition-all"
                  style={{ background: l.color, border: `1px solid ${l.color}`, color: l.text }}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <p className="mt-5 text-xs text-slate-700">© 2026 MemeRush · Experimental PvP trading game. High risk. DYOR. Not financial advice.</p>
        </footer>
      </div>
    </main>
  );
}
