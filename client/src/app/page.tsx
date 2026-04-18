"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── SHARED THEME (inline — same tokens as lib/theme.ts) ──────────────────────
const G = {
  primary:     'linear-gradient(135deg,#ea580c,#f97316)',
  primarySoft: 'linear-gradient(135deg,rgba(234,88,12,.6),rgba(249,115,22,.4))',
  brand:       'linear-gradient(90deg,#fb923c,#fbbf24)',
  barNormal:   'linear-gradient(90deg,#f97316,#fbbf24)',
  barUrgent:   'linear-gradient(90deg,#ef4444,#f97316)',
  accentOrange:'linear-gradient(90deg,transparent,#f97316,transparent)',
};
const S = {
  primaryBtn:   '0 0 0 1px rgba(255,255,255,.08),0 8px 40px rgba(249,115,22,.55),0 3px 14px rgba(234,88,12,.3)',
  primaryBtnSm: '0 0 14px rgba(249,115,22,.4)',
};

// ── CONFIG ────────────────────────────────────────────────────────────────────
const C = {
  TREASURY: process.env.NEXT_PUBLIC_TREASURY_WALLET ?? 'Fwsyjj7sf64MxCNfkysQ4UoJbE1MYXBe7dp35Czd5Vew',
  MRUSH_MINT: process.env.NEXT_PUBLIC_MRUSH_MINT ?? 'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  TWITTER:  'https://x.com/memerusharena',
  TELEGRAM: 'https://t.me/memerusharena',
  DISCORD:  'https://discord.gg/xWYWxe5wxG',
  LOGO:     '/logomeme.png',
  SITE:     process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.meemerush.xyz',
  MIN_SOL:  '0.001',
  MIN_USD:  '~$0.10',
};

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface ApiBattle {
  id: string; token_a: string; token_b: string;
  prize_pool: number; players: number; status: 'live'|'ended'|'paid';
  end_time?: string; start_time?: string;
  mode: 'arena'|'real'; type?: 'system'|'user'; creator: string;
}
interface ApiStats {
  players?: number; battles?: number; volSol?: number; paidSol?: number;
}

// ── TOKEN LOGOS ───────────────────────────────────────────────────────────────
const TOKEN_LOGOS: Record<string,string> = {
  BONK:   'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',
  WIF:    'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg',
  POPCAT: 'https://assets.coingecko.com/coins/images/33908/large/popcat.png',
  BOME:   'https://assets.coingecko.com/coins/images/35215/large/bome.png',
  MYRO:   'https://assets.coingecko.com/coins/images/33427/large/myro.png',
  SOL:    'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  PEPE:   'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
  MRUSH:  `https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c`,
};
const logo = (s: string) => TOKEN_LOGOS[s] ?? `https://ui-avatars.com/api/?name=${s}&background=ea580c&color=fff&size=40`;

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useCountdown(end: string|undefined) {
  const calc = () => end ? Math.max(0, Math.floor((new Date(end).getTime()-Date.now())/1000)) : 0;
  const [s, setS] = useState(calc);
  useEffect(()=>{ setS(calc()); const id=setInterval(()=>setS(calc()),1000); return ()=>clearInterval(id); },[end]);
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  return { display:`${m}:${sec}`, urgent: s>0&&s<120, expired: s===0 };
}

// ── BATTLE CARD ───────────────────────────────────────────────────────────────
function BattleCard({ b, go }: { b: ApiBattle; go: ()=>void }) {
  const { display, urgent } = useCountdown(b.end_time);
  const isReal = b.mode === 'real';
  const [chA, setChA] = useState(()=>(Math.random()-.48)*4);
  const [chB, setChB] = useState(()=>(Math.random()-.52)*4);
  useEffect(()=>{
    const id = setInterval(()=>{
      setChA(p=>parseFloat((p+(Math.random()-.5)*.25).toFixed(3)));
      setChB(p=>parseFloat((p+(Math.random()-.5)*.25).toFixed(3)));
    }, 2000);
    return ()=>clearInterval(id);
  },[]);
  const aL = chA > chB;
  const diff = Math.abs(chA-chB).toFixed(2);
  const dur = (b.start_time&&b.end_time) ? (new Date(b.end_time).getTime()-new Date(b.start_time).getTime())/1000 : 300;
  const pct = b.end_time ? Math.min(100,Math.max(0,(1-Math.max(0,(new Date(b.end_time).getTime()-Date.now())/1000)/dur)*100)) : 50;

  return (
    <div onClick={go} className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-[.98]"
      style={{
        background: isReal ? 'linear-gradient(180deg,rgba(20,8,2,.99),rgba(8,4,1,.99))' : 'linear-gradient(180deg,rgba(10,10,22,.99),rgba(5,5,14,.99))',
        border: `1px solid ${urgent?'rgba(239,68,68,.55)':isReal?'rgba(249,115,22,.28)':b.players>=3?'rgba(249,115,22,.18)':'rgba(30,41,59,.55)'}`,
        boxShadow: urgent
          ? '0 0 24px rgba(239,68,68,.18), 0 4px 20px rgba(0,0,0,.6)'
          : isReal
            ? '0 4px 24px rgba(249,115,22,.14)'
            : b.players>=3
              ? '0 0 14px rgba(249,115,22,.08)'
              : 'none',
      }}>
      {/* Top accent */}
      <div className="h-[1.5px]" style={{background: urgent?G.barUrgent:isReal?G.accentOrange:'linear-gradient(90deg,transparent,rgba(71,85,105,.3),transparent)'}}/>
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{background:'radial-gradient(ellipse at 50% 0%,rgba(249,115,22,.04),transparent 70%)'}}/>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-0">
        <div className="flex items-center gap-1.5">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{background:urgent?'#ef4444':'#f97316'}}/>
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{background:urgent?'#ef4444':'#f97316'}}/>
          </span>
          {isReal
            ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{background:'rgba(120,53,15,.55)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.25)'}}>💰 REAL</span>
            : b.players>=3
              ? <span className="text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse" style={{background:'rgba(234,88,12,.35)',color:'#fb923c',border:'1px solid rgba(249,115,22,.45)',boxShadow:'0 0 8px rgba(249,115,22,.3)'}}>🔥 HOT</span>
              : <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{background:'rgba(30,41,59,.5)',color:'rgba(71,85,105,1)'}}>AUTO</span>
          }
          <span className="text-[9px] text-slate-600">· {b.players} in</span>
        </div>
        <span className={`font-mono font-black text-sm tabular-nums px-2 py-0.5 rounded-lg ${urgent?'text-red-400 animate-pulse':''}`}
          style={{color:urgent?'#f87171':'#fb923c',background:urgent?'rgba(239,68,68,.1)':'rgba(30,15,5,.6)'}}>
          {display}
        </span>
      </div>

      {/* VS layout */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-2.5 items-center">
        <div className={`rounded-xl p-2.5 border transition-all ${aL?'border-orange-500/30':'border-white/5'}`}
          style={{background:aL?'rgba(249,115,22,.07)':'rgba(255,255,255,.02)'}}>
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <img src={logo(b.token_a)} alt={b.token_a} className="w-9 h-9 rounded-full border-2" style={{borderColor:aL?'rgba(249,115,22,.5)':'rgba(255,255,255,.1)'}} onError={e=>(e.target as HTMLImageElement).src=logo(b.token_a)}/>
              {aL&&<div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-black" style={{background:'#f97316'}}>▲</div>}
            </div>
            <div>
              <p className="font-black text-white text-sm leading-none">{b.token_a}</p>
              <p className={`text-xs font-black mt-0.5 tabular-nums ${chA>=0?'text-emerald-400':'text-red-400'}`}>{chA>=0?'+':''}{chA.toFixed(2)}%</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5 px-1">
          <div className="w-7 h-7 rounded-full border flex items-center justify-center text-[8px] font-black" style={{background:'rgba(20,12,4,.8)',borderColor:'rgba(249,115,22,.12)',color:'rgba(249,115,22,.5)'}}>VS</div>
          {parseFloat(diff)>0.01&&<span className="text-[8px] font-black tabular-nums" style={{color:aL?'#4ade80':'#f97316'}}>{parseFloat(diff).toFixed(2)}%</span>}
        </div>

        <div className={`rounded-xl p-2.5 border transition-all ${!aL?'border-orange-500/30':'border-white/5'}`}
          style={{background:!aL?'rgba(249,115,22,.07)':'rgba(255,255,255,.02)'}}>
          <div className="flex items-center gap-2 flex-row-reverse">
            <div className="relative flex-shrink-0">
              <img src={logo(b.token_b)} alt={b.token_b} className="w-9 h-9 rounded-full border-2" style={{borderColor:!aL?'rgba(249,115,22,.5)':'rgba(255,255,255,.1)'}} onError={e=>(e.target as HTMLImageElement).src=logo(b.token_b)}/>
              {!aL&&<div className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-black" style={{background:'#f97316'}}>▲</div>}
            </div>
            <div className="text-right">
              <p className="font-black text-white text-sm leading-none">{b.token_b}</p>
              <p className={`text-xs font-black mt-0.5 tabular-nums ${chB>=0?'text-emerald-400':'text-red-400'}`}>{chB>=0?'+':''}{chB.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-3 mb-1 h-[2px] rounded-full overflow-hidden" style={{background:'rgba(30,15,5,.6)'}}>
        <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`,background:urgent?G.barUrgent:pct>70?'linear-gradient(90deg,#ef4444,#f97316)':G.barNormal}}/>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm tabular-nums" style={{color:'#fbbf24'}}>{b.prize_pool.toFixed(3)}</span>
          <span className="text-[9px] font-bold text-amber-700">SOL</span>
          <span className="text-slate-700 text-[9px]">·</span>
          <span className="flex items-center gap-1 text-[10px] font-bold" style={{color:'rgba(249,115,22,.8)'}}>
            <span>👥</span>{b.players}
          </span>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white transition-all group-hover:scale-105 active:scale-95" style={{background:'linear-gradient(135deg,rgba(234,88,12,.7),rgba(249,115,22,.5))',border:'1px solid rgba(249,115,22,.3)'}}>
          Join ⚔️
        </span>
      </div>
    </div>
  );
}

// Assign missing constant after component def
// accentOrange is now defined directly in G

// ── SKELETON ──────────────────────────────────────────────────────────────────
function BattleCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{background:'rgba(10,10,22,.98)',borderColor:'rgba(30,15,5,.6)'}}>
      <div className="px-4 pt-3 pb-0 flex justify-between">
        <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse"/>
        <div className="h-5 w-14 rounded-full animate-pulse" style={{background:'rgba(249,115,22,.1)'}}/>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-3">
        <div className="h-14 rounded-xl animate-pulse" style={{background:'rgba(249,115,22,.05)'}}/>
        <div className="w-7 h-7 self-center rounded-full animate-pulse" style={{background:'rgba(249,115,22,.08)'}}/>
        <div className="h-14 rounded-xl animate-pulse" style={{background:'rgba(249,115,22,.05)'}}/>
      </div>
      <div className="px-4 pb-4 flex justify-between">
        <div className="h-2.5 w-20 bg-white/5 rounded-full animate-pulse"/>
        <div className="h-2.5 w-14 bg-white/5 rounded-full animate-pulse"/>
      </div>
    </div>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, decimals=0, suffix='' }: { value:number; label:string; decimals?:number; suffix?:string }) {
  const [display, setDisplay] = useState(0);
  useEffect(()=>{
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1,(now-start)/700);
      const ease = 1-Math.pow(1-t,3);
      setDisplay(from+(value-from)*ease);
      if(t<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },[value]);
  return (
    <div className="rounded-xl p-3 text-center border" style={{background:'rgba(10,10,22,.98)',borderColor:'rgba(249,115,22,.08)'}}>
      <p className="font-black text-base tabular-nums leading-none" style={{color:'#fb923c'}}>{display.toFixed(decimals)}{suffix}</p>
      <p className="text-[9px] mt-1 uppercase tracking-wide" style={{color:'rgba(71,85,105,1)'}}>{label}</p>
    </div>
  );
}

// ── INFRA ROW ─────────────────────────────────────────────────────────────────
function InfraRow({ label, status, note, pct }: { label:string; status:'online'|'building'|'planned'; note:string; pct?:number }) {
  const col = status==='online'?'#4ade80':status==='building'?'#f97316':'#475569';
  const bg  = status==='online'?'rgba(74,222,128,.07)':status==='building'?'rgba(249,115,22,.07)':'rgba(71,85,105,.06)';
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[.04] last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status==='online'?'bg-emerald-400':status==='building'?'animate-pulse':'bg-slate-700'}`} style={{background:status==='building'?'#f97316':undefined}}/>
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-300 truncate">{label}</div>
          <div className="text-[10px] text-slate-600 truncate">{note}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pct!==undefined&&<div className="w-14 h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.06)'}}><div className="h-full rounded-full" style={{width:`${pct}%`,background:col}}/></div>}
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{background:bg,color:col}}>{status==='online'?'ONLINE':status==='building'?'BUILDING':'PLANNED'}</span>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [mounted,        setMounted]        = useState(false);
  const [battles,        setBattles]        = useState<ApiBattle[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [totalVol,       setTotalVol]       = useState(0);
  const [totalPaid,      setTotalPaid]      = useState(0);
  const [totalPlayers,   setTotalPlayers]   = useState(0);
  const [totalBattles,   setTotalBattles]   = useState(0);

  const go = useCallback(()=>router.push('/trade'),[router]);

  const fetchBattles = useCallback(async ()=>{
    try {
      const res  = await fetch('/api/battles?status=live&limit=6',{cache:'no-store'});
      const data = await res.json() as {battles?:ApiBattle[]};
      setBattles((data.battles??[]).filter(b=>b.status==='live'));
    } catch {}
    finally { setLoading(false); }
  },[]);

  const fetchStats = useCallback(async ()=>{
    try {
      const res  = await fetch('/api/stats',{cache:'no-store'});
      const data = await res.json() as ApiStats;
      if(data.players!==undefined)  setTotalPlayers(data.players);
      if(data.battles!==undefined)  setTotalBattles(data.battles);
      if(data.volSol!==undefined)   setTotalVol(data.volSol);
      if(data.paidSol!==undefined)  setTotalPaid(data.paidSol);
    } catch {}
  },[]);

  useEffect(()=>{
    setMounted(true);
    fetchBattles();
    fetchStats();
    const i1=setInterval(fetchBattles,10_000);
    const i2=setInterval(fetchStats,30_000);
    return ()=>{ clearInterval(i1); clearInterval(i2); };
  },[fetchBattles,fetchStats]);

  if(!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#040410'}}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{borderColor:'#f97316',borderTopColor:'transparent'}}/>
        <span className="text-[9px] tracking-[.25em] uppercase font-mono" style={{color:'rgba(71,85,105,1)'}}>Loading Arena</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{background:'#040410'}}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[.04] backdrop-blur-xl" style={{background:'rgba(5,3,1,.94)'}}>
        <div className="max-w-5xl mx-auto px-4 h-11 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img src={C.LOGO} alt="MemeRush" className="w-6 h-6 rounded-full object-cover" onError={e=>(e.target as HTMLImageElement).style.display='none'}/>
            <span className="text-sm font-black bg-clip-text text-transparent" style={{backgroundImage:G.brand}}>MemeRush</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black tracking-[.12em] uppercase" style={{background:'rgba(249,115,22,.06)',borderColor:'rgba(249,115,22,.18)',color:'#fb923c'}}>
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{background:'#f97316'}}/>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{background:'#f97316'}}/>
            </span>
            LIVE · Solana Mainnet
          </div>
          <button onClick={go} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black text-white transition-all hover:opacity-90 active:scale-95 shrink-0 mr-glow-btn" style={{background:G.primary,boxShadow:S.primaryBtnSm}}>
            ⚔️ ENTER ARENA
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8 pb-28 space-y-8">

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section className="relative py-14 px-6 text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[.18]"
              style={{background:'radial-gradient(ellipse,#ea580c 0%,#f97316 40%,transparent 80%)'}}/>
          </div>
          <div className="relative z-10 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black mb-6" style={{background:'rgba(249,115,22,.08)',borderColor:'rgba(249,115,22,.2)',color:'#f97316'}}>
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{background:'#f97316'}}/>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{background:'#f97316'}}/>
              </span>
              {battles.length>0?`${battles.length} LIVE BATTLES NOW`:'LIVE ON SOLANA MAINNET'}
            </div>
            <h1 className="text-[clamp(28px,7vw,52px)] font-black leading-[1.04] tracking-tight mb-4">
              <span className="bg-clip-text text-transparent" style={{backgroundImage:G.brand}}>Battle Memecoins.</span>
              <br/>
              <span className="text-white">Win the Pool.</span>
            </h1>
            <p className="text-[13px] mb-8 leading-relaxed" style={{color:'rgba(100,116,139,1)'}}>
              Pick a token, join a battle from{' '}
              <span className="text-white font-semibold">{C.MIN_SOL} SOL ({C.MIN_USD})</span>
              {' '}— winner takes pool, paid instantly on-chain.
            </p>
            <button onClick={go} className="inline-flex items-center gap-3 px-12 py-4 rounded-2xl text-lg font-black text-white transition-all hover:scale-[1.04] active:scale-95 mr-glow-btn"
              style={{background:G.primary,boxShadow:S.primaryBtn}}>
              ⚔️ ENTER ARENA
            </button>
            <p className="text-[11px] mt-4" style={{color:'rgba(71,85,105,1)'}}>No signup · No KYC · Wallet = identity</p>
            {/* Social icons under CTA */}
            <div className="flex items-center justify-center gap-3 mt-5">
              {[
                {label:'𝕏',       href:C.TWITTER,  bg:'rgba(255,255,255,.06)', border:'rgba(255,255,255,.1)'},
                {label:'TG',      href:C.TELEGRAM, bg:'rgba(8,145,178,.09)',   border:'rgba(8,145,178,.22)'},
                {label:'Discord', href:C.DISCORD,  bg:'rgba(88,101,242,.09)',  border:'rgba(88,101,242,.22)'},
              ].map(l=>(
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border flex items-center justify-center text-[11px] font-black text-white hover:scale-110 transition-all"
                  style={{background:l.bg,borderColor:l.border}}>{l.label}</a>
              ))}
            </div>
          </div>
        </section>

        {/* ── TICKER BAR ───────────────────────────────────────────────────── */}
        <section>
          <div className="rounded-xl border px-4 py-2.5 flex items-center gap-3 overflow-x-auto scrollbar-none" style={{background:'rgba(8,4,2,.97)',borderColor:'rgba(249,115,22,.08)'}}>
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{background:'#f97316'}}/>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{background:'#f97316'}}/>
              </span>
              <span className="text-[9px] font-black tracking-[.18em] uppercase" style={{color:'#fb923c'}}>Live</span>
            </div>
            <div className="w-px h-4 shrink-0" style={{background:'rgba(249,115,22,.12)'}}/>
            <div className="flex items-center gap-4 text-[11px] font-bold whitespace-nowrap">
              <span style={{color:'#f97316'}}>{battles.length} Battles</span>
              <span style={{color:'#fbbf24'}}>{totalVol.toFixed(1)} SOL Vol</span>
              <span style={{color:'#fb923c'}}>{totalPlayers} Players</span>
              <span style={{color:'rgba(100,116,139,.8)'}}>Solana Mainnet</span>
            </div>
            <div className="ml-auto shrink-0 flex items-center gap-1.5 text-[10px] font-mono" style={{color:'rgba(71,85,105,1)'}}>
              <span className="w-1.5 h-1.5 rounded-full" style={{background:'#f97316'}}/>
              Mainnet
            </div>
          </div>
        </section>

        {/* ── STAT COUNTERS ─────────────────────────────────────────────────── */}
        <section className="grid grid-cols-4 gap-3">
          <StatCard value={totalPaid}    label="Total Paid"  decimals={2} suffix=" SOL"/>
          <StatCard value={totalVol}     label="Volume"      decimals={1} suffix=" SOL"/>
          <StatCard value={totalBattles} label="Battles"/>
          <StatCard value={totalPlayers} label="Players"/>
        </section>

        {/* ── LIVE BATTLE FEED ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{background:'#f97316'}}/>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{background:'#f97316'}}/>
              </span>
              <span className="text-[9px] font-black tracking-[.16em] uppercase" style={{color:'#fb923c'}}>Live Battle Feed</span>
              {!loading&&battles.length>0&&(
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{background:'rgba(249,115,22,.1)',color:'#f97316',border:'1px solid rgba(249,115,22,.2)'}}>
                  {battles.length} active
                </span>
              )}
            </div>
            <button onClick={go} className="text-[11px] font-medium transition-colors hover:text-orange-400" style={{color:'rgba(71,85,105,1)'}}>
              View all →
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <BattleCardSkeleton/><BattleCardSkeleton/><BattleCardSkeleton/>
            </div>
          ) : battles.length>0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {battles.slice(0,6).map(b=><BattleCard key={b.id} b={b} go={go}/>)}
            </div>
          ) : (
            <div className="rounded-2xl border py-12 text-center" style={{background:'rgba(10,10,22,.98)',borderColor:'rgba(249,115,22,.08)'}}>
              <div className="relative mx-auto w-10 h-10 mb-4">
                <div className="absolute inset-0 rounded-full border-2 animate-ping" style={{borderColor:'rgba(249,115,22,.3)'}}/>
                <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:'#f97316',borderTopColor:'transparent'}}/>
              </div>
              <p className="text-sm font-black text-white mb-1">🔥 Spawning battles…</p>
              <p className="text-xs mb-5" style={{color:'rgba(71,85,105,1)'}}>System generates battles automatically</p>
              <button onClick={go} className="px-6 py-3 rounded-xl text-sm font-black text-white active:scale-95" style={{background:G.primary}}>Check Arena →</button>
            </div>
          )}
        </section>

        {/* ── CTA BLOCK ────────────────────────────────────────────────────── */}
        <section className="relative rounded-2xl border overflow-hidden" style={{background:'linear-gradient(135deg,rgba(120,53,15,.2),rgba(9,9,24,.98))',borderColor:'rgba(249,115,22,.15)'}}>
          <div className="absolute top-0 inset-x-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(249,115,22,.5),transparent)'}}/>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 px-7 py-6">
            <div>
              <p className="text-[9px] font-black tracking-[.16em] uppercase mb-2" style={{color:'#f97316'}}>Minimum Entry</p>
              <div className="text-[34px] font-black text-white leading-none tracking-tight mb-2">
                {C.MIN_SOL} <span className="text-xl font-bold" style={{color:'rgba(148,163,184,1)'}}>SOL</span>
                <span className="text-sm font-semibold ml-2" style={{color:'rgba(71,85,105,1)'}}>{C.MIN_USD}</span>
              </div>
              <p className="text-[11px]" style={{color:'rgba(71,85,105,1)'}}>No registration · No verification · Winner takes pool minus 2%</p>
            </div>
            {/* Badge instead of duplicate button */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="px-4 py-2.5 rounded-full border text-[11px] font-black text-center" style={{background:'rgba(249,115,22,.08)',borderColor:'rgba(249,115,22,.25)',color:'#fb923c'}}>
                Built on Solana • Live Mainnet
              </div>
              <a href={`https://solscan.io/account/${C.TREASURY}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono hover:text-orange-400 transition-colors" style={{color:'rgba(71,85,105,1)'}}>
                {C.TREASURY.slice(0,6)}…{C.TREASURY.slice(-4)} ↗
              </a>
            </div>
          </div>
        </section>

        {/* ── STATUS ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border p-5" style={{background:'rgba(8,4,2,.97)',borderColor:'rgba(249,115,22,.06)'}}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#f97316'}}/>
              <span className="text-[9px] font-black tracking-[.16em] uppercase" style={{color:'rgba(71,85,105,1)'}}>Infrastructure</span>
            </div>
            <div>
              <InfraRow label="Battle Engine"   status="online"   note="Auto-generating · 24/7"/>
              <InfraRow label="Treasury Wallet" status="online"   note="Public · Solscan verified"/>
              <InfraRow label="Supabase DB"     status="online"   note="Realtime battle state"/>
              <InfraRow label="Auto Settlement" status="online"   note="Winner paid on-chain"/>
              <InfraRow label="Mainnet Live"    status="building" note="Active · Final polish" pct={93}/>
            </div>
          </section>

          <section className="rounded-2xl border p-5" style={{background:'rgba(8,4,2,.97)',borderColor:'rgba(249,115,22,.06)'}}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#f97316'}}/>
              <span className="text-[9px] font-black tracking-[.16em] uppercase" style={{color:'rgba(71,85,105,1)'}}>Build Progress</span>
            </div>
            <div className="space-y-4">
              {[
                {label:'Devnet Testing',      pct:100, s:'done'     as const, note:'✓ Completed'},
                {label:'Mainnet Integration', pct:93,  s:'building' as const, note:'93% · Active'},
                {label:'Public Launch',       pct:25,  s:'building' as const, note:'Soon'},
                {label:'Voting / Staking',    pct:0,   s:'planned'  as const, note:'Planned'},
              ].map(r=>{
                const col=r.s==='done'?'#4ade80':r.s==='building'?'#f97316':'#374151';
                return (
                  <div key={r.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:col}}/>
                        <span className="text-xs font-bold text-slate-300">{r.label}</span>
                      </div>
                      <span className="text-[10px] font-black shrink-0 ml-2" style={{color:col}}>{r.note}</span>
                    </div>
                    <div className="h-0.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.05)'}}>
                      <div className="h-full rounded-full" style={{width:`${r.pct}%`,background:col,transition:'width .6s ease'}}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-white/[.04]">
              <a href={`https://solscan.io/account/${C.TREASURY}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group text-xs">
                <span style={{color:'rgba(71,85,105,1)'}}>Treasury wallet (public)</span>
                <span className="font-mono text-[11px] group-hover:text-orange-400 transition-colors truncate ml-2 max-w-[180px]" style={{color:'rgba(100,116,139,1)'}}>{C.TREASURY.slice(0,8)}...{C.TREASURY.slice(-6)} →</span>
              </a>
            </div>
          </section>
        </div>

        {/* ── WHY MEMEРUSH IS FAIR ─────────────────────────────────────────── */}
        <section className="rounded-2xl border p-6" style={{background:'rgba(8,4,2,.97)',borderColor:'rgba(249,115,22,.1)'}}>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[9px] font-black tracking-[.16em] uppercase" style={{color:'rgba(71,85,105,1)'}}>Why MemeRush is Fair</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {icon:'🔗', title:'On-Chain Settlement',   desc:'Every winner payout is executed on Solana — verifiable by anyone on Solscan.'},
              {icon:'🔐', title:'No Custody',            desc:'We never hold your tokens. Your wallet connects directly. You keep full control.'},
              {icon:'📊', title:'Transparent Logic',     desc:'Battle outcome is determined by live % price performance — no manipulation possible.'},
              {icon:'💸', title:'Public Treasury',       desc:'All platform fees go to a public wallet. Anyone can audit transactions in real-time.'},
            ].map(f=>(
              <div key={f.title} className="flex gap-3 p-3.5 rounded-xl border" style={{background:'rgba(255,255,255,.02)',borderColor:'rgba(249,115,22,.07)'}}>
                <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-xs font-black text-white mb-1">{f.title}</p>
                  <p className="text-[11px] leading-relaxed" style={{color:'rgba(100,116,139,1)'}}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <a href={`https://solscan.io/account/${C.TREASURY}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between mt-4 px-4 py-3 rounded-xl border hover:border-orange-500/30 transition-colors group"
            style={{background:'rgba(249,115,22,.04)',borderColor:'rgba(249,115,22,.1)'}}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black" style={{color:'#f97316'}}>💸 Public Treasury Wallet</span>
              <span className="text-[9px]" style={{color:'rgba(71,85,105,1)'}}>· All fees visible on Solscan</span>
            </div>
            <span className="font-mono text-[10px] group-hover:text-orange-400 transition-colors" style={{color:'rgba(71,85,105,1)'}}>
              {C.TREASURY.slice(0,8)}…{C.TREASURY.slice(-6)} →
            </span>
          </a>
        </section>

        {/* ── RUSHTRADE SYSTEM ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border p-6 relative overflow-hidden" style={{background:'rgba(8,4,2,.97)',borderColor:'rgba(249,115,22,.1)'}}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-[.06] pointer-events-none" style={{background:'#f97316'}}/>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black tracking-[.16em] uppercase" style={{color:'rgba(71,85,105,1)'}}>RushTrade</span>
            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black" style={{background:'rgba(249,115,22,.15)',color:'#f97316',border:'1px solid rgba(249,115,22,.25)'}}>POINTS SYSTEM</span>
          </div>
          <h3 className="text-base font-black text-white mb-1">Trade During Live Battles. Earn Points.</h3>
          <p className="text-[12px] mb-4" style={{color:'rgba(100,116,139,1)'}}>RushTrade is only available to active battle participants — no farming without skin in the game.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {icon:'⚔️', title:'Battle First',         desc:'Join any live battle with SOL to unlock RushTrade access for that round.'},
              {icon:'📈', title:'Trade & Earn Points',   desc:'Buy/sell during the live battle window. Active traders accumulate points.'},
              {icon:'🪙', title:'Points → $MRUSH',       desc:'Accumulated points convert to $MRUSH token rewards after each season.'},
              {icon:'🛡️', title:'Anti-Farm Protection',  desc:'Points are only granted to wallets actively joined in a battle. No free rides.'},
            ].map(f=>(
              <div key={f.title} className="flex gap-3 p-3 rounded-xl border" style={{background:'rgba(255,255,255,.02)',borderColor:'rgba(249,115,22,.07)'}}>
                <span className="text-lg shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-xs font-black text-white mb-0.5">{f.title}</p>
                  <p className="text-[11px] leading-relaxed" style={{color:'rgba(100,116,139,1)'}}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── $MRUSH TOKEN UTILITY ─────────────────────────────────────────── */}
        <section className="rounded-2xl border p-6 relative overflow-hidden" style={{background:'linear-gradient(135deg,rgba(12,6,2,.98),rgba(8,4,1,.98))',borderColor:'rgba(249,115,22,.12)'}}>
          <div className="absolute top-0 inset-x-0 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(249,115,22,.4),transparent)'}}/>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black tracking-[.16em] uppercase" style={{color:'rgba(71,85,105,1)'}}>$MRUSH Token</span>
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black" style={{background:'rgba(251,191,36,.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.2)'}}>COMING SOON</span>
              </div>
              <h3 className="text-base font-black text-white">Token Utility Preview</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {icon:'⚔️', t:'Battle Entry',   d:'Pay entry with SOL or MRUSH'},
              {icon:'💹', t:'RushTrade Fees', d:'Reduced fees for MRUSH holders'},
              {icon:'🎁', t:'Earn Rewards',   d:'Incentives for active players'},
              {icon:'🔒', t:'Staking',        d:'Lock MRUSH for future perks'},
            ].map(u=>(
              <div key={u.t} className="p-3 rounded-xl border" style={{background:'rgba(249,115,22,.04)',borderColor:'rgba(249,115,22,.08)'}}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">{u.icon}</span>
                  <p className="text-xs font-black text-white">{u.t}</p>
                </div>
                <p className="text-[10px]" style={{color:'rgba(100,116,139,1)'}}>{u.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border p-6" style={{background:'rgba(8,4,2,.97)',borderColor:'rgba(249,115,22,.06)'}}>
          <p className="text-[9px] font-black tracking-[.16em] uppercase mb-5" style={{color:'rgba(71,85,105,1)'}}>How It Works</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              {n:'01',title:'Connect Wallet',desc:'Phantom, Solflare, any Solana wallet',icon:'🔗'},
              {n:'02',title:'Join a Battle',  desc:'Pick Token A or B from live battles',icon:'⚔️'},
              {n:'03',title:'Token Races',    desc:'Performance % compared live',        icon:'📊'},
              {n:'04',title:'Winner Paid',    desc:'Higher % gain wins. Auto on-chain',  icon:'🏆'},
            ].map(s=>(
              <div key={s.n} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black font-mono" style={{color:'rgba(71,85,105,.6)'}}>{s.n}</span>
                  <span style={{fontSize:'14px'}}>{s.icon}</span>
                </div>
                <p className="text-xs font-black text-white">{s.title}</p>
                <p className="text-[11px] leading-relaxed" style={{color:'rgba(71,85,105,1)'}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── COMMUNITY ─────────────────────────────────────────────────────── */}
        <section className="flex flex-wrap gap-3 justify-center">
          {[
            {label:'𝕏 Twitter', href:C.TWITTER,  bg:'rgba(255,255,255,.06)', border:'rgba(255,255,255,.12)', color:'white'},
            {label:'Telegram',  href:C.TELEGRAM, bg:'rgba(8,145,178,.08)',   border:'rgba(8,145,178,.2)',   color:'#38bdf8'},
            {label:'Discord',   href:C.DISCORD,  bg:'rgba(88,101,242,.08)',  border:'rgba(88,101,242,.2)',  color:'#818cf8'},
          ].map(l=>(
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95"
              style={{background:l.bg,borderColor:l.border,color:l.color}}>
              {l.label}
            </a>
          ))}
        </section>

      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t py-6 backdrop-blur-sm" style={{background:'rgba(5,3,1,.97)',borderColor:'rgba(249,115,22,.06)'}}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <img src={C.LOGO} alt="MemeRush" className="w-5 h-5 rounded-full object-cover" onError={e=>(e.target as HTMLImageElement).style.display='none'}/>
              <span className="font-black text-xs bg-clip-text text-transparent" style={{backgroundImage:G.brand}}>MemeRush</span>
              <span className="text-[11px]" style={{color:'rgba(71,85,105,1)'}}>· Solana Mainnet · 2026</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button onClick={go} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white" style={{background:G.primarySoft}}>⚔️ Arena</button>
              {[
                {label:'Treasury',href:`https://solscan.io/account/${C.TREASURY}`},
                {label:'𝕏',href:C.TWITTER},
                {label:'Telegram',href:C.TELEGRAM},
                {label:'Discord',href:C.DISCORD},
              ].map(l=>(
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-[11px] border hover:text-slate-300 transition-colors" style={{color:'rgba(71,85,105,1)',borderColor:'rgba(255,255,255,.05)'}}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px]" style={{borderColor:'rgba(255,255,255,.04)',color:'rgba(71,85,105,1)'}}>
            <span>© 2026 MemeRush · Built on Solana · Solo dev · No VC</span>
            <span>⚠️ High risk. DYOR. Not financial advice.</span>
          </div>
        </div>
      </footer>

      {/* ── MOBILE BOTTOM BAR ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t backdrop-blur-xl" style={{background:'rgba(5,3,1,.97)',borderColor:'rgba(249,115,22,.08)',paddingBottom:'env(safe-area-inset-bottom)'}}>
        <div className="px-4 py-3">
          <button onClick={go} className="w-full py-4 rounded-2xl text-base font-black text-white transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{background:G.primary,boxShadow:'0 0 32px rgba(249,115,22,.45),0 4px 16px rgba(0,0,0,.4)'}}>
            ⚔️ ENTER ARENA
            <span className="text-[11px] font-bold opacity-70">· from {C.MIN_SOL} SOL</span>
          </button>
        </div>
      </div>

      {/* Shared global CSS */}
      <style jsx global>{`
        html,body{overflow-y:auto!important;-webkit-overflow-scrolling:touch;background:#040410}
        ::-webkit-scrollbar{width:2px;height:2px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(249,115,22,.25);border-radius:2px}
        *{scrollbar-width:thin;scrollbar-color:rgba(249,115,22,.2) transparent;-webkit-tap-highlight-color:transparent}
        .scrollbar-none{scrollbar-width:none}
        .scrollbar-none::-webkit-scrollbar{display:none}
        @keyframes mr-glow-pulse{0%,100%{box-shadow:0 0 10px rgba(249,115,22,.25)}50%{box-shadow:0 0 24px rgba(249,115,22,.55)}}
        .mr-glow-btn:hover{animation:mr-glow-pulse 1.5s ease-in-out infinite}
      `}</style>
    </div>
  );
}
