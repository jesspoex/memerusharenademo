"use client";
// =============================================================================
// src/app/trade/page.tsx  — REFACTORED
// All types, utils, and static data → trade/constants.ts
// Supabase client helpers → trade/supabase-client.ts
// Data hooks → trade/hooks/useBattleData.ts, useWalletData.ts
// UI components → trade/components/*
// =============================================================================
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

// ── Shared constants & types ──────────────────────────────────────────────────
import {
  CFG, TOKENS, TIERS, DURS, getTier, calcFee, toLocalBattle,
  sf, fmtT, fmtN, sw, ph, fmtTs, tAgo, lsSave, lsLoad,
  Battle, DbBattle, DbBet, DbActivity, DbWinner, DbStats,
  Token, Activity, ChatMessage, UserProfile, LeaderboardEntry,
  RecentWinner, RushPosition, ModalTab, PaymentToken, BattleMode,
} from './trade/constants';

// ── Supabase client helpers ───────────────────────────────────────────────────
import { sbGet, sbInsert, sbUpsert, createRealtimeChannel } from './trade/supabase-client';

// ── Data hooks ────────────────────────────────────────────────────────────────
import { useBattleData } from './hooks/useBattleData';
import { useWalletData } from './hooks/useWalletData';

// ── UI Components ─────────────────────────────────────────────────────────────
import { MiniChart }     from './components/MiniChart';
import { BattleCard }    from './components/BattleCard';
import { TradeStats }    from './components/TradeStats';
import { LiveActivity }  from './components/LiveActivity';

// ── Small inline components (kept here — too small to split) ──────────────────
function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#040410'}}>
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-slate-400 text-sm font-bold">Loading MemeRush…</p>
      </div>
    </div>
  );
}

function WinToast({ message, amount, onClose }: { message: string; amount: number; onClose: () => void }) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99999] px-6 py-4 rounded-2xl shadow-2xl border border-yellow-500/50 text-center" style={{background:'linear-gradient(135deg,rgba(120,53,15,.95),rgba(78,23,5,.95))'}}>
      <p className="text-2xl font-black text-yellow-300">{message}</p>
      <p className="text-emerald-400 font-black text-xl">+{amount.toFixed(4)} SOL</p>
      <button onClick={onClose} className="mt-2 text-xs text-slate-400 hover:text-white">Close ✕</button>
    </div>
  );
}

function MobileNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const tabs = [
    { id: 'arena',   icon: '⚔️',  label: 'Arena'   },
    { id: 'stats',   icon: '📊',  label: 'History' },
    { id: 'profile', icon: '👤',  label: 'Profile' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 backdrop-blur-xl" style={{background:'rgba(5,5,18,.97)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onTabChange(t.id)}
              className="flex flex-col items-center justify-center gap-1.5 pt-3 pb-3 flex-1 min-h-[60px] transition-all relative active:opacity-70"
              style={{color: active ? '#f97316' : 'rgba(71,85,105,1)'}}>
              {active && <span className="absolute top-0 left-4 right-4 h-[2px] rounded-full" style={{background:'linear-gradient(90deg,transparent,#f97316,transparent)'}}/>}
              <span className="text-2xl leading-none">{t.icon}</span>
              <span className={`text-[11px] font-black tracking-wide leading-none ${active ? 'text-orange-400' : 'text-slate-600'}`}>{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

class ErrorBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean;error:string|null}>{
  constructor(props:{children:React.ReactNode}){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(e:Error){return{hasError:true,error:e.message};}
  render(){if(this.state.hasError)return(<div className="min-h-screen flex items-center justify-center text-white p-4" style={{background:"#040410"}}><div className="text-center"><div className="text-6xl mb-4">⚠️</div><h1 className="text-2xl font-bold mb-4 text-red-400">Something went wrong</h1><p className="text-sm text-gray-400 mb-4">{this.state.error}</p><button onClick={()=>window.location.reload()} className="px-6 py-3 rounded-xl font-bold" style={{background:"linear-gradient(135deg,#ea580c,#f97316)"}}>Refresh</button></div></div>);return this.props.children;}
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
function TradeContent() {
  const { publicKey, connected, signTransaction } = useWallet();

  // ── Modal / UI state (stays here — drives rendering) ─────────────────────
  const [mounted,          setMounted]          = useState(false);
  const [activeTab,        setActiveTab]        = useState('arena');
  const [activeBattle,     setActiveBattle]     = useState<Battle|null>(null);
  const [battleTimeLeft,   setBattleTimeLeft]   = useState(0);
  const [pickedSide,       setPickedSide]       = useState<'A'|'B'|null>(null);
  const [paymentToken,     setPaymentToken]     = useState<PaymentToken>('SOL');
  const [joinAmount,       setJoinAmount]       = useState('0.1');
  const [isJoiningBattle,  setIsJoiningBattle]  = useState(false);
  const [modalTab,         setModalTab]         = useState<ModalTab>('chart');
  const [rushPoints,       setRushPoints]       = useState(0);
  const [rushPosition,     setRushPosition]     = useState<RushPosition|null>(null);
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [createTokenA,     setCreateTokenA]     = useState('BONK');
  const [createTokenB,     setCreateTokenB]     = useState('WIF');
  const [createAmount,     setCreateAmount]     = useState(0.1);
  const [createDuration,   setCreateDuration]   = useState(300);
  const [isCreatingBattle, setIsCreatingBattle] = useState(false);
  const [showAddTokenModal,  setShowAddTokenModal]  = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [isFetchingToken,    setIsFetchingToken]    = useState(false);
  const [fetchedTokenData,   setFetchedTokenData]   = useState<Token|null>(null);
  const [fetchTokenError,    setFetchTokenError]    = useState<string|null>(null);
  const [showChat,         setShowChat]         = useState(false);
  const [chatMessages,     setChatMessages]     = useState<ChatMessage[]>([]);
  const [newMessage,       setNewMessage]       = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [errMsg,           setErrMsg]           = useState<string|null>(null);
  const [okMsg,            setOkMsg]            = useState<string|null>(null);
  const [notif,            setNotif]            = useState<string|null>(null);
  const [showWinToast,     setShowWinToast]     = useState(false);
  const [winAmount,        setWinAmount]        = useState(0);

  const showErr = (m: string) => { setErrMsg(m);  setTimeout(()=>setErrMsg(null), 5000); };
  const showOk  = (m: string) => { setOkMsg(m);   setTimeout(()=>setOkMsg(null),  5000); };
  const notify  = (m: string) => { setNotif(m);   setTimeout(()=>setNotif(null),  3000); };

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const activeBattleRef = useRef<Battle|null>(null);
  activeBattleRef.current = activeBattle;

  const {
    battles, setBattles, battleHistory, activities, recentWinners,
    leaderboard, dbStats, dbLoaded, realtimeOk, newBattleToast,
    loadBattles, checkAndRespawn, soundedRef,
  } = useBattleData(activeBattleRef, setActiveBattle, setBattleTimeLeft, setPickedSide);

  const {
    connRef, tokens, setTokens, mrushLive,
    solBal, mrushBal, balLoading,
    userProfile, saveProfile,
    referralCount, referralEarnings,
    shareRewardPending, setShareRewardPending,
    tier, glFn: gl, calcJoinFee,
  } = useWalletData(publicKey, connected, dbStats);

  // ── Computed ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    players: dbStats?.players ?? 0,
    battles: dbStats?.battles ?? 0,
    vol:     dbStats?.vol_sol ?? 0,
    paid:    dbStats?.paid_sol ?? 0,
  }), [dbStats]);

  const { fee: jFee, tier: jTier } = calcJoinFee(parseFloat(joinAmount) || 0);

  // ── Mount: RPC + URL params + chat ─────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    (async () => {
      for (const url of [CFG.rpcUrl, CFG.fallbackRpcUrl, 'https://api.mainnet-beta.solana.com']) {
        try { const c = new Connection(url,{commitment:'confirmed'}); await c.getSlot(); connRef.current=c; break; } catch {}
      }
    })();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ref')) sessionStorage.setItem('shareRef', urlParams.get('ref')!);
    const battleParam = urlParams.get('battle');
    if (battleParam) sessionStorage.setItem('mr_open_battle', battleParam);

    sbGet<{id:number;short_wallet:string;message:string;created_at:string}>('mr_chat_messages', 'select=*&order=created_at.desc&limit=50')
      .then(rows => {
        if (rows?.length) setChatMessages(rows.reverse().map(r => ({ id: String(r.id), wallet: r.short_wallet, message: r.message, timestamp: new Date(r.created_at).getTime() })));
      }).catch(()=>{});
    createRealtimeChannel('mr_chat_messages', (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const r = payload.new;
      setChatMessages(prev => [...prev, { id: String(r.id??Date.now()), wallet: r.short_wallet??sw(r.wallet??''), message: r.message??''   , timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now() }].slice(-50));
    });
  }, []);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}); },[chatMessages]);

  // ── Battle ended → payout detection ────────────────────────────────────────
  useEffect(() => {
    if (!activeBattle || activeBattle.status !== 'ended' || activeBattle.payoutSignature) return;
    const aL = activeBattle.chartA[activeBattle.chartA.length-1] ?? 0;
    const bL = activeBattle.chartB[activeBattle.chartB.length-1] ?? 0;
    const winner = activeBattle.winner ?? (aL >= bL ? activeBattle.tokenA : activeBattle.tokenB);
    const pickedWin = pickedSide==='A' ? activeBattle.tokenA : pickedSide==='B' ? activeBattle.tokenB : null;
    const userWon = pickedSide !== null && winner === pickedWin;
    const isRealBattle = (activeBattle.mode ?? 'arena') === 'real';
    if (userWon && isRealBattle) {
      setWinAmount(activeBattle.prizePool); setShowWinToast(true);
      setTimeout(() => setShowWinToast(false), 8000);
      saveProfile({ wins:(userProfile?.wins??0)+1, totalPnL:(userProfile?.totalPnL??0)+activeBattle.prizePool });
    } else if (pickedSide && isRealBattle) {
      saveProfile({ losses:(userProfile?.losses??0)+1, totalPnL:(userProfile?.totalPnL??0)-activeBattle.amount });
    }
    const refWallet = sessionStorage.getItem('shareRef');
    if (refWallet && refWallet !== publicKey?.toString() && isRealBattle) {
      setShareRewardPending(r => r + parseFloat((activeBattle.prizePool * CFG.shareRewardPct).toFixed(6)));
    }
    const t = setTimeout(async () => {
      if (!isRealBattle) { setActiveBattle(prev => prev ? {...prev, status:'paid' as const, payoutSignature:'ARENA_NO_PAYOUT'} : prev); return; }
      let sig = 'PENDING_' + Math.random().toString(36).slice(2,10).toUpperCase();
      try {
        const res = await fetch('/api/payout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ battleId: activeBattle.id }) });
        const d = await res.json() as { success?:boolean; alreadyPaid?:boolean; txHash?:string; payoutSol?:number };
        if ((d.success || d.alreadyPaid) && d.txHash) { sig = d.txHash; if (userWon) notify(`🏆 Payout! ${sf(d.payoutSol??activeBattle.prizePool,4)} SOL → ${sig.slice(0,8)}…`); }
      } catch {}
      setActiveBattle(prev => prev ? {...prev, status:'paid' as const, payoutSignature:sig} : prev);
    }, 5000);
    return () => clearTimeout(t);
  }, [activeBattle?.status]);


  // ── renderArena ────────────────────────────────────────────────────────────
  const renderArena=()=>(
    <>
      <div className="flex items-center justify-between pt-1 pb-0.5">
        <div>
          <h1 className="text-base font-black text-white leading-none tracking-tight">Battle Arena</h1>
          <p className="text-slate-600 text-[10px] mt-0.5 font-mono">Solana Mainnet · Realtime</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black" style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',color:'#4ade80'}}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE
          </span>
          <button onClick={()=>setShowCreateModal(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black text-white active:scale-95 transition-all min-h-[40px]" style={{background:'linear-gradient(135deg,#ea580c,#f97316)',boxShadow:'0 0 14px rgba(249,115,22,.4)'}}>
            ⚔️ Create
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-orange-500/8 overflow-hidden" style={{background:'rgba(8,4,2,.97)'}}>
        <div className="flex items-center gap-3 px-3 py-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-orange-400 opacity-50 animate-ping"/><span className="relative inline-flex w-2 h-2 rounded-full bg-orange-400"/></span>
            <span className="text-[9px] font-black text-orange-400 tracking-widest uppercase">{realtimeOk?'LIVE':'SYNC'}</span>
          </div>
          {[{v:`${battles.filter(b=>b.status==='live').length} Battles`,c:'#a3e635'},{v:`${sf(stats.vol,2)} SOL`,c:'#facc15'},{v:`${fmtN(stats.players)} Players`,c:'#67e8f9'},{v:'Mainnet',c:'#a78bfa'}].map((s,i)=>(
            <span key={i} className="flex items-center gap-1 text-[10px] font-bold shrink-0" style={{color:s.c}}><span className="text-slate-700">·</span>{s.v}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[{l:'Paid Out',v:sf(stats.paid,2)+' SOL',c:'#4ade80',bg:'rgba(74,222,128,.06)'},{l:'Volume',v:sf(stats.vol,2)+' SOL',c:'#facc15',bg:'rgba(250,204,21,.06)'},{l:'Battles',v:fmtN(stats.battles),c:'#f97316',bg:'rgba(249,115,22,.06)'},{l:'Players',v:fmtN(stats.players),c:'#fbbf24',bg:'rgba(251,191,36,.06)'}].map(s=>(
          <div key={s.l} className="rounded-xl p-2.5 text-center border border-white/[.04]" style={{background:s.bg}}>
            <p className="font-black text-sm leading-none tabular-nums" style={{color:s.c}}>{dbLoaded?s.v:'—'}</p>
            <p className="text-[8px] text-slate-600 mt-1 uppercase tracking-wide leading-none">{s.l}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2.5 h-2.5"><span className="absolute inline-flex w-full h-full rounded-full bg-orange-400 opacity-40 animate-ping"/><span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-orange-400"/></span>
            <h2 className="font-black text-xs tracking-widest uppercase" style={{color:'#f97316'}}>Live Battles</h2>
            <span className="text-[9px] text-slate-600 font-mono">{battles.filter(b=>b.status==='live').length} active</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold">
            <span style={{color:'#facc15'}}>{battles.filter(b=>b.status==='live'&&b.mode==='real').length} 💰 real</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{battles.filter(b=>b.status==='live'&&b.mode==='arena').length} auto</span>
          </div>
        </div>

        {!dbLoaded?(
          <div className="space-y-2.5">
            {[0,1,2].map(i=>(
              <div key={i} className="rounded-2xl border border-white/5 overflow-hidden" style={{background:'rgba(10,10,24,.9)'}}>
                <div className="flex items-center justify-between px-4 pt-3 pb-0"><div className="h-3 w-16 bg-white/5 rounded-full animate-pulse"/><div className="h-5 w-14 bg-white/5 rounded-full animate-pulse"/></div>
                <div className="flex gap-3 px-4 py-3"><div className="flex-1 h-16 bg-white/4 rounded-xl animate-pulse"/><div className="w-8 h-8 self-center bg-white/4 rounded-full animate-pulse"/><div className="flex-1 h-16 bg-white/4 rounded-xl animate-pulse"/></div>
                <div className="px-4 pb-3 flex justify-between"><div className="h-2.5 w-20 bg-white/5 rounded-full animate-pulse"/><div className="h-2.5 w-14 bg-white/5 rounded-full animate-pulse"/></div>
              </div>
            ))}
          </div>
        ):battles.filter(b=>b.status==='live').length===0?(
          <div className="rounded-2xl border border-orange-500/15 py-10 text-center space-y-3" style={{background:'rgba(20,10,4,.8)'}}>
            <div className="relative mx-auto w-12 h-12"><div className="absolute inset-0 rounded-full border-2 border-orange-500/25 animate-ping"/><div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>
            <p className="text-orange-300 text-sm font-black">🔥 Generating battles…</p>
            <p className="text-slate-600 text-xs">New battles should appear in a few seconds</p>
            <button onClick={()=>setShowCreateModal(true)} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black text-white" style={{background:'rgba(234,88,12,.4)',border:'1px solid rgba(249,115,22,.3)'}}>⚔️ Create Your Own</button>
          </div>
        ):(
          <div className="grid grid-cols-1 gap-3">
            {battles.filter(b=>b.status==='live').map(battle=>{
              const tl = Math.max(0,Math.floor((battle.endTime-Date.now())/1000));
              const openModal = ()=>{
                const wA=(battle.chartA.length>3)?battle.chartA:[0];
                const wB=(battle.chartB.length>3)?battle.chartB:[0];
                setActiveBattle({...battle,chartA:wA,chartB:wB});setBattleTimeLeft(tl);setPickedSide(null);setModalTab('chart');setRushPosition(null);soundedRef.current={};
              };
              return(
                <BattleCard key={battle.id} battle={battle} tokens={tokens} glFn={gl} onClick={openModal}/>
              );
            })}
          </div>
        )}
      </section>

      <LiveActivity activities={activities} recentWinners={recentWinners}/>

      <details className="rounded-2xl border border-orange-500/10 overflow-hidden" style={{background:'rgba(30,12,2,.5)'}}>
        <summary className="px-4 py-3 font-black text-[10px] text-orange-400 cursor-pointer list-none flex items-center justify-between select-none tracking-widest uppercase">
          <span>💎 MRUSH Holder Discounts</span><span className="text-slate-600 font-normal normal-case tracking-normal">▾</span>
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {TIERS.filter(t=>t.min>0).map(t=>(
              <div key={t.name} className="rounded-xl p-2 text-center border border-white/[.04]" style={{background:'rgba(18,18,36,.8)'}}>
                <p className="font-bold text-[11px]" style={{color:t.hex}}>{t.name}</p>
                <p className="text-slate-600 text-[9px] mt-0.5">{fmtN(t.min)}</p>
                <p className="font-black text-sm mt-1" style={{color:t.hex}}>-{t.disc}%</p>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-[10px] text-center">
            {connected&&mrushBal!==null
              ? <span style={{color:tier.hex}}>Your tier: <b>{tier.name}</b> · Fee: <b>{sf(CFG.feeBase*(1-tier.disc/100),1)}%</b></span>
              : 'Connect wallet to see your tier'}
          </p>
        </div>
      </details>

      <details className="rounded-2xl border border-white/[.04] overflow-hidden" style={{background:'rgba(6,6,18,.98)'}}>
        <summary className="px-4 py-3 font-black text-[10px] text-slate-500 cursor-pointer list-none flex items-center justify-between select-none tracking-widest uppercase">
          <span>🔗 On-Chain Transparency</span><span className="text-slate-700 font-normal normal-case tracking-normal">▾</span>
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-2">
          <a href={`${CFG.solscan}/account/${CFG.treasury}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-white/[.04] hover:border-orange-500/20 transition-colors" style={{background:'rgba(18,18,36,.8)'}}>
            <span className="text-emerald-400 text-sm">💸</span>
            <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">Treasury Wallet</p><p className="text-slate-600 text-[10px] truncate font-mono">{CFG.treasury}</p></div>
            <span className="text-slate-700 text-xs">↗</span>
          </a>
          <div className="flex flex-wrap gap-1.5">
            {[{i:'🔥',t:'LP Burned',c:'#fb923c'},{i:'✅',t:'0% Dev',c:'#34d399'},{i:'🔐',t:'Auto Payout',c:'#38bdf8'},{i:'⚡',t:'Realtime',c:'#a78bfa'}].map(b=>(
              <span key={b.t} className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold" style={{background:`${b.c}12`,border:`1px solid ${b.c}28`,color:b.c}}>{b.i} {b.t}</span>
            ))}
          </div>
        </div>
      </details>
    </>
  );

  const renderStats=()=>(
    <TradeStats
      stats={stats}
      activities={activities}
      recentWinners={recentWinners}
      leaderboard={leaderboard}
      battleHistory={battleHistory}
      dbLoaded={dbLoaded}
      realtimeOk={realtimeOk}
    />
  );

  const handleCreateBattle = useCallback(async () => {
    if (!connected || !publicKey)      return showErr('Connect Wallet first');
    if (!signTransaction)              return showErr('Wallet does not support signing');
    if (!connRef.current)              return showErr('RPC not ready — please refresh the page');
    if (createTokenA === createTokenB) return showErr('Please select two different tokens');
    if (createAmount < CFG.MIN_BET_SOL || createAmount > CFG.MAX_BET_SOL) return showErr(`Amount must be between ${CFG.MIN_BET_SOL} and ${CFG.MAX_BET_SOL} SOL`);

    const totalNeeded = createAmount + 0.002;
    if (solBal !== null && solBal < totalNeeded) {
      return showErr(`Insufficient SOL. Need ~${totalNeeded.toFixed(4)} SOL, you have ${sf(solBal,4)} SOL`);
    }

    setIsCreatingBattle(true);
    const conn     = connRef.current;
    const treasury = new PublicKey(CFG.treasury);

    try {
      // STEP 1: Sign & broadcast TX on-chain (frontend)
      const depositTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey:   treasury,
          lamports:   Math.floor(createAmount * LAMPORTS_PER_SOL),
        })
      );
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
      depositTx.recentBlockhash = blockhash;
      depositTx.feePayer = publicKey;
      const signed = await signTransaction(depositTx);
      const txHash = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await conn.confirmTransaction({ signature: txHash, blockhash, lastValidBlockHeight }, 'confirmed');

      // STEP 2: Send txHash to backend — backend validates TX on-chain & creates battle in DB
      const res = await fetch('/api/create-battle', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          wallet:   publicKey.toString(),
          txHash,
          tokenA:   createTokenA,
          tokenB:   createTokenB,
          amount:   createAmount,
          duration: createDuration,
        }),
      });
      const data = await res.json() as {
        success:  boolean;
        error?:   string;
        battle?:  { id: string; prizePool: number; endTime: string; startTime: string };
        recovery?: { txHash: string; amount: number };
      };

      if (!data.success || !data.battle) {
        if (data.recovery) console.error('[Recovery needed]', data.recovery);
        throw new Error(data.error ?? 'Server failed to create battle');
      }

      const { battle } = data;
      saveProfile({ battlesCreated: (userProfile?.battlesCreated ?? 0) + 1 });
      showOk(`⚔️ Battle created! Prize: ${sf(battle.prizePool,4)} SOL | tx: ${txHash.slice(0,8)}…`);

      // STEP 3: Open battle modal (optimistic — Realtime will sync)
      const warmA = [0], warmB = [0];
      for (let i = 0; i < 8; i++) {
        warmA.push(parseFloat((warmA[warmA.length-1]+(Math.random()-0.5)*0.02).toFixed(5)));
        warmB.push(parseFloat((warmB[warmB.length-1]+(Math.random()-0.5)*0.02).toFixed(5)));
      }
      const newBattle: Battle = {
        id: battle.id, tokenA: createTokenA, tokenB: createTokenB,
        amount: createAmount, duration: createDuration,
        startTime: new Date(battle.startTime).getTime(),
        endTime:   new Date(battle.endTime).getTime(),
        status: 'live', tokenAChange: 0, tokenBChange: 0,
        chartA: warmA, chartB: warmB, players: 1,
        creator: publicKey.toString(), totalPool: createAmount,
        platformFee: createAmount * 0.02, prizePool: battle.prizePool,
        mode: 'real',
      };
      setTimeout(() => {
        setShowCreateModal(false);
        setActiveBattle(newBattle);
        setBattleTimeLeft(createDuration);
        setPickedSide(null);
        soundedRef.current = {};
      }, 600);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg.includes('User rejected') || msg.includes('rejected')) showErr('Transaction cancelled by user');
      else if (msg.includes('insufficient') || msg.includes('Insufficient')) showErr('Insufficient SOL');
      else if (msg.includes('blocked') || msg.includes('SecurityError')) showErr('⚠️ Phantom security alert: tap "Proceed anyway" to continue');
      else showErr('Failed to create battle: ' + msg.slice(0, 100));
      console.error('[CreateBattle]', e);
    } finally {
      setIsCreatingBattle(false);
    }
  }, [connected, publicKey, signTransaction, createTokenA, createTokenB, createAmount,
      createDuration, solBal, userProfile, saveProfile]);

  // ═══════════════════════════════════════════════════════════════════════════
  // JOIN BATTLE — REAL MODE v2
  // Rules:
  //   1. 1 wallet = 1 position per battle. Re-join = TOP-UP (not new player)
  //   2. Fee separated from net_amount at entry
  //   3. TX validated on-chain before DB write
  //   4. DB only written after TX confirmed
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // JOIN BATTLE — calls /api/join-battle
  // Frontend: sign TX → get txHash → POST to backend → backend validates & records
  // ═══════════════════════════════════════════════════════════════════════════
  const handleJoinBattle = useCallback(async () => {
    if (!activeBattle || !connected || !publicKey) return showErr('Connect wallet first');
    if (!pickedSide)      return showErr('Select Token A or Token B first');
    if (!signTransaction) return showErr('Wallet does not support signing');
    if (!connRef.current) return showErr('RPC not ready — please refresh');
    if (activeBattle.status !== 'live')      return showErr('This battle has already ended');
    if (activeBattle.endTime <= Date.now())  return showErr('This battle has expired');

    const amt = parseFloat(joinAmount);
    if (isNaN(amt) || amt <= 0) return showErr('Enter a valid amount');
    if (paymentToken === 'SOL') {
      if (amt < CFG.MIN_BET_SOL) return showErr(`Minimum bet: ${CFG.MIN_BET_SOL} SOL (~$0.10)`);
      if (amt > 10)   return showErr('Maximum bet: 10 SOL');
      if (solBal !== null && amt + 0.001 > solBal) return showErr(`Insufficient SOL. Punya ${sf(solBal,4)} SOL`);
    } else {
      if (amt < 50_000)      return showErr('Minimum bet: 50,000 MRUSH');
      if (mrushBal === null) return showErr('MRUSH balance loading, please wait');
      if (mrushBal < amt)    return showErr(`Insufficient MRUSH. You have ${fmtN(mrushBal)}`);
      if (solBal !== null && solBal < 0.001) return showErr('Need at least 0.001 SOL for transaction fee');
    }

    setIsJoiningBattle(true);
    const conn     = connRef.current;
    const treasury = new PublicKey(CFG.treasury);
    let txHash = '';

    try {
      if (paymentToken === 'SOL') {
        // STEP 1: Sign & broadcast SOL TX
        const { fee } = calcFee(amt, mrushBal ?? 0);
        const feeLamports = Math.max(Math.floor(fee * LAMPORTS_PER_SOL), 5_000);
        const tx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: treasury, lamports: feeLamports })
        );
        // Creator reward (0.1% if user battle)
        if (activeBattle.creator !== 'arena' && activeBattle.creator !== publicKey.toString()) {
          const reward = Math.floor(amt * CFG.shareRewardPct * LAMPORTS_PER_SOL);
          if (reward >= 5_000) {
            try { tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(activeBattle.creator), lamports: reward })); } catch {}
          }
        }
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash; tx.feePayer = publicKey;
        const signed = await signTransaction(tx);
        txHash = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
        await conn.confirmTransaction({ signature: txHash, blockhash, lastValidBlockHeight }, 'confirmed');

      } else {
        // STEP 1: Sign & broadcast MRUSH TX
        const { getAssociatedTokenAddress, createTransferInstruction } = await import('@solana/spl-token');
        const mint = new PublicKey(CFG.mrushMint);
        const senderATA   = await getAssociatedTokenAddress(mint, publicKey);
        const receiverATA = await getAssociatedTokenAddress(mint, treasury);
        const tx = new Transaction().add(createTransferInstruction(senderATA, receiverATA, publicKey, BigInt(Math.floor(amt * 1_000_000))));
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash; tx.feePayer = publicKey;
        const signed = await signTransaction(tx);
        txHash = await conn.sendRawTransaction(signed.serialize());
        await conn.confirmTransaction({ signature: txHash, blockhash, lastValidBlockHeight }, 'confirmed');
      }

      // STEP 2: Report to backend — backend validates TX on-chain & updates DB
      const res = await fetch('/api/join-battle', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          battleId: activeBattle.id,
          wallet:   publicKey.toString(),
          txHash,
          side:     pickedSide,
          amount:   amt,
          // Pass referrer wallet so backend can credit the 0.1% reward
          referrer: (typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem('shareRef') ?? undefined
            : undefined),
        }),
      });
      const data = await res.json() as {
        success:   boolean;
        error?:    string;
        bet?:      { feeSol: number; netSol: number; isTopUp: boolean; newPlayers: number; newPool: number };
      };

      if (!data.success || !data.bet) {
        throw new Error(data.error ?? 'Server failed to record bet');
      }

      const { bet } = data;
      saveProfile({ battlesJoined: (userProfile?.battlesJoined ?? 0) + (bet.isTopUp ? 0 : 1) });
      setActiveBattle(prev => prev ? { ...prev, players: bet.newPlayers, prizePool: bet.newPool } : prev);
      showOk(`✅ ${bet.isTopUp ? 'Top-up' : 'Joined'}! ${sf(amt)} ${paymentToken} on ${pickedSide==='A'?activeBattle.tokenA:activeBattle.tokenB} | tx: ${txHash.slice(0,8)}…`);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg.includes('User rejected') || msg.includes('rejected')) showErr('Transaction cancelled by user');
      else if (msg.includes('insufficient') || msg.includes('Insufficient')) showErr('Balance insufficient');
      else if (msg.includes('blocked') || msg.includes('SecurityError')) showErr('⚠️ Phantom security alert: tap "Proceed anyway" to continue');
      else showErr('Failed to join battle: ' + msg.slice(0, 100));
      console.error('[JoinBattle]', e);
    } finally {
      setIsJoiningBattle(false);
    }
  }, [activeBattle, connected, publicKey, pickedSide, joinAmount, paymentToken,
      solBal, mrushBal, userProfile, saveProfile, signTransaction]);
  const handleSendMessage=useCallback(async ()=>{
    if(!newMessage.trim()||!publicKey)return;
    const msg = newMessage.trim();
    setNewMessage('');
    const m:ChatMessage={id:Date.now().toString(),wallet:sw(publicKey.toString()),message:msg,timestamp:Date.now()};
    // Tambah ke local state dulu (optimistic)
    setChatMessages(p=>[...p,m].slice(-50));
    // Simpan ke Supabase agar semua user lihat
    await sbInsert('mr_chat_messages', {
      wallet:     publicKey.toString(),
      short_wallet: sw(publicKey.toString()),
      message:    msg,
      created_at: new Date().toISOString(),
    }).catch(()=>{}); // non-fatal
  },[newMessage,publicKey]);

  const handleShare=useCallback((battleId:string,prizePool:number)=>{
    if(!publicKey)return showErr('Connect wallet to share and earn');
    const shareUrl=`${CFG.site}/trade?battle=${battleId}&ref=${publicKey.toString()}`;
    const reward=parseFloat((prizePool*CFG.shareRewardPct).toFixed(6));
    if(navigator.share){navigator.share({title:'MemeRush Battle',text:`⚔️ Join battle on MemeRush! Prize: ${sf(prizePool)} SOL\n${shareUrl}`,url:shareUrl}).catch(()=>{});}
    else{navigator.clipboard.writeText(shareUrl);notify(`🔗 Link copied! Earn ${reward} SOL per join`);}
  },[publicKey]);

  const handleFetchToken=useCallback(async()=>{
    const addr=customTokenAddress.trim();
    if(!addr)return setFetchTokenError('Enter a mint address');
    if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr))return setFetchTokenError('Invalid Solana address');
    setIsFetchingToken(true);setFetchTokenError(null);setFetchedTokenData(null);
    try{
      const r=await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`,{cache:'no-store'});
      const d=await r.json() as {pairs?:Array<{baseToken:{symbol:string;name:string};priceUsd:string;priceChange?:{h24?:string};volume?:{h24?:string};marketCap?:string;liquidity?:{base?:number};info?:{imageUrl?:string;liquidityLocked?:boolean}}>};
      if(!d.pairs?.length)return setFetchTokenError('Not found on DexScreener.');
      const pair=[...d.pairs].sort((a,b)=>parseFloat(b.marketCap??'0')-parseFloat(a.marketCap??'0'))[0];
      const lpBurned=(pair.liquidity?.base??1)===0||pair.info?.liquidityLocked===true;
      setFetchedTokenData({symbol:pair.baseToken.symbol,name:pair.baseToken.name,logoUrl:pair.info?.imageUrl??ph(pair.baseToken.symbol),basePrice:parseFloat(pair.priceUsd)||0,price:parseFloat(pair.priceUsd)||0,priceChange24h:parseFloat(pair.priceChange?.h24??'0'),volume24h:parseFloat(pair.volume?.h24??'0'),color:'from-cyan-400 to-blue-600',priceDirection:'neutral',trending:false,coingeckoId:null,isCustom:true,mintAddress:addr,lpBurned});
    }catch{setFetchTokenError('Fetch failed. Try again.');}
    finally{setIsFetchingToken(false);}
  },[customTokenAddress]);

  const handleAddToken=useCallback(()=>{
    if(!fetchedTokenData)return;
    setTokens(prev=>prev.find(t=>t.symbol===fetchedTokenData.symbol)?prev:[...prev,fetchedTokenData]);
    if(!createTokenA||createTokenA===createTokenB)setCreateTokenA(fetchedTokenData.symbol);else setCreateTokenB(fetchedTokenData.symbol);
    setFetchedTokenData(null);setCustomTokenAddress('');setShowAddTokenModal(false);
    notify(`✅ ${fetchedTokenData.symbol} added!`);
  },[fetchedTokenData,createTokenA,createTokenB]);

  if(!mounted) return <LoadingState/>;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  const renderProfile=()=>connected&&publicKey?(
    <div className="space-y-4">

      {/* Wallet card */}
      <div className="rounded-2xl border border-white/[.05]" style={{background:'linear-gradient(160deg,rgba(12,12,30,.98),rgba(6,6,18,.99))'}}>
        <div className="px-5 pt-5 pb-4 border-b border-white/[.04]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0" style={{background:'linear-gradient(135deg,#ea580c,#f97316)'}}>{publicKey.toString().slice(0,1).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="font-mono font-bold text-cyan-400 text-sm leading-none truncate">{sw(publicKey.toString())}</p>
              <p className="text-[11px] font-bold mt-1" style={{color:tier.hex}}>{tier.name} · Fee {sf(CFG.feeBase*(1-tier.disc/100),1)}%</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/[.04]">
          <div className="p-4 text-center">
            {balLoading
              ? <p className="text-slate-600 text-sm animate-pulse h-7 flex items-center justify-center">—</p>
              : <p className="text-xl font-black text-emerald-400 tabular-nums">{solBal===null?'—':sf(solBal,4)}</p>}
            <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wide">SOL Balance</p>
          </div>
          <div className="p-4 text-center">
            {balLoading
              ? <p className="text-slate-600 text-sm animate-pulse h-7 flex items-center justify-center">—</p>
              : <p className="text-xl font-black text-purple-400 tabular-nums">{mrushBal===null?'—':fmtN(mrushBal)}</p>}
            <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wide">MRUSH</p>
          </div>
        </div>
      </div>

      {/* Battle stats */}
      {userProfile&&(
        <div className="rounded-2xl border border-white/[.05]" style={{background:'rgba(8,8,20,.98)'}}>
          <div className="px-4 py-3 border-b border-white/[.04]">
            <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Battle Stats</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-white/[.04]">
            {[
              {l:'Wins',    v:userProfile.wins,           c:'#4ade80'},
              {l:'Losses',  v:userProfile.losses,         c:'#f87171'},
              {l:'Created', v:userProfile.battlesCreated, c:'#c084fc'},
              {l:'Joined',  v:userProfile.battlesJoined,  c:'#67e8f9'},
            ].map(s=>(
              <div key={s.l} className="p-3 text-center">
                <p className="font-black text-lg tabular-nums" style={{color:s.c}}>{s.v}</p>
                <p className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-wide">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-3.5 border-t border-white/[.04] flex items-center justify-between">
            <span className="text-[10px] text-slate-600 uppercase tracking-wide font-bold">Net P&L</span>
            <span className={`font-black text-xl tabular-nums ${(userProfile.totalPnL??0)>=0?'text-emerald-400':'text-red-400'}`}>
              {(userProfile.totalPnL??0)>=0?'+':''}{sf(userProfile.totalPnL,4)} SOL
            </span>
          </div>
        </div>
      )}

      {/* Win rate visual */}
      {userProfile&&(userProfile.wins+userProfile.losses)>0&&(
        <div className="rounded-2xl border border-white/[.05] p-4" style={{background:'rgba(8,8,20,.98)'}}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Win Rate</span>
            <span className="text-sm font-black text-white tabular-nums">
              {((userProfile.wins/(userProfile.wins+userProfile.losses))*100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(239,68,68,.2)'}}>
            <div className="h-full rounded-full transition-all" style={{
              width:`${(userProfile.wins/(userProfile.wins+userProfile.losses))*100}%`,
              background:'linear-gradient(90deg,#4ade80,#22d3ee)',
            }}/>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-emerald-600">{userProfile.wins} wins</span>
            <span className="text-[9px] text-red-700">{userProfile.losses} losses</span>
          </div>
        </div>
      )}

      {/* Fee tier */}
      <div className="rounded-2xl border overflow-hidden" style={{background:'rgba(8,8,20,.98)',borderColor:`${tier.hex}22`}}>
        <div className="px-4 py-3 border-b" style={{borderColor:`${tier.hex}15`,background:`${tier.hex}08`}}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Fee Tier</span>
            <span className="font-black text-sm" style={{color:tier.hex}}>{tier.name}</span>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-500">Discount: <span className="text-white font-bold">{tier.disc}%</span></span>
            <span className="text-[11px] text-slate-500">Fee: <span className="text-white font-bold">{sf(CFG.feeBase*(1-tier.disc/100),1)}%</span></span>
          </div>
          {tier.disc<75&&(()=>{
            const next=TIERS.find(t=>t.min>(mrushBal??0)&&t.disc>tier.disc);
            if(!next)return null;
            const pctToNext = Math.min(100, ((mrushBal??0)/next.min)*100);
            return(
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-600">Next: {next.name}</span>
                  <span className="text-[9px]" style={{color:next.hex}}>{fmtN((mrushBal??0))} / {fmtN(next.min)} MRUSH</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.05)'}}>
                  <div className="h-full rounded-full" style={{width:`${pctToNext}%`,background:next.hex,transition:'width .5s ease'}}/>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Share to Earn */}
      <div className="rounded-2xl border border-orange-500/15 overflow-hidden" style={{background:'rgba(8,8,20,.98)'}}>
        <div className="px-4 py-3 border-b border-orange-500/[.08]">
          <span className="text-[10px] font-black text-orange-400 tracking-widest uppercase">🔗 Share to Earn</span>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-[11px] text-slate-500">Earn <span className="text-emerald-400 font-bold">0.1%</span> for every join via your link.</p>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-white/[.06] font-mono text-[10px] text-slate-500" style={{background:'rgba(18,18,36,.8)'}}>
            <span className="truncate flex-1">{CFG.site}/trade?ref={sw(publicKey.toString())}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl border border-white/[.04] text-center" style={{background:'rgba(18,18,36,.8)'}}>
              <p className="font-black text-lg text-cyan-400 tabular-nums">{referralCount}</p>
              <p className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-wide">Referrals</p>
            </div>
            <div className="p-3 rounded-xl border border-white/[.04] text-center" style={{background:'rgba(18,18,36,.8)'}}>
              <p className="font-black text-lg text-emerald-400 tabular-nums">+{sf(referralEarnings+shareRewardPending,6)}</p>
              <p className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-wide">SOL Earned</p>
            </div>
          </div>
          <button
            onClick={()=>{
              const link=`${CFG.site}/trade?ref=${publicKey.toString()}`;
              if(navigator.share){navigator.share({title:'MemeRush',text:'⚔️ Join MemeRush battles!',url:link}).catch(()=>{});}
              else{navigator.clipboard.writeText(link);notify('🔗 Link copied!');}
            }}
            className="w-full py-3 rounded-xl font-black text-sm text-white transition-all hover:opacity-90 active:scale-95"
            style={{background:'linear-gradient(135deg,#c2410c,#ea580c)'}}>
            📤 Share Referral Link
          </button>
        </div>
      </div>

      {/* Community links — no Buy MRUSH yet */}
      <div className="rounded-2xl border border-white/[.05] p-4" style={{background:'rgba(8,8,20,.98)'}}>
        <p className="text-[10px] font-black text-slate-600 tracking-widest uppercase mb-3">Community</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            {i:'🐦',n:'Twitter / X', u:CFG.twitter,    c:'rgba(29,161,242,.12)',  b:'rgba(29,161,242,.25)'},
            {i:'✈️',n:'Telegram',    u:CFG.telegram,   c:'rgba(8,145,178,.12)',   b:'rgba(8,145,178,.25)'},

            {i:'🔍',n:'Treasury',    u:`${CFG.solscan}/account/${CFG.treasury}`, c:'rgba(16,185,129,.1)',b:'rgba(16,185,129,.22)'},
          ].map(s=>(
            <a key={s.n} href={s.u} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
              style={{background:s.c,borderColor:s.b}}>
              <span style={{fontSize:'14px'}}>{s.i}</span>{s.n}
            </a>
          ))}
        </div>
      </div>
    </div>
  ):(
    <div className="text-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-full border-2 border-white/10 flex items-center justify-center text-3xl mx-auto" style={{background:'rgba(18,18,40,.8)'}}>🔗</div>
      <div>
        <p className="font-black text-white text-base">Connect Wallet</p>
        <p className="text-slate-600 text-sm mt-1">View stats, profile & referral earnings</p>
      </div>
    </div>
  );

  // ── Battle Modal ───────────────────────────────────────────────────────────
  const renderBattleModal=()=>{
    if(!activeBattle)return null;
    const aL    = activeBattle.chartA[activeBattle.chartA.length-1]??0;
    const bL    = activeBattle.chartB[activeBattle.chartB.length-1]??0;
    const aWin  = aL>=bL;
    const isLive    = activeBattle.status==='live';
    const isReveal  = activeBattle.status==='ended'&&!activeBattle.payoutSignature;
    const pct       = (activeBattle.duration-battleTimeLeft)/activeBattle.duration*100;
    const cnt10     = battleTimeLeft<=10&&isLive;
    const hasJoined = pickedSide!==null; // user already placed a bet this session

    // RushTrade: compute live P&L in points from the entry snapshot
    const rushPnL = rushPosition ? (()=>{
      const cur = rushPosition.token===activeBattle.tokenA ? aL : bL;
      const delta = cur - rushPosition.entryChange;
      return rushPosition.dir==='long' ? delta : -delta;
    })() : 0;

    return(
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/85 backdrop-blur-md">
        <div className="w-full max-h-[94dvh] overflow-y-auto rounded-t-3xl border border-white/10 shadow-2xl relative slide-up" style={{background:'linear-gradient(160deg,#0c0804,#180e02,#080804)'}}>
          <button onClick={()=>{setActiveBattle(null);setRushPosition(null);}} className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full border border-white/10 text-slate-400 hover:text-white active:scale-90 transition-all" style={{background:'rgba(30,41,59,.8)'}}>✕</button>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{background:'rgba(255,255,255,.15)'}}/>
          </div>

          <div className="px-5 pb-5 space-y-4">

            {/* ── HEADER: token pair + badges ─────────────────────────── */}
            <div className="text-center pt-1">
              <div className="flex items-center justify-center gap-3 mb-2">
                <img src={gl(activeBattle.tokenA)} alt={activeBattle.tokenA} className="w-10 h-10 rounded-full border-2 border-orange-500/40" onError={e=>(e.target as HTMLImageElement).src=ph(activeBattle.tokenA)}/>
                <h2 className="text-xl font-black text-white">{activeBattle.tokenA} <span className="text-slate-500">vs</span> {activeBattle.tokenB}</h2>
                <img src={gl(activeBattle.tokenB)} alt={activeBattle.tokenB} className="w-10 h-10 rounded-full border-2 border-amber-500/40" onError={e=>(e.target as HTMLImageElement).src=ph(activeBattle.tokenB)}/>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                {isLive&&<span className="flex items-center gap-1 px-2 py-1 rounded-full font-bold text-emerald-400 border border-emerald-500/25 animate-pulse" style={{background:'rgba(6,78,59,.4)'}}>● LIVE</span>}
                {isReveal&&<span className="px-2 py-1 rounded-full font-bold text-yellow-400 border border-yellow-500/25 animate-pulse" style={{background:'rgba(120,53,15,.4)'}}>⏳ Revealing…</span>}
                {(activeBattle.mode??'arena')==='real'&&<span className="px-2 py-1 rounded-full font-bold text-yellow-400 border border-yellow-500/25" style={{background:'rgba(120,53,15,.3)'}}>💰 REAL</span>}
                {activeBattle.battleType==='system'&&(activeBattle.mode??'arena')!=='real'&&<span className="px-2 py-1 rounded-full font-bold text-orange-400 border border-orange-500/25" style={{background:'rgba(154,52,18,.25)'}}>🔥 Auto Battle</span>}
                {activeBattle.status==='paid'&&<span className="px-2 py-1 rounded-full font-bold text-emerald-400 border border-emerald-500/25" style={{background:'rgba(6,78,59,.4)'}}>✅ PAID</span>}
                <span className="px-2 py-1 rounded-full text-slate-300 border border-white/5" style={{background:'rgba(30,41,59,.5)'}}>👥 {activeBattle.players}</span>
                <span className="px-2 py-1 rounded-full font-bold text-yellow-400 border border-yellow-500/20" style={{background:'rgba(120,53,15,.3)'}}>💰 {sf(activeBattle.prizePool)} SOL</span>
              </div>
            </div>

            {/* ── TIMER PROGRESS ──────────────────────────────────────── */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Progress</span>
                <span className={`font-mono font-black text-lg ${cnt10?'text-red-400 animate-pulse':'text-orange-400'}`}>{isReveal?'⏳':fmtT(battleTimeLeft)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(30,41,59,.8)'}}>
                <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`,background:cnt10?'linear-gradient(90deg,#ef4444,#dc2626)':'linear-gradient(90deg,#f97316,#fbbf24)'}}/>
              </div>
            </div>

            {/* ── TOKEN PICK BUTTONS ───────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {([{s:'A' as const,sym:activeBattle.tokenA,ch:aL,lead:aWin,won:activeBattle.winner===activeBattle.tokenA},{s:'B' as const,sym:activeBattle.tokenB,ch:bL,lead:!aWin,won:activeBattle.winner===activeBattle.tokenB}]).map(t=>{
                const picked=pickedSide===t.s;
                const livePrice=tokens.find(tk=>tk.symbol===t.sym)?.price??0;
                return(
                  <button key={t.s} onClick={()=>isLive&&setPickedSide(t.s)} disabled={!isLive} className="rounded-2xl p-4 text-center border-2 transition-all disabled:opacity-80 active:scale-95" style={{borderColor:picked?'rgba(249,115,22,.8)':t.won?'rgba(16,185,129,.6)':t.lead?'rgba(249,115,22,.25)':'rgba(71,85,105,.2)',background:picked?'rgba(249,115,22,.18)':t.won?'rgba(6,78,59,.3)':'rgba(18,18,40,.8)'}}>
                    <img src={gl(t.sym)} alt={t.sym} className="w-10 h-10 rounded-full mx-auto mb-2 border border-white/10" onError={e=>(e.target as HTMLImageElement).src=ph(t.sym)}/>
                    <p className="font-black text-white text-sm">{t.sym}</p>
                    <p className={`text-sm font-black mt-0.5 ${t.ch>=0?'text-emerald-400':'text-red-400'}`}>{t.ch>=0?'+':''}{t.ch.toFixed(3)}%</p>
                    {livePrice>0&&<p className="text-[10px] text-slate-600 mt-0.5 tabular-nums">${livePrice<0.001?livePrice.toFixed(6):livePrice<1?livePrice.toFixed(4):livePrice.toFixed(2)}</p>}
                    {t.won&&<p className="text-xs text-emerald-400 mt-1 font-bold">🏆 WINNER</p>}
                    {picked&&isLive&&<p className="text-xs text-orange-300 mt-1">✓ Your pick</p>}
                  </button>
                );
              })}
            </div>

            {/* ── TAB SWITCHER ────────────────────────────────────────── */}
            {isLive&&(
              <div className="flex rounded-xl overflow-hidden border border-white/[.06]" style={{background:'rgba(18,12,4,.8)'}}>
                {([
                  {id:'chart'    as const, label:'📈 Chart'},
                  {id:'rushtrade'as const, label:'⚡ RushTrade', locked:!hasJoined},
                ] as {id:'chart'|'rushtrade'; label:string; locked?:boolean}[]).map(tab=>(
                  <button key={tab.id}
                    onClick={()=>{
                      if(tab.locked){notify('Join this battle first to access RushTrade!');return;}
                      setModalTab(tab.id);
                    }}
                    className="flex-1 py-2.5 text-xs font-black transition-all"
                    style={{
                      background:   modalTab===tab.id?'linear-gradient(135deg,#ea580c,#f97316)':'transparent',
                      color:        modalTab===tab.id?'#fff':tab.locked?'rgba(71,85,105,.5)':'rgba(148,163,184,1)',
                      opacity:      tab.locked?0.5:1,
                    }}>
                    {tab.label}{tab.locked?' 🔒':''}
                  </button>
                ))}
              </div>
            )}

            {/* ── CHART TAB ───────────────────────────────────────────── */}
            {(!isLive||modalTab==='chart')&&(
              <details className="group" open={true}>
                <summary className="flex items-center justify-between px-1 py-2 cursor-pointer list-none select-none">
                  <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">📈 Price Chart</span>
                  <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <MiniChart dA={activeBattle.chartA} dB={activeBattle.chartB} h={100} labelA={activeBattle.tokenA} labelB={activeBattle.tokenB} showLabels/>
              </details>
            )}

            {/* ── RUSHTRADE TAB ────────────────────────────────────────── */}
            {isLive&&modalTab==='rushtrade'&&hasJoined&&(()=>{
              const activeToken  = rushPosition?.token ?? activeBattle.tokenA;
              const curChange    = activeToken===activeBattle.tokenA ? aL : bL;
              const pointsColor  = rushPnL>=0?'#4ade80':'#f87171';

              return(
                <div className="space-y-4">

                  {/* Points balance */}
                  <div className="rounded-2xl border border-orange-500/15 p-4 flex items-center justify-between" style={{background:'rgba(30,12,2,.8)'}}>
                    <div>
                      <p className="text-[9px] font-black text-orange-400 tracking-widest uppercase mb-1">Rush Points</p>
                      <p className="text-2xl font-black text-white tabular-nums">{rushPoints.toFixed(1)}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Earned this session</p>
                    </div>
                    {rushPosition&&(
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-500 tracking-widest uppercase mb-1">Open P&L</p>
                        <p className="text-xl font-black tabular-nums" style={{color:pointsColor}}>
                          {rushPnL>=0?'+':''}{(rushPnL*100).toFixed(1)} pts
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">{rushPosition.dir.toUpperCase()} {rushPosition.token}</p>
                      </div>
                    )}
                  </div>

                  {/* Simulated trade notice */}
                  <div className="rounded-xl px-3 py-2 text-[10px] text-slate-500 border border-white/[.04]" style={{background:'rgba(18,12,4,.6)'}}>
                    ⚡ <span className="font-bold text-slate-400">Simulated trading</span> — no real SOL. Points track real {activeBattle.tokenA}/{activeBattle.tokenB} price movement. May convert to $MRUSH at token launch.
                  </div>

                  {/* Position controls */}
                  {!rushPosition?(
                    <>
                      <p className="text-xs text-slate-500 text-center">Pick a direction on a token to open a simulated position:</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[activeBattle.tokenA, activeBattle.tokenB].map(tok=>{
                          const ch = tok===activeBattle.tokenA ? aL : bL;
                          return(
                            <div key={tok} className="rounded-2xl border border-white/[.06] overflow-hidden" style={{background:'rgba(18,12,4,.8)'}}>
                              <div className="flex items-center gap-2 p-3 border-b border-white/[.04]">
                                <img src={gl(tok)} alt={tok} className="w-7 h-7 rounded-full border border-white/10" onError={e=>(e.target as HTMLImageElement).src=ph(tok)}/>
                                <div>
                                  <p className="text-xs font-black text-white">{tok}</p>
                                  <p className={`text-[10px] font-black ${ch>=0?'text-emerald-400':'text-red-400'}`}>{ch>=0?'+':''}{ch.toFixed(3)}%</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 divide-x divide-white/[.04]">
                                <button
                                  onClick={()=>{
                                    const ch2=tok===activeBattle.tokenA?aL:bL;
                                    setRushPosition({dir:'long',token:tok,entryChange:ch2});
                                    notify(`⚡ LONG ${tok} opened at ${ch2.toFixed(3)}%`);
                                  }}
                                  className="py-2.5 text-[11px] font-black text-emerald-400 hover:bg-emerald-900/20 transition-colors active:scale-95">
                                  ▲ LONG
                                </button>
                                <button
                                  onClick={()=>{
                                    const ch2=tok===activeBattle.tokenA?aL:bL;
                                    setRushPosition({dir:'short',token:tok,entryChange:ch2});
                                    notify(`⚡ SHORT ${tok} opened at ${ch2.toFixed(3)}%`);
                                  }}
                                  className="py-2.5 text-[11px] font-black text-red-400 hover:bg-red-900/20 transition-colors active:scale-95">
                                  ▼ SHORT
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ):(
                    <>
                      {/* Open position card */}
                      <div className="rounded-2xl border p-4 space-y-3" style={{background:'rgba(18,12,4,.9)',borderColor:rushPnL>=0?'rgba(74,222,128,.25)':'rgba(248,113,113,.25)'}}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img src={gl(rushPosition.token)} alt={rushPosition.token} className="w-8 h-8 rounded-full border border-white/10" onError={e=>(e.target as HTMLImageElement).src=ph(rushPosition.token)}/>
                            <div>
                              <p className="text-xs font-black text-white">{rushPosition.dir==='long'?'▲ LONG':'▼ SHORT'} {rushPosition.token}</p>
                              <p className="text-[10px] text-slate-600">Entry: {rushPosition.entryChange.toFixed(3)}% → Now: {curChange.toFixed(3)}%</p>
                            </div>
                          </div>
                          <p className="text-xl font-black tabular-nums" style={{color:pointsColor}}>
                            {rushPnL>=0?'+':''}{(rushPnL*100).toFixed(1)}
                            <span className="text-[10px] text-slate-500 font-normal ml-1">pts</span>
                          </p>
                        </div>
                        <button
                          onClick={()=>{
                            const earned = parseFloat((rushPnL*100).toFixed(1));
                            if(earned>0) setRushPoints(p=>parseFloat((p+earned).toFixed(1)));
                            notify(earned>0?`✅ Closed +${earned} pts!`:earned<0?`Position closed ${earned} pts`:'Position closed (flat)');
                            setRushPosition(null);
                          }}
                          className="w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-95"
                          style={{background:rushPnL>=0?'linear-gradient(135deg,#059669,#047857)':'linear-gradient(135deg,#dc2626,#b91c1c)'}}>
                          Close Position · {rushPnL>=0?'+':''}{(rushPnL*100).toFixed(1)} pts
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 text-center">Position closes automatically when battle ends</p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ── JOIN BET SECTION (below tabs, always visible when live) ── */}
            {isLive&&modalTab==='chart'&&(
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setPaymentToken('SOL')} className="py-3 rounded-xl text-sm font-bold border transition-all min-h-[44px]" style={{borderColor:paymentToken==='SOL'?'rgba(249,115,22,.8)':'rgba(71,85,105,.3)',background:paymentToken==='SOL'?'rgba(249,115,22,.22)':'rgba(20,12,4,.6)',color:paymentToken==='SOL'?'white':'rgba(120,100,80,1)'}}>◎ SOL</button>
                  <button onClick={()=>setPaymentToken('MRUSH')} className="py-3 rounded-xl text-sm font-bold border transition-all min-h-[44px]" style={{borderColor:paymentToken==='MRUSH'?'rgba(249,115,22,.8)':'rgba(71,85,105,.3)',background:paymentToken==='MRUSH'?'rgba(249,115,22,.22)':'rgba(30,41,59,.5)',color:paymentToken==='MRUSH'?'white':'rgba(100,116,139,1)'}}>
                    <img src="https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c" alt="MRUSH" className="w-4 h-4 rounded-full inline mr-1" onError={e=>(e.target as HTMLImageElement).src=ph('MR')}/>MRUSH
                  </button>
                </div>
                <div>
                  <input type="number" step={paymentToken==='SOL'?'0.001':'10000'} min={paymentToken==='SOL'?String(CFG.MIN_BET_SOL):'50000'} value={joinAmount} onChange={e=>setJoinAmount(e.target.value)} placeholder={paymentToken==='SOL'?'Amount in SOL':'Amount in MRUSH'} className="w-full rounded-xl px-4 py-3.5 text-white text-base border border-white/10 focus:border-orange-500 focus:outline-none bg-slate-900/80 min-h-[52px]"/>
                  <p className="text-xs text-slate-500 mt-1.5">Min: {CFG.MIN_BET_SOL} SOL (~$0.10) · Fee: {sf(jFee,6)} · Tier: {jTier.name}</p>
                </div>
                <button onClick={handleJoinBattle} disabled={isJoiningBattle||!connected||!pickedSide} className="w-full py-5 rounded-2xl font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[60px]" style={{background:(!connected||!pickedSide)?'rgba(249,115,22,.2)':'linear-gradient(135deg,#ea580c,#f97316)',boxShadow:(!connected||!pickedSide)?'none':'0 0 28px rgba(249,115,22,.4)'}}>
                  {isJoiningBattle
                    ? '⏳ Confirming in wallet…'
                    : !connected
                      ? '🔗 Connect Wallet'
                      : !pickedSide
                        ? '👆 Pick a side first'
                        : `⚔️ Bet ${joinAmount} ${paymentToken} on ${pickedSide==='A'?activeBattle?.tokenA:activeBattle?.tokenB}`
                  }
                </button>
              </div>
            )}

            {/* ── PAYOUT PROOF ─────────────────────────────────────────── */}
            {activeBattle.status==='paid'&&activeBattle.payoutSignature&&(activeBattle.mode??'arena')==='real'&&!activeBattle.payoutSignature.startsWith('PENDING')&&!activeBattle.payoutSignature.startsWith('ARENA')&&(
              <a href={`${CFG.solscan}/tx/${activeBattle.payoutSignature}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-emerald-400 border border-emerald-500/25 hover:bg-emerald-900/20 transition-colors" style={{background:'rgba(6,78,59,.15)'}}>✅ Payout confirmed on-chain → verify ↗</a>
            )}
            <button onClick={()=>handleShare(activeBattle.id,activeBattle.prizePool)} className="w-full py-2.5 rounded-xl text-xs font-bold text-orange-400 border border-orange-500/20 hover:bg-orange-900/20 transition-colors">🔗 Share & Earn 0.1% per join</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Create Modal ───────────────────────────────────────────────────────────
  const renderCreateModal=()=>(
    <div className="fixed inset-0 z-[9997] flex items-end justify-center bg-black/85 backdrop-blur-md">
      <div className="w-full max-h-[95dvh] overflow-y-auto rounded-t-3xl border" style={{background:'linear-gradient(160deg,#0c0804,#1a0e04)',borderColor:'rgba(249,115,22,.4)'}}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0">
          <div className="w-10 h-1 rounded-full" style={{background:'rgba(255,255,255,.15)'}}/>
        </div>
        <div className="px-5 pb-8 pt-3 space-y-4">
        <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-black">⚔️ Create Battle</h3><button onClick={()=>setShowCreateModal(false)} className="w-10 h-10 rounded-full text-slate-400 active:scale-90 flex items-center justify-center" style={{background:'rgba(30,41,59,.5)'}}>✕</button></div>
        <div className="rounded-xl p-3 text-xs mb-4 border border-yellow-500/30 space-y-1.5" style={{background:'rgba(120,53,15,.15)'}}>
          <div className="flex items-center gap-2 justify-center">
            <span className="text-yellow-300 font-black text-sm">💰 REAL MODE</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold text-emerald-300" style={{background:'rgba(6,78,59,.5)',border:'1px solid rgba(16,185,129,.3)'}}>On-chain</span>
          </div>
          <p className="text-slate-300 text-center">Your SOL goes to treasury → winner paid automatically on-chain</p>
          {solBal!==null&&<p className="text-center text-slate-500">Your balance: <span className="text-white font-bold">{sf(solBal,4)} SOL</span></p>}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-2 font-bold">Quick Select</p>
            <div className="flex flex-wrap gap-2">
              {tokens.filter(t=>t.trending||['SOL','MRUSH'].includes(t.symbol)).slice(0,9).map(tok=>(
                <button key={tok.symbol} onClick={()=>{if(!createTokenA||createTokenA===tok.symbol)setCreateTokenA(tok.symbol);else if(createTokenB!==tok.symbol)setCreateTokenB(tok.symbol);}} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${createTokenA===tok.symbol||createTokenB===tok.symbol?'border-orange-500 text-white':'border-white/10 text-slate-300 hover:border-slate-500'}`} style={{background:createTokenA===tok.symbol||createTokenB===tok.symbol?'rgba(249,115,22,.2)':'rgba(30,41,59,.5)'}}>
                  <img src={tok.logoUrl} alt={tok.symbol} className="w-4 h-4 rounded-full" onError={e=>(e.target as HTMLImageElement).src=ph(tok.symbol)}/>{tok.symbol}
                </button>
              ))}
              <button onClick={()=>{setShowCreateModal(false);setShowAddTokenModal(true);}} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-cyan-500/50 text-xs font-bold text-cyan-400 hover:bg-cyan-900/20 transition-all">+ Add CA</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['A','B'] as const).map(s=>{const sym=s==='A'?createTokenA:createTokenB;const tok=tokens.find(t=>t.symbol===sym);return(
              <div key={s} className="rounded-2xl p-3 text-center border border-white/5" style={{background:'rgba(30,41,59,.5)'}}>
                {tok&&<img src={tok.logoUrl} alt={sym} className="w-10 h-10 rounded-full mx-auto mb-1" onError={e=>(e.target as HTMLImageElement).src=ph(sym)}/>}
                <select value={sym} onChange={e=>s==='A'?setCreateTokenA(e.target.value):setCreateTokenB(e.target.value)} className="w-full bg-transparent text-center font-bold text-white text-sm focus:outline-none cursor-pointer">{tokens.filter(t=>t.symbol!==(s==='A'?createTokenB:createTokenA)).map(t=><option key={t.symbol} value={t.symbol} className="bg-slate-900">{t.symbol}</option>)}</select>
              </div>
            );})}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 mb-1.5 block font-bold">Bet Amount (SOL)</label><input type="number" step="0.001" min={String(CFG.MIN_BET_SOL)} max={String(CFG.MAX_BET_SOL)} value={createAmount} onChange={e=>setCreateAmount(parseFloat(e.target.value)||0)} className="w-full rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:border-orange-500 focus:outline-none bg-slate-900/80"/></div>
            <div><label className="text-xs text-slate-400 mb-1.5 block font-bold">Duration</label><select value={createDuration} onChange={e=>setCreateDuration(Number(e.target.value))} className="w-full rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:border-orange-500 focus:outline-none bg-slate-900/80">{DURS.map(d=><option key={d.v} value={d.v}>{d.l}</option>)}</select></div>
          </div>
          {(()=>{const{fee:cf,prize:cp}=calcFee(createAmount,mrushBal??0);return(
            <div className="p-3 rounded-xl text-xs space-y-1.5 border border-orange-500/20" style={{background:'rgba(120,53,15,.08)'}}>
              {[
                ['Deposit Amount', `${createAmount} SOL`],
                [`Platform Fee (${sf(CFG.feeBase*(1-tier.disc/100),1)}% · ${tier.name})`, `-${sf(cf,4)} SOL`],
              ].map(([l,v])=>(
                <div key={l} className="flex justify-between">
                  <span className="text-slate-400">{l}</span>
                  <span className={v.startsWith('-')?'text-red-400 font-bold':'text-white font-bold'}>{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1">
                <span className="text-slate-300 font-bold">Prize Pool</span>
                <span className="text-emerald-400 font-black">{sf(cp,4)} SOL</span>
              </div>
            </div>
          );})()}

          <button onClick={handleCreateBattle} disabled={isCreatingBattle||!connected||createTokenA===createTokenB} className="w-full py-5 rounded-2xl font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[60px]" style={{background:(!connected||createTokenA===createTokenB)?'rgba(249,115,22,.2)':'linear-gradient(135deg,#ea580c,#f97316)',boxShadow:(!connected||createTokenA===createTokenB)?'none':'0 0 24px rgba(249,115,22,.4)'}}>
            {isCreatingBattle
              ? '⏳ Waiting for wallet confirmation…'
              : !connected
                ? '🔗 Connect Wallet'
                : createTokenA===createTokenB
                  ? 'Select two different tokens'
                  : `⚔️ Create Battle — Deposit ${createAmount} SOL`}
          </button>
          <p className="text-center text-xs text-slate-500">💰 SOL deposited to treasury · Winner paid automatically on-chain</p>
        </div>
        </div>
      </div>
    </div>
  );

  // ── MAIN RETURN ─────────────────────────────────────────────────────────────
  return(
    <div className="min-h-screen text-white overflow-y-auto" style={{background:'#040410',paddingBottom:'calc(env(safe-area-inset-bottom) + 72px)'}}>

      {/* Top bar — sticky status */}
      <div className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5" style={{background:'rgba(5,3,1,.94)'}}>
        <div className="max-w-lg mx-auto px-3 py-2 flex items-center justify-between gap-2">
          {/* Logo + status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logomeme.png" alt="MemeRush" className="w-7 h-7 rounded-full object-cover flex-shrink-0" onError={e=>(e.target as HTMLImageElement).style.display='none'}/>
            <div className="min-w-0">
              <p className="text-sm font-black bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent leading-none">MemeRush</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${realtimeOk?'bg-emerald-400 animate-pulse':'bg-yellow-400'}`}/>
                <span className="text-[10px] text-slate-500 truncate">{realtimeOk?'Realtime synced':'Connecting…'}</span>
              </div>
            </div>
          </div>

          {/* MRUSH price pill (mobile: icon only, sm+: full) */}
          {mrushLive&&mrushLive.price>0&&(
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-white/10 flex-shrink-0" style={{background:'rgba(25,15,5,.7)'}}>
              <img src={tokens.find(t=>t.symbol==='MRUSH')?.logoUrl} alt="MRUSH" className="w-3.5 h-3.5 rounded-full" onError={e=>(e.target as HTMLImageElement).src=ph('MR')}/>
              <span className="font-mono font-bold text-white">${mrushLive.price.toFixed(6)}</span>
              <span className={mrushLive.ch24>=0?'text-emerald-400':'text-red-400'}>{mrushLive.ch24>=0?'▲':'▼'}{Math.abs(mrushLive.ch24).toFixed(1)}%</span>
            </div>
          )}

          {/* Wallet */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {connected&&publicKey&&(
              <div className="hidden sm:block text-right">
                <p className="text-xs font-mono text-cyan-400 leading-none">{sw(publicKey.toString())}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{solBal!==null?`${sf(solBal,3)} SOL`:'—'}</p>
              </div>
            )}
            <WalletMultiButton className="!rounded-xl !font-bold !text-xs !px-3 !py-2 !h-auto" style={{background:'linear-gradient(135deg,#ea580c,#f97316)'}}/>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {newBattleToast&&<div className="fixed top-14 left-1/2 -translate-x-1/2 z-[10001] px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-sm border border-cyan-500/50 animate-bounce" style={{background:'rgba(8,145,178,.95)'}}><p className="text-sm font-bold text-white whitespace-nowrap">{newBattleToast}</p></div>}
      {notif&&<div className="fixed top-14 left-1/2 -translate-x-1/2 z-[10000] px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-sm border border-orange-500/50" style={{background:'rgba(194,65,12,.9)'}}><p className="text-sm font-bold text-white whitespace-nowrap">{notif}</p></div>}
      {errMsg&&<div className="fixed top-14 right-3 z-[10000] max-w-xs p-4 rounded-2xl backdrop-blur-sm shadow-2xl border border-red-500/50" style={{background:'rgba(127,29,29,.95)'}}><p className="font-bold text-red-300 text-sm mb-1">⚠️ Error</p><p className="text-xs text-slate-300">{errMsg}</p><button onClick={()=>setErrMsg(null)} className="mt-2 text-xs text-red-400">Dismiss ✕</button></div>}
      {okMsg&&<div className="fixed top-14 right-3 z-[10000] max-w-xs p-4 rounded-2xl backdrop-blur-sm shadow-2xl border border-emerald-500/50" style={{background:'rgba(6,78,59,.95)'}}><p className="text-sm text-emerald-300 font-semibold break-all">{okMsg}</p></div>}
      {showWinToast&&<WinToast message="🏆 You Won!" amount={winAmount} onClose={()=>setShowWinToast(false)}/>}

      {/* Modals */}
      {activeBattle&&renderBattleModal()}
      {showCreateModal&&renderCreateModal()}

      {/* Add Token Modal */}
      {showAddTokenModal&&(
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/85 backdrop-blur-md">
          <div className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl border slide-up" style={{background:'linear-gradient(160deg,#0c0804,#1a0e04)',borderColor:'rgba(249,115,22,.4)'}}>
            <div className="flex justify-center pt-3 pb-0"><div className="w-10 h-1 rounded-full" style={{background:'rgba(255,255,255,.15)'}}/></div>
            <div className="flex items-center justify-between mb-5"><h3 className="text-xl font-black">🔗 Add Custom Token</h3><button onClick={()=>{setShowAddTokenModal(false);setFetchedTokenData(null);setFetchTokenError(null);}} className="p-2 rounded-full text-slate-400" style={{background:'rgba(30,41,59,.5)'}}>✕</button></div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-2 block font-bold">Solana Mint Address</label>
                <div className="flex gap-2">
                  <input type="text" value={customTokenAddress} onChange={e=>setCustomTokenAddress(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFetchToken()} placeholder="Paste mint address…" className="flex-1 rounded-xl px-3 py-2.5 text-white text-xs font-mono border border-white/10 focus:border-orange-500 focus:outline-none bg-slate-900/80"/>
                  <button onClick={handleFetchToken} disabled={isFetchingToken} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{background:'rgba(234,88,12,.8)'}}>{isFetchingToken?'…':'Fetch'}</button>
                </div>
                {fetchTokenError&&<p className="text-red-400 text-xs mt-1.5">{fetchTokenError}</p>}
              </div>
              {fetchedTokenData&&(
                <div className="p-4 rounded-2xl border border-white/10 space-y-3" style={{background:'rgba(30,41,59,.5)'}}>
                  <div className="flex items-center gap-3">
                    <img src={fetchedTokenData.logoUrl} alt={fetchedTokenData.symbol} className="w-12 h-12 rounded-full" onError={e=>(e.target as HTMLImageElement).src=ph(fetchedTokenData.symbol)}/>
                    <div><p className="font-black text-white text-lg">{fetchedTokenData.symbol}</p><p className="text-slate-400 text-sm">{fetchedTokenData.name}</p><p className="text-slate-500 text-xs">${fmtP(fetchedTokenData.price)}</p></div>
                    {fetchedTokenData.lpBurned?<span className="ml-auto px-2 py-1 rounded-xl text-xs font-bold text-orange-400 border border-orange-500/40" style={{background:'rgba(154,52,18,.2)'}}>🔥 LP Burned</span>:<span className="ml-auto px-2 py-1 rounded-xl text-xs text-yellow-400 border border-yellow-500/30" style={{background:'rgba(120,53,15,.2)'}}>⚠️ LP not burned</span>}
                  </div>
                  <button onClick={handleAddToken} className="w-full py-3 rounded-xl font-bold text-sm hover:scale-105 transition-all" style={{background:'linear-gradient(135deg,#c2410c,#ea580c)'}}>✅ Add {fetchedTokenData.symbol} to Battle</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-lg mx-auto px-3 py-3 space-y-3">
        {activeTab==='arena'&&renderArena()}
        {activeTab==='chat'&&renderChat()}
        {activeTab==='stats'&&renderStats()}
        {activeTab==='profile'&&renderProfile()}
      </main>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab}/>

      <style jsx global>{`
        :root{--mr-orange:#f97316;--mr-orange-dark:#ea580c;--mr-amber:#fbbf24;--mr-bg:#040410;--mr-glow:0 0 14px rgba(249,115,22,.4)}
        html,body{overflow-y:auto!important;-webkit-overflow-scrolling:touch;background:#040410;overscroll-behavior:none}
        /* Prevent Android zoom on input focus */
        input,select,textarea{font-size:16px!important}
        ::-webkit-scrollbar{width:2px;height:2px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(249,115,22,.25);border-radius:2px}
        *{scrollbar-width:thin;scrollbar-color:rgba(249,115,22,.2) transparent;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
        input[type=number]::-webkit-inner-spin-button{opacity:0.4}
        .scrollbar-none{scrollbar-width:none}
        .scrollbar-none::-webkit-scrollbar{display:none}
        details>summary{-webkit-user-select:none;user-select:none}
        @keyframes mr-fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mr-glow-pulse{0%,100%{box-shadow:0 0 10px rgba(249,115,22,.25)}50%{box-shadow:0 0 24px rgba(249,115,22,.55)}}
        .mr-fade-up{animation:mr-fade-up .2s ease-out}
        .mr-glow-btn:hover{animation:mr-glow-pulse 1.5s ease-in-out infinite}
        .wallet-adapter-button{background:linear-gradient(135deg,#ea580c,#f97316)!important;border-radius:.75rem!important;font-weight:900!important;font-size:12px!important;padding:8px 12px!important;height:auto!important;box-shadow:0 0 14px rgba(249,115,22,.35)!important}
        .wallet-adapter-button:hover{background:linear-gradient(135deg,#f97316,#fbbf24)!important;box-shadow:0 0 22px rgba(249,115,22,.55)!important}
        .wallet-adapter-modal-wrapper{background:rgba(12,6,2,.98)!important;border:1px solid rgba(249,115,22,.3)!important}
        /* Android bottom sheet animation */
        @keyframes slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .slide-up{animation:slide-up .28s cubic-bezier(.32,.72,0,1)}
        /* Better button active states for Android */
        button:active{opacity:.85}
      `}</style>
    </div>
  );
}


export default function TradePage(){
  return(
    <ErrorBoundary>
      <GameProvider>
        <TradeContent/>
      </GameProvider>
    </ErrorBoundary>
  );
    }
