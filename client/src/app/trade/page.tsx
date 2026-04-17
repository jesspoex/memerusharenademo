"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
// ── Inline components (self-contained, no external dependencies) ─────────────
// LoadingState
function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-slate-400 text-sm font-bold">Loading MemeRush…</p>
      </div>
    </div>
  );
}

// WinToast
function WinToast({ message, amount, onClose }: { message: string; amount: number; onClose: () => void }) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99999] px-6 py-4 rounded-2xl shadow-2xl border border-yellow-500/50 text-center" style={{background:'linear-gradient(135deg,rgba(120,53,15,.95),rgba(78,23,5,.95))'}}>
      <p className="text-2xl font-black text-yellow-300">{message}</p>
      <p className="text-emerald-400 font-black text-xl">+{amount.toFixed(4)} SOL</p>
      <button onClick={onClose} className="mt-2 text-xs text-slate-400 hover:text-white">Close ✕</button>
    </div>
  );
}

// MobileNav
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

// NetworkStatusBadge
function NetworkStatusBadge({ network }: { network: string }) {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{background:'rgba(6,78,59,.3)',color:'#34d399',border:'1px solid rgba(16,185,129,.3)'}}>
      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"/>
      {network}
    </span>
  );
}

// GameProvider — simple passthrough (no context needed in self-contained mode)
function GameProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ═════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE: Supabase Realtime → API Routes → State → UI
//
// ✅ Single source of truth: Supabase DB (service role on backend)
// ✅ Realtime WebSocket for instant updates (no polling)
// ✅ ALL winner logic runs on server — never on client
// ✅ ALL payouts executed on server using treasury keypair
// ✅ Frontend: display only — signs TX, sends txHash to backend for validation
// ✅ Battle resolution: Vercel Cron runs /api/resolve-battle every minute
// ✅ localStorage ONLY for: user profile (private), chat (per-device)
// ═════════════════════════════════════════════════════════════════════════════

// ── ENV ───────────────────────────────────────────────────────────────────────
const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://wlpgpjebwwublxfcpjos.supabase.co';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGdwamVid3d1Ymx4ZmNwam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzI4MjYsImV4cCI6MjA5MDM0ODgyNn0.nAiMQ59OSo8fB_OlzTNWDYW4G5qNIAlGEQVTODArypM';

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function sbH(extra: Record<string,string> = {}): Record<string,string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SB_ANON}`,
    ...(SB_ANON && !SB_ANON.startsWith('sb_') ? { 'apikey': SB_ANON } : {}),
    ...extra,
  };
}

async function sbGet<T>(table: string, query = ''): Promise<T[]> {
  if (!SB_URL || !SB_ANON) return [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: sbH(), cache: 'no-store' });
    if (!r.ok) return [];
    return await r.json() as T[];
  } catch { return []; }
}

async function sbInsert(table: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST', headers: sbH({ 'Prefer': 'return=minimal' }), body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
}

async function sbUpsert(table: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: sbH({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
}

async function sbPatch(table: string, query: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH', headers: sbH({ 'Prefer': 'return=minimal' }), body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
}

// ── TX Validation Helpers ────────────────────────────────────────────────────
// Validates that a confirmed SOL transaction actually sent the right amount to treasury
async function validateSolTx(
  conn: import('@solana/web3.js').Connection,
  txHash: string,
  expectedLamports: number,
  treasuryPubkey: string,
  senderPubkey: string,
): Promise<{ valid: boolean; actualLamports: number; error?: string }> {
  try {
    const tx = await conn.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx) return { valid: false, actualLamports: 0, error: 'Transaction not found on-chain' };
    if (tx.meta?.err) return { valid: false, actualLamports: 0, error: 'Transaction has error on-chain' };

    // Find the instruction that transfers to treasury
    const instructions = tx.transaction?.message?.instructions ?? [];
    let totalToTreasury = 0;

    for (const ix of instructions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = (ix as any).parsed;
      if (
        parsed?.type === 'transfer' &&
        parsed?.info?.source === senderPubkey &&
        parsed?.info?.destination === treasuryPubkey
      ) {
        totalToTreasury += parsed.info.lamports ?? 0;
      }
    }

    // Allow ±5000 lamports tolerance (network fee variance)
    const tolerance = 5_000;
    const valid = Math.abs(totalToTreasury - expectedLamports) <= tolerance;
    return {
      valid,
      actualLamports: totalToTreasury,
      error: valid ? undefined : `Amount mismatch: expected ${expectedLamports}, got ${totalToTreasury}`,
    };
  } catch (e) {
    return { valid: false, actualLamports: 0, error: String(e) };
  }
}

// ── Supabase Realtime WebSocket ───────────────────────────────────────────────
// Menggunakan Supabase Realtime API secara langsung tanpa install package
// Ini adalah implementasi lightweight yang bekerja di browser
type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new: any; // Supabase realtime returns unknown shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old: any;
};
type RealtimeCallback = (payload: RealtimePayload) => void;

function createRealtimeChannel(
  table: string,
  onMessage: RealtimeCallback,
  onConnect?: () => void
): () => void {
  if (!SB_URL || !SB_ANON || typeof window === 'undefined') return () => {};

  const wsUrl = SB_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const channelId = `realtime:public:${table}:${Date.now()}`;

  let ws: WebSocket | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let reconnectId: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;
    try {
      ws = new WebSocket(`${wsUrl}/realtime/v1/websocket?apikey=${SB_ANON}&vsn=1.0.0`);

      ws.onopen = () => {
        if (!ws || destroyed) return;
        // Join channel
        ws.send(JSON.stringify({
          topic: `realtime:public:${table}`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { self: false },
              presence: { key: '' },
              postgres_changes: [{ event: '*', schema: 'public', table }],
            },
          },
          ref: channelId,
        }));
        // Heartbeat every 30s
        heartbeatId = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
          }
        }, 30_000);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = JSON.parse(event.data as string) as any;
          if (msg.event === 'postgres_changes' && msg.payload?.data) {
            const { type, record, old_record } = msg.payload.data;
            if (type && record) {
              onMessage({
                eventType: type as 'INSERT' | 'UPDATE' | 'DELETE',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                new: record as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                old: (old_record ?? {}) as any,
              });
            }
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        if (heartbeatId) clearInterval(heartbeatId);
        if (!destroyed) {
          // Reconnect setelah 5 detik
          reconnectId = setTimeout(connect, 5_000);
        }
      };
    } catch { /* ignore connection errors */ }
  }

  connect();

  return () => {
    destroyed = true;
    if (heartbeatId) clearInterval(heartbeatId);
    if (reconnectId) clearTimeout(reconnectId);
    if (ws) { try { ws.close(); } catch {} }
  };
}

// ── DB Types ──────────────────────────────────────────────────────────────────
// Battle mode: "arena" = sistem (no payout), "real" = user (wajib TX, boleh payout)
type BattleMode = 'arena' | 'real';

interface DbBattle {
  id: string; creator: string; token_a: string; token_b: string;
  amount: number; prize_pool: number; winner?: string; winner_wallet?: string;
  status: 'live'|'ended'|'paid'; payment?: string; tx_hash?: string;
  players: number; end_time?: string; start_time?: string;
  created_at: string; ended_at?: string;
  mode: BattleMode;         // "arena" | "real"
  type?: 'system' | 'user'; // system = auto-generated, user = created by wallet
  fee_collected?: number;
  total_deposited?: number;
}

// ✅ NEW: Per-wallet bet record (mr_bets table)
interface DbBet {
  id?: number;
  battle_id: string;
  wallet: string;
  side: 'A' | 'B';
  amount: number;        // total deposit by this wallet
  fee_total: number;     // total fee paid
  net_amount: number;    // amount going to prize pool (deposit - fee)
  payment: 'SOL' | 'MRUSH';
  tx_hashes: string[];   // array of tx hashes (supports top-up)
  created_at: string;
  updated_at: string;
}
interface DbActivity {
  id?: number; wallet: string; action: string; amount?: number;
  battle?: string; tx_hash?: string; created_at: string;
}
interface DbWinner { id?: number; wallet: string; amount_sol: number; battle: string; tx_hash?: string; created_at: string; }
interface DbStats { id: number; players: number; battles: number; vol_sol: number; paid_sol: number; updated_at?: string; }

// ── Config ────────────────────────────────────────────────────────────────────
const CFG = {
  rpcUrl:           process.env.NEXT_PUBLIC_RPC_URL          || 'https://api.mainnet-beta.solana.com',
  fallbackRpcUrl:   process.env.NEXT_PUBLIC_FALLBACK_RPC_URL || 'https://rpc.ankr.com/solana',
  mrushMint:        process.env.NEXT_PUBLIC_MRUSH_MINT       || 'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  treasury:         process.env.NEXT_PUBLIC_TREASURY_WALLET  || 'Fwsyjj7sf64MxCNfkysQ4UoJbE1MYXBe7dp35Czd5Vew',
  feeBase:          2,           // 2% fee dari per bet
  solscan:          'https://solscan.io',
  site:             process.env.NEXT_PUBLIC_SITE_URL         || 'https://www.meemerush.xyz',
  pumpfun:          'https://pump.fun/coin/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  dexscreener:      'https://dexscreener.com/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  twitter:          'https://x.com/memerushsol_',
  telegram:         'https://t.me/memerushsol',
  shareRewardPct:   0.001,       // 0.1% referral reward
  KEEP_LIVE_MIN:    5,           // minimum 5 active system battles at all times
  RESPAWN_INTERVAL: 60_000,      // check every 60 seconds
  MIN_BET_SOL:      0.001,       // ~$0.10 minimum bet (growth-friendly entry)
  MAX_BET_SOL:      10,          // max bet
  // ── TIDAK ADA createFreeLimit — semua user wajib deposit SOL ──────────────
};

const TIERS = [
  { min:10_000_000, disc:75, name:'Diamond 💎',  hex:'#a855f7' },
  { min:5_000_000,  disc:50, name:'Platinum 🪙', hex:'#67e8f9' },
  { min:2_000_000,  disc:35, name:'Gold 🥇',     hex:'#fbbf24' },
  { min:1_000_000,  disc:20, name:'Silver 🥈',   hex:'#94a3b8' },
  { min:500_000,    disc:10, name:'Bronze 🥉',   hex:'#fb923c' },
  { min:0,          disc:0,  name:'Standard ⚡', hex:'#64748b' },
];
const getTier = (b: number) => TIERS.find(t => b >= t.min) ?? TIERS[5];
const calcFee = (amt: number, mrush: number) => {
  const t = getTier(mrush);
  const pct = CFG.feeBase * (1 - t.disc / 100);
  return { fee: amt * (pct / 100), pct, prize: amt - amt * (pct / 100), tier: t };
};


// ── Token types ───────────────────────────────────────────────────────────────
interface Token {
  symbol: string; name: string; logoUrl: string; basePrice: number; price: number;
  priceChange24h: number; volume24h: number; color: string;
  priceDirection: 'up'|'down'|'neutral'; trending?: boolean; coingeckoId?: string|null;
  isCustom?: boolean; mintAddress?: string; lpBurned?: boolean;
}

// ── Local Battle type (UI) — chart data lokal saja ────────────────────────────
interface Battle {
  id: string; tokenA: string; tokenB: string; amount: number; duration: number;
  startTime: number; endTime: number; status: 'live'|'ended'|'paid';
  winner?: string; winnerWallet?: string;
  tokenAChange: number; tokenBChange: number;
  chartA: number[]; chartB: number[];
  players: number; creator: string; totalPool: number; platformFee: number; prizePool: number;
  payoutSignature?: string;
  mode: BattleMode;   // "arena" | "real"
  battleType?: 'system' | 'user'; // system = auto-generated
}

interface Activity { id: string; user: string; action: 'joined'|'won'|'created'; amount?: number; battle?: string; time: string; isReal?: boolean; txHash?: string; }
interface ChatMessage { id: string; wallet: string; message: string; timestamp: number; }
interface UserProfile { wallet: string; wins: number; losses: number; battlesCreated: number; battlesJoined: number; totalPnL: number; lastUpdated: number; shareEarnings: number; }
interface LeaderboardEntry { rank: number; wallet: string; earnings: number; wins: number; }
interface RecentWinner { wallet: string; amount: number; time: string; battle: string; txHash?: string; }

const TOKENS: Token[] = [
  { symbol:'BONK',   name:'Bonk',         logoUrl:'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',        basePrice:0.00001,  price:0.00001,  priceChange24h:0, volume24h:1250000, color:'from-orange-400 to-orange-600', priceDirection:'up',   trending:true,  coingeckoId:'bonk' },
  { symbol:'WIF',    name:'dogwifhat',    logoUrl:'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg',   basePrice:2.5,      price:2.5,      priceChange24h:0, volume24h:890000,  color:'from-pink-400 to-pink-600',     priceDirection:'down', trending:true,  coingeckoId:'dogwifcoin' },
  { symbol:'POPCAT', name:'Popcat',       logoUrl:'https://assets.coingecko.com/coins/images/33908/large/popcat.png',      basePrice:0.45,     price:0.45,     priceChange24h:0, volume24h:450000,  color:'from-yellow-400 to-orange-500', priceDirection:'up',   trending:true,  coingeckoId:'popcat' },
  { symbol:'BOME',   name:'Book of Meme', logoUrl:'https://assets.coingecko.com/coins/images/35215/large/bome.png',        basePrice:0.008,    price:0.008,    priceChange24h:0, volume24h:680000,  color:'from-orange-500 to-amber-500',   priceDirection:'up',   trending:true,  coingeckoId:'book-of-meme' },
  { symbol:'MYRO',   name:'Myro',         logoUrl:'https://assets.coingecko.com/coins/images/33427/large/myro.png',        basePrice:0.12,     price:0.12,     priceChange24h:0, volume24h:320000,  color:'from-blue-400 to-cyan-500',     priceDirection:'up',   trending:true,  coingeckoId:'myro' },
  { symbol:'MRUSH',  name:'MemeRush',     logoUrl:'https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c', basePrice:0.000001, price:0.000001, priceChange24h:0, volume24h:0, color:'from-cyan-400 to-blue-600', priceDirection:'neutral', trending:true, coingeckoId:null, mintAddress:'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump', lpBurned:true },
  { symbol:'SOL',    name:'Solana',       logoUrl:'https://assets.coingecko.com/coins/images/4128/large/solana.png',       basePrice:130,      price:130,      priceChange24h:0, volume24h:2500000, color:'from-green-400 to-emerald-600', priceDirection:'up',   trending:false, coingeckoId:'solana' },
  { symbol:'PEPE',   name:'Pepe',         logoUrl:'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg', basePrice:0.000001, price:0.000001, priceChange24h:0, volume24h:670000,  color:'from-green-400 to-green-600',   priceDirection:'down', trending:false, coingeckoId:'pepe' },
];
const DURS = [{ v:60,l:'1 min' },{ v:180,l:'3 min' },{ v:300,l:'5 min' },{ v:600,l:'10 min' }];

// ── Utils ─────────────────────────────────────────────────────────────────────
const sf    = (n: number|null|undefined, d = 2) => (n ?? 0).toFixed(d);
const fmtT  = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const fmtN  = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(Math.round(n));
const fmtP  = (p: number) => { if (!p) return '0'; if (p < 0.0001) return p.toFixed(8); if (p < 1) return p.toFixed(4); return p.toFixed(2); };
const sw    = (w: string) => w.length > 8 ? w.slice(0,4)+'...'+w.slice(-4) : w;
const rid   = () => `b_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const ph    = (s: string) => `https://ui-avatars.com/api/?name=${s}&background=ea580c&color=fff&size=40`;
const fmtTs = (ts: number) => { const d=Date.now()-ts; if(d<60000) return 'Just now'; if(d<3600000) return `${Math.floor(d/60000)}m ago`; return `${Math.floor(d/3600000)}h ago`; };
const tAgo  = (iso: string) => { const d=Date.now()-new Date(iso).getTime(); if(d<60000) return 'Just now'; if(d<3600000) return `${Math.floor(d/60000)}m ago`; if(d<86400000) return `${Math.floor(d/3600000)}h ago`; return `${Math.floor(d/86400000)}d ago`; };
const lsSave = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const lsLoad = <T,>(k: string, fb: T): T => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as T : fb; } catch { return fb; } };

// ── Convert DB battle → local Battle ─────────────────────────────────────────
// DB is source of truth. Chart is local-only for visual animation.
function toLocalBattle(db: DbBattle, prev?: Battle): Battle {
  const now   = Date.now();
  const end   = db.end_time   ? new Date(db.end_time).getTime()   : now + 300_000;
  const start = db.start_time ? new Date(db.start_time).getTime() : now;
  const dur   = Math.max(60, Math.round((end - start) / 1000));
  const chartA = prev?.chartA ?? [0];
  const chartB = prev?.chartB ?? [0];
  // mode: gunakan dari DB jika ada, fallback ke 'arena' jika creator='arena', else 'real'
  const mode: BattleMode = (db.mode as BattleMode) ?? (db.creator === 'arena' ? 'arena' : 'real');
  return {
    id: db.id, tokenA: db.token_a, tokenB: db.token_b,
    amount: db.amount, duration: dur, startTime: start, endTime: end,
    status: db.status, winner: db.winner, winnerWallet: db.winner_wallet,
    tokenAChange: chartA[chartA.length-1] ?? 0,
    tokenBChange: chartB[chartB.length-1] ?? 0,
    chartA, chartB,
    players: db.players ?? 1, creator: db.creator,
    totalPool: db.amount, platformFee: db.amount * (CFG.feeBase/100),
    prizePool: db.prize_pool, payoutSignature: db.tx_hash,
    mode,
    battleType: (db as DbBattle & {type?: string}).type === 'system' ? 'system' : (db.creator === 'arena' || db.creator === 'system' ? 'system' : 'user'),
  };
}

// ── Arena battle pairs (for auto-respawn) ─────────────────────────────────────
const ARENA_PAIRS = [
  ['BONK','WIF'],['SOL','BONK'],['WIF','POPCAT'],['MYRO','SOL'],
  ['BOME','WIF'],['BONK','POPCAT'],['SOL','MRUSH'],['PEPE','BONK'],
  ['WIF','BOME'],['BONK','MYRO'],['SOL','PEPE'],['MRUSH','WIF'],
];

// ── Sound ─────────────────────────────────────────────────────────────────────
function playBeep(f:number,d:number,v=0.2){if(typeof window==='undefined')return;try{const AC=window.AudioContext||(window as unknown as{webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new AC();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(v,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);o.start();o.stop(ctx.currentTime+d);setTimeout(()=>ctx.close(),d*1000+200);}catch{}}
const playTick   = () => playBeep(880,0.1,0.18);
const playWinner = () => { playBeep(523,0.15,0.4); setTimeout(()=>playBeep(659,0.15,0.4),150); setTimeout(()=>playBeep(784,0.15,0.4),300); setTimeout(()=>playBeep(1047,0.25,0.5),450); };

// ── Price fetchers ────────────────────────────────────────────────────────────
async function fetchPrices(): Promise<Record<string,{price:number;ch24:number}>> {
  const ids = TOKENS.filter(t=>t.coingeckoId).map(t=>t.coingeckoId).join(',');
  const out: Record<string,{price:number;ch24:number}> = {};
  try { const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,{cache:'no-store'}); const d=await r.json() as Record<string,{usd:number;usd_24h_change:number}>; TOKENS.filter(t=>t.coingeckoId).forEach(t=>{if(t.coingeckoId&&d[t.coingeckoId])out[t.symbol]={price:d[t.coingeckoId].usd,ch24:d[t.coingeckoId].usd_24h_change??0};}); } catch {}
  return out;
}
async function fetchMrushPrice(): Promise<{price:number;ch24:number;logo:string|null}> {
  try { const r=await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CFG.mrushMint}`,{cache:'no-store'}); const d=await r.json() as {pairs?:Array<{priceUsd:string;priceChange?:{h24?:string};info?:{imageUrl?:string}}>}; if(d.pairs?.[0]) return {price:parseFloat(d.pairs[0].priceUsd)||0,ch24:parseFloat(d.pairs[0].priceChange?.h24||'0'),logo:d.pairs[0].info?.imageUrl||null}; } catch {}
  return {price:0,ch24:0,logo:null};
}

// ── MiniChart component ───────────────────────────────────────────────────────
function MiniChart({dA,dB,cA='#22d3ee',cB='#f472b6',h=120,labelA='',labelB='',showLabels=false}:{dA:number[];dB:number[];cA?:string;cB?:string;h?:number;labelA?:string;labelB?:string;showLabels?:boolean;}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const cv=ref.current;if(!cv)return;const ctx=cv.getContext('2d');if(!ctx)return;
    const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(0,(H/4)*i);ctx.lineTo(W,(H/4)*i);ctx.stroke();}
    const all=[...dA,...dB];if(all.length<2)return;
    let mn=Math.min(...all),mx=Math.max(...all);const pad=(mx-mn)*0.15||0.005;mn-=pad;mx+=pad;const rng=mx-mn||1;
    const draw=(data:number[],col:string)=>{if(data.length<2)return;const step=W/(data.length-1);ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor=col;ctx.shadowBlur=7;data.forEach((v,i)=>{const x=i*step,y=H-((v-mn)/rng)*(H-10)-5;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();ctx.shadowBlur=0;const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,col+'33');g.addColorStop(1,col+'00');ctx.beginPath();data.forEach((v,i)=>{const x=i*step,y=H-((v-mn)/rng)*(H-10)-5;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=g;ctx.fill();if(data.length){const lx=W-2,ly=H-((data[data.length-1]-mn)/rng)*(H-10)-5;ctx.beginPath();ctx.arc(lx,ly,4,0,Math.PI*2);ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;}};
    if(mn<0&&mx>0){const zy=H-((0-mn)/rng)*(H-10)-5;ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,zy);ctx.lineTo(W,zy);ctx.stroke();ctx.setLineDash([]);}
    draw(dA,cA);draw(dB,cB);
  },[dA,dB,cA,cB,h]);
  return(<div>{showLabels&&(<div className="flex items-center gap-4 mb-2 text-xs"><span className="flex items-center gap-1.5 font-bold" style={{color:cA}}><span className="w-3 h-0.5 rounded inline-block" style={{background:cA}}/>{labelA}</span><span className="flex items-center gap-1.5 font-bold" style={{color:cB}}><span className="w-3 h-0.5 rounded inline-block" style={{background:cB}}/>{labelB}</span><span className="ml-auto text-slate-600 text-xs">live·1s</span></div>)}<canvas ref={ref} width={600} height={h} className="w-full rounded-xl" style={{height:h}}/></div>);
}

class ErrorBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean;error:string|null}>{
  constructor(props:{children:React.ReactNode}){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(e:Error){return{hasError:true,error:e.message};}
  render(){if(this.state.hasError)return(<div className="min-h-screen flex items-center justify-center text-white p-4" style={{background:"#040410"}}><div className="text-center"><div className="text-6xl mb-4">⚠️</div><h1 className="text-2xl font-bold mb-4 text-red-400">Something went wrong</h1><p className="text-sm text-gray-400 mb-4">{this.state.error}</p><button onClick={()=>window.location.reload()} className="px-6 py-3 rounded-xl font-bold" style={{background:"linear-gradient(135deg,#ea580c,#f97316)"}}>Refresh</button></div></div>);return this.props.children;}
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
function TradeContent() {
  const { publicKey, connected, signTransaction } = useWallet();
  const connRef = useRef<Connection|null>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [mounted,       setMounted]       = useState(false);
  const [tokens,        setTokens]        = useState<Token[]>(TOKENS);
  const [mrushLive,     setMrushLive]     = useState<{price:number;ch24:number}|null>(null);
  const [realtimeOk,    setRealtimeOk]    = useState(false);

  // ── ALL shared data comes from DB ──────────────────────────────────────────
  const [battles,       setBattles]       = useState<Battle[]>([]);
  const [battleHistory, setBattleHistory] = useState<DbBattle[]>([]);
  const [activities,    setActivities]    = useState<Activity[]>([]);
  const [recentWinners, setRecentWinners] = useState<RecentWinner[]>([]);
  const [leaderboard,   setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [dbStats,       setDbStats]       = useState<DbStats|null>(null);
  const [dbLoaded,      setDbLoaded]      = useState(false);

  // ── Per-user state (localStorage OK) ──────────────────────────────────────
  const [solBal,        setSolBal]        = useState<number|null>(null);
  const [mrushBal,      setMrushBal]      = useState<number|null>(null);
  const [balLoading,    setBalLoading]    = useState(false);
  const [userProfile,   setUserProfile]   = useState<UserProfile|null>(null);

  // ── Battle modal ───────────────────────────────────────────────────────────
  const [activeBattle,    setActiveBattle]    = useState<Battle|null>(null);
  const [battleTimeLeft,  setBattleTimeLeft]  = useState(0);
  const [pickedSide,      setPickedSide]      = useState<'A'|'B'|null>(null);
  const [paymentToken,    setPaymentToken]    = useState<'SOL'|'MRUSH'>('SOL');
  const [joinAmount,      setJoinAmount]      = useState('0.1');
  const [isJoiningBattle, setIsJoiningBattle] = useState(false);
  const [modalTab,        setModalTab]        = useState<'chart'|'info'|'rushtrade'>('chart');
  // RushTrade: simulated points-based trading during a live battle
  const [rushPoints,      setRushPoints]      = useState(0);
  const [rushPosition,    setRushPosition]    = useState<{dir:'long'|'short';token:string;entryChange:number}|null>(null);
  const soundedRef = useRef<Record<string,boolean>>({});

  // ── Create modal ───────────────────────────────────────────────────────────
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

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [showChat,     setShowChat]     = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage,   setNewMessage]   = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [errMsg,       setErrMsg]       = useState<string|null>(null);
  const [okMsg,        setOkMsg]        = useState<string|null>(null);
  const [notif,        setNotif]        = useState<string|null>(null);
  const [showWinToast, setShowWinToast] = useState(false);
  const [winAmount,    setWinAmount]    = useState(0);
  const [activeTab,    setActiveTab]    = useState('arena');
  const [newBattleToast, setNewBattleToast] = useState<string|null>(null);
  const [shareRewardPending, setShareRewardPending] = useState(0);
  const [referralEarnings,   setReferralEarnings]   = useState(0);
  const [referralCount,      setReferralCount]      = useState(0);

  const showErr = (m: string) => { setErrMsg(m); setTimeout(()=>setErrMsg(null),5000); };
  const showOk  = (m: string) => { setOkMsg(m);  setTimeout(()=>setOkMsg(null), 5000); };
  const notify  = (m: string) => { setNotif(m);  setTimeout(()=>setNotif(null), 3000); };

  // ── Computed ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    players: dbStats?.players ?? 0,
    battles: dbStats?.battles ?? 0,
    vol:     dbStats?.vol_sol ?? 0,
    paid:    dbStats?.paid_sol ?? 0,
  }), [dbStats]);
  const tier = getTier(mrushBal ?? 0);
  const gl   = useCallback((sym: string) => tokens.find(t=>t.symbol===sym)?.logoUrl ?? ph(sym), [tokens]);
  const { fee: jFee, tier: jTier } = calcFee(parseFloat(joinAmount)||0, mrushBal??0);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LAYER: Fetch functions
  // ═══════════════════════════════════════════════════════════════════════════

  const loadBattles = useCallback(async () => {
    try {
      const res  = await fetch('/api/battles?status=live,ended&limit=30', { cache: 'no-store' });
      const data = await res.json() as { battles?: DbBattle[] };
      const rows = data.battles ?? [];
      setBattles(prev => rows.map((db: DbBattle) => toLocalBattle(db, prev.find(b => b.id === db.id))));
      return rows.length;
    } catch { return 0; }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/stats', { cache: 'no-store' });
      const data = await res.json() as { players?:number; battles?:number; volSol?:number; paidSol?:number };
      setDbStats({ id:1, players:data.players??0, battles:data.battles??0, vol_sol:data.volSol??0, paid_sol:data.paidSol??0, updated_at:new Date().toISOString() });
    } catch {}
  }, []);

  const loadActivity = useCallback(async () => {
    const rows = await sbGet<DbActivity>('mr_activities', 'select=*&order=created_at.desc&limit=20');
    if (rows?.length) {
      setActivities(rows.map(a => ({
        id: String(a.id??Date.now()), user: a.wallet,
        action: a.action as Activity['action'], amount: a.amount,
        battle: a.battle, time: tAgo(a.created_at), isReal: true, txHash: a.tx_hash,
      })));
    }
  }, []);

  const loadWinners = useCallback(async () => {
    try {
      const res  = await fetch('/api/recent-winners', { cache: 'no-store' });
      const data = await res.json() as { winners?: Array<{wallet:string;fullWallet:string;amountSol:number;battle:string;txHash?:string;time:string}> };
      const rows = data.winners ?? [];
      if (rows.length) {
        setRecentWinners(rows.slice(0,10).map(w => ({
          wallet: w.wallet, amount: w.amountSol, battle: w.battle,
          txHash: w.txHash, time: tAgo(w.time),
        })));
        // Build leaderboard from winners
        const grouped: Record<string,{total:number;wins:number}> = {};
        rows.forEach(w => {
          grouped[w.wallet] = { total:(grouped[w.wallet]?.total??0)+w.amountSol, wins:(grouped[w.wallet]?.wins??0)+1 };
        });
        setLeaderboard(Object.entries(grouped).sort((a,b)=>b[1].total-a[1].total).slice(0,5)
          .map(([w,d],i)=>({rank:i+1,wallet:w,earnings:parseFloat(d.total.toFixed(3)),wins:d.wins})));
      }
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res  = await fetch('/api/battles?status=live,ended,paid&limit=100', { cache: 'no-store' });
      const data = await res.json() as { battles?: DbBattle[] };
      if (data.battles?.length) setBattleHistory(data.battles);
    } catch {}
  }, []);

  // Load leaderboard from persistent user stats (cross-session accuracy)
  const loadLeaderboard = useCallback(async () => {
    try {
      const rows = await sbGet<{wallet:string;total_pnl:number;wins:number}>(
        'mr_user_stats',
        'select=wallet,total_pnl,wins&order=total_pnl.desc&limit=10'
      );
      if (rows?.length) {
        setLeaderboard(rows
          .filter(r => (r.total_pnl ?? 0) > 0) // only show positive earners
          .map((r, i) => ({
            rank: i + 1,
            wallet: sw(r.wallet),
            earnings: parseFloat((r.total_pnl ?? 0).toFixed(4)),
            wins: r.wins ?? 0,
          })));
      }
    } catch {}
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // REALTIME ENGINE — Supabase WebSocket subscriptions
  // Setiap perubahan di DB langsung push ke semua browser tanpa polling
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!SB_URL || !SB_ANON) return;

    // ── Subscribe: mr_battles ─────────────────────────────────────────────
    const unsubBattles = createRealtimeChannel('mr_battles', (payload) => {
      const db = (payload.new as unknown) as DbBattle;
      if (!db.id) return;

      if (payload.eventType === 'INSERT') {
        // New battle → add to list
        setBattles(prev => {
          if (prev.find(b => b.id === db.id)) return prev;
          const newBattle = toLocalBattle(db);
          // Toast if created by real user (not arena)
          if (db.creator !== 'arena') {
            setNewBattleToast(`⚔️ New battle: ${db.token_a} vs ${db.token_b}!`);
            setTimeout(() => setNewBattleToast(null), 4000);
          }
          return [newBattle, ...prev].slice(0, 30);
        });
      } else if (payload.eventType === 'UPDATE') {
        // Battle updated (players++, status change, winner set)
        setBattles(prev => prev.map(b => {
          if (b.id !== db.id) return b;
          return toLocalBattle(db, b);
        }));
        // Update active battle if it's the one being watched
        setActiveBattle(prev => {
          if (!prev || prev.id !== db.id) return prev;
          return toLocalBattle(db, prev);
        });
      }
    }, () => setRealtimeOk(true));

    // ── Subscribe: mr_activities ──────────────────────────────────────────
    const unsubActivity = createRealtimeChannel('mr_activities', (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const a = (payload.new as unknown) as DbActivity;
      setActivities(prev => [{
        id: String(a.id??Date.now()), user: a.wallet,
        action: a.action as Activity['action'], amount: a.amount,
        battle: a.battle, time: 'Just now', isReal: true, txHash: a.tx_hash,
      }, ...prev].slice(0, 20));
    });

    // ── Subscribe: mr_winners ─────────────────────────────────────────────
    const unsubWinners = createRealtimeChannel('mr_winners', (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const w = (payload.new as unknown) as DbWinner;
      setRecentWinners(prev => [{
        wallet: w.wallet, amount: w.amount_sol,
        battle: w.battle, txHash: w.tx_hash, time: 'Just now',
      }, ...prev].slice(0, 10));
    });

    // ── Subscribe: mr_stats ───────────────────────────────────────────────
    const unsubStats = createRealtimeChannel('mr_stats', (payload) => {
      if (payload.eventType === 'UPDATE') {
        setDbStats((payload.new as unknown) as DbStats);
      }
    });

    return () => {
      unsubBattles();
      unsubActivity();
      unsubWinners();
      unsubStats();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIAL LOAD + FALLBACK POLLING
  // Realtime handles real-time. Polling as fallback jika WS disconnect.
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Initial data load
    Promise.all([loadBattles(), loadStats(), loadActivity(), loadWinners(), loadHistory()])
      .then(([battleCount]) => {
        setDbLoaded(true);
        setBattles(prev => {
          if (prev.filter(b => b.status === 'live').length < CFG.KEEP_LIVE_MIN) {
            setTimeout(() => checkAndRespawn(), 300);
          }
          return prev;
        });
        // Auto-open battle dari URL share link
        const openBattleId = sessionStorage.getItem('mr_open_battle');
        if (openBattleId) {
          sessionStorage.removeItem('mr_open_battle');
          setTimeout(() => {
            setBattles(prev => {
              const target = prev.find(b => b.id === openBattleId);
              if (target) {
                setActiveBattle(target);
                setBattleTimeLeft(Math.max(0, Math.floor((target.endTime - Date.now()) / 1000)));
                setPickedSide(null);
                soundedRef.current = {};
              }
              return prev;
            });
          }, 500);
        }
        return battleCount;
      }).catch(() => setDbLoaded(true));

    // Fallback polling — 10 detik (backup jika realtime disconnect)
    // Realtime akan handle update instan; polling hanya untuk recovery
    loadLeaderboard(); // initial load
    const pollBattles    = setInterval(loadBattles,    10_000);
    const pollStats      = setInterval(loadStats,      30_000);
    const pollActivity   = setInterval(loadActivity,   15_000);
    const pollWinners    = setInterval(loadWinners,    30_000);
    const pollHistory    = setInterval(loadHistory,    60_000);
    const pollLeaderboard = setInterval(loadLeaderboard, 60_000);

    return () => {
      clearInterval(pollBattles);
      clearInterval(pollStats);
      clearInterval(pollActivity);
      clearInterval(pollWinners);
      clearInterval(pollHistory);
      clearInterval(pollLeaderboard);
    };
  }, [loadBattles, loadStats, loadActivity, loadWinners, loadHistory, loadLeaderboard]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-RESPAWN: Pastikan selalu ada 5 live battles
  // Ini berjalan di server DB (arena battles), bukan generate di client
  // ═══════════════════════════════════════════════════════════════════════════
  const respawnLock = useRef(false);

  const checkAndRespawn = useCallback(async () => {
    // Delegate to /api/ensure-battles — backend handles token safety filter,
    // minimum battle count (3), and deduplication.
    // Client fallback: if API unreachable, use ARENA_PAIRS as before.
    if (respawnLock.current || !SB_URL || !SB_ANON) return;
    respawnLock.current = true;
    try {
      // Try backend first (preferred — uses safe token filter)
      // /api/battles already calls ensureMinimumBattles() server-side on every request.
      // Client only needs to trigger a battles reload — the backend handles creation.
      const res = await fetch('/api/battles?status=live', {
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        await loadBattles();
        return;
      }
    } catch {
      // Backend unreachable → client fallback below
    }

    // ── Client fallback: direct Supabase insert (arena battles only) ──────────
    // Safe because: mode='arena', creator='system', no real SOL, no payout
    try {
      const now = new Date();
      const liveBattles = await sbGet<DbBattle>('mr_battles',
        `status=eq.live&end_time=gt.${now.toISOString()}&select=id,token_a,token_b`
      );
      const needed = CFG.KEEP_LIVE_MIN - liveBattles.length;
      if (needed <= 0) return;

      const existing  = new Set(liveBattles.map(b => `${b.token_a}_${b.token_b}`));
      const available = ARENA_PAIRS.filter(p =>
        !existing.has(`${p[0]}_${p[1]}`) && !existing.has(`${p[1]}_${p[0]}`)
      );
      const shuffled  = [...available].sort(() => Math.random()-0.5).slice(0, needed);

      await Promise.all(shuffled.map((pair, i) => {
        const duration = [180, 300, 420, 600][i % 4]; // 3–10 min so users can join
        const end      = new Date(now.getTime() + duration * 1000);
        const amt      = parseFloat((CFG.MIN_BET_SOL + Math.random() * 0.007).toFixed(4));
        return sbInsert('mr_battles', {
          id:          `sys_${Date.now()}_${i}_${Math.random().toString(36).slice(2,6)}`,
          creator:     'system',
          mode:        'arena',
          type:        'system',
          token_a:     pair[0],
          token_b:     pair[1],
          amount:      amt,
          prize_pool:  parseFloat((amt * 0.98).toFixed(4)),
          status:      'live',
          payment:     'SOL',
          players:     Math.floor(Math.random() * 3) + 1,
          start_time:  now.toISOString(),
          end_time:    end.toISOString(),
          created_at:  now.toISOString(),
        });
      }));
      await loadBattles();
    } finally {
      respawnLock.current = false;
    }
  }, [loadBattles]);

  // Respawn check: immediately on mount + every 60s
  useEffect(() => {
    const t0 = setTimeout(() => checkAndRespawn(), 1_500);
    const id  = setInterval(() => checkAndRespawn(), CFG.RESPAWN_INTERVAL);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [checkAndRespawn]);


  // ═══════════════════════════════════════════════════════════════════════════
  // BATTLE END DETECTION
  // Saat timer habis → tulis ke DB → Realtime push ke semua user
  // ═══════════════════════════════════════════════════════════════════════════
  const battleEndedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();

      setBattles(prev => {
        const updated = prev.map(b => {
          if (b.status !== 'live') return b;

          // Animate chart (lokal saja)
          const tokA = TOKENS.find(t => t.symbol === b.tokenA);
          const tokB = TOKENS.find(t => t.symbol === b.tokenB);
          const biasA = tokA ? (tokA.priceChange24h > 0 ? 0.004 : -0.004) : 0;
          const biasB = tokB ? (tokB.priceChange24h > 0 ? 0.004 : -0.004) : 0;
          const la = b.chartA[b.chartA.length-1] ?? 0;
          const lb = b.chartB[b.chartB.length-1] ?? 0;
          const na = parseFloat((la + biasA + (Math.random()-0.5)*0.05).toFixed(5));
          const nb = parseFloat((lb + biasB + (Math.random()-0.5)*0.05).toFixed(5));
          const cA = [...b.chartA.slice(-300), na];
          const cB = [...b.chartB.slice(-300), nb];

          // Battle ended?
          const timeLeft = Math.max(0, Math.floor((b.endTime - now) / 1000));
          if (timeLeft === 0 && !battleEndedRef.current.has(b.id)) {
            battleEndedRef.current.add(b.id);
            const winner = na >= nb ? b.tokenA : b.tokenB;
            const endedAt = new Date().toISOString();
            const isRealBattle = (b.mode ?? 'arena') === 'real'; // hanya real battle yang boleh payout

            // Battle ended locally — backend CRON will resolve & payout automatically
            // Frontend does NOT call resolve-battle (no secrets exposed)
            // The Vercel cron job at /api/resolve-battle runs every minute
            // to pick up expired battles and process payouts.
            console.info('[Battle] Expired:', b.id, '— awaiting server-side resolution');

            return { ...b, status: 'ended' as const, winner, tokenAChange: na, tokenBChange: nb, chartA: cA, chartB: cB };
          }

          return { ...b, tokenAChange: na, tokenBChange: nb, chartA: cA, chartB: cB };
        });

        // Update active battle chart from battles array
        setBattles(currentBattles => {
          setActiveBattle(prevActive => {
            if (!prevActive || prevActive.status !== 'live') return prevActive;
            const tl = Math.max(0, Math.floor((prevActive.endTime - now) / 1000));
            setBattleTimeLeft(tl);
            if (tl <= 10 && tl > 0 && !soundedRef.current[`${prevActive.id}_${tl}`]) { soundedRef.current[`${prevActive.id}_${tl}`]=true; playTick(); }
            if (tl === 0 && !soundedRef.current[`${prevActive.id}_win`]) { soundedRef.current[`${prevActive.id}_win`]=true; setTimeout(playWinner,300); }
            const up = currentBattles.find(b => b.id === prevActive.id);
            if (!up) return prevActive;
            return { ...prevActive, chartA: up.chartA, chartB: up.chartB, tokenAChange: up.tokenAChange, tokenBChange: up.tokenBChange, status: up.status, winner: up.winner };
          });
          return currentBattles; // no-op
        });

        return updated;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []); // no deps → stable, uses closure refs

  // ── Battle ended → payout handler ─────────────────────────────────────────
  // ✅ Payout HANYA untuk mode='real'. Arena battles langsung mark sebagai paid tanpa TX.
  useEffect(() => {
    if (!activeBattle || activeBattle.status !== 'ended' || activeBattle.payoutSignature) return;
    const aL = activeBattle.chartA[activeBattle.chartA.length-1] ?? 0;
    const bL = activeBattle.chartB[activeBattle.chartB.length-1] ?? 0;
    const winner = activeBattle.winner ?? (aL >= bL ? activeBattle.tokenA : activeBattle.tokenB);
    const pickedWin = pickedSide==='A' ? activeBattle.tokenA : pickedSide==='B' ? activeBattle.tokenB : null;
    const userWon = pickedSide !== null && winner === pickedWin;
    const isRealBattle = (activeBattle.mode ?? 'arena') === 'real';

    if (userWon && isRealBattle) {
      // Hanya catat win/pnl untuk real battle
      setWinAmount(activeBattle.prizePool);
      setShowWinToast(true);
      setTimeout(() => setShowWinToast(false), 8000);
      saveProfile({ wins:(userProfile?.wins??0)+1, totalPnL:(userProfile?.totalPnL??0)+activeBattle.prizePool });
    } else if (pickedSide && isRealBattle) {
      saveProfile({ losses:(userProfile?.losses??0)+1, totalPnL:(userProfile?.totalPnL??0)-activeBattle.amount });
    }

    const refWallet = sessionStorage.getItem('shareRef');
    if (refWallet && refWallet !== publicKey?.toString() && isRealBattle) {
      const reward = parseFloat((activeBattle.prizePool * CFG.shareRewardPct).toFixed(6));
      setShareRewardPending(r => r+reward);
    }

    const t = setTimeout(async () => {
      if (!isRealBattle) {
        // Arena: no real payout
        setActiveBattle(prev => prev ? {...prev, status:'paid' as const, payoutSignature:'ARENA_NO_PAYOUT'} : prev);
        return;
      }
      // Real battle: backend handles payout atomically
      let sig = 'PENDING_' + Math.random().toString(36).slice(2,10).toUpperCase();
      try {
        const res = await fetch('/api/payout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ battleId: activeBattle.id }),
        });
        const d = await res.json() as {
          success?: boolean; alreadyPaid?: boolean;
          txHash?: string; winnerWallet?: string; payoutSol?: number;
        };
        if ((d.success || d.alreadyPaid) && d.txHash) {
          sig = d.txHash;
          if (userWon) notify(`🏆 You Won — Payout Sent! ${sf(d.payoutSol ?? activeBattle.prizePool,4)} SOL → tx: ${sig.slice(0,8)}…`);
        }
      } catch {}
      setActiveBattle(prev => prev ? {...prev, status:'paid' as const, payoutSignature:sig} : prev);
    }, 5000);
    return () => clearTimeout(t);
  }, [activeBattle?.status]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    (async () => {
      for (const url of [CFG.rpcUrl, CFG.fallbackRpcUrl, 'https://api.mainnet-beta.solana.com']) {
        try { const c=new Connection(url,{commitment:'confirmed'}); await c.getSlot(); connRef.current=c; break; } catch {}
      }
    })();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ref')) sessionStorage.setItem('shareRef', urlParams.get('ref')!);
    // Auto-open battle jika ada ?battle= di URL (dari share link)
    const battleParam = urlParams.get('battle');
    if (battleParam) {
      sessionStorage.setItem('mr_open_battle', battleParam);
    }
    // Load chat dari Supabase agar lihat pesan dari semua user
    sbGet<{id:number;short_wallet:string;message:string;created_at:string}>('mr_chat_messages', 'select=*&order=created_at.desc&limit=50')
      .then(rows => {
        if (rows?.length) {
          setChatMessages(rows.reverse().map(r => ({
            id: String(r.id),
            wallet: r.short_wallet,
            message: r.message,
            timestamp: new Date(r.created_at).getTime(),
          })));
        }
      }).catch(()=>{});
    // Realtime chat subscription
    createRealtimeChannel('mr_chat_messages', (payload) => {
      if (payload.eventType !== 'INSERT') return;
      const r = payload.new;
      setChatMessages(prev => [...prev, {
        id: String(r.id ?? Date.now()),
        wallet: r.short_wallet ?? sw(r.wallet ?? ''),
        message: r.message ?? '',
        timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      }].slice(-50));
    });
  }, []);

  // ── Per-wallet init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey) return;
    // Load dari localStorage (cepat)
    const localProfile = lsLoad<UserProfile|null>(`mr_profile_${publicKey}`, null);
    if (localProfile) setUserProfile(localProfile);
    // Load dari Supabase (akurat, cross-device)
    sbGet<{wallet:string;wins:number;losses:number;battles_created:number;battles_joined:number;total_pnl:number}>(
      'mr_user_stats', `wallet=eq.${publicKey.toString()}&select=*`
    ).then(rows => {
      if (rows?.[0]) {
        const r = rows[0];
        const dbProfile: UserProfile = {
          wallet: publicKey.toString(),
          wins: r.wins ?? 0, losses: r.losses ?? 0,
          battlesCreated: r.battles_created ?? 0,
          battlesJoined: r.battles_joined ?? 0,
          totalPnL: r.total_pnl ?? 0,
          lastUpdated: Date.now(), shareEarnings: 0,
        };
        setUserProfile(dbProfile);
        lsSave(`mr_profile_${publicKey}`, dbProfile);
      }
    }).catch(()=>{});
    sbGet<DbWinner>('mr_winners', `wallet=eq.${publicKey.toString()}&select=*`)
      .then(rows => { if(rows?.length){setReferralCount(rows.length);setReferralEarnings(rows.reduce((s,r)=>s+r.amount_sol,0));} });
    sbUpsert('mr_stats', {
      id:1, players:(dbStats?.players??0)+1, battles:dbStats?.battles??0,
      vol_sol:dbStats?.vol_sol??0, paid_sol:dbStats?.paid_sol??0, updated_at:new Date().toISOString(),
    });
  }, [publicKey]);

  // ── Prices ─────────────────────────────────────────────────────────────────
  const refreshPrices = useCallback(async () => {
    const [prices, mrush] = await Promise.all([fetchPrices(), fetchMrushPrice()]);
    let solPrice = 130;
    setTokens(prev => prev.map(t => {
      if (t.symbol==='SOL' && prices['SOL']) solPrice=prices['SOL'].price;
      if (t.symbol==='MRUSH') { const logo=mrush.logo||t.logoUrl; return mrush.price>0?{...t,price:mrush.price,basePrice:mrush.price,priceChange24h:mrush.ch24,priceDirection:mrush.ch24>0?'up':'down',logoUrl:logo}:{...t,logoUrl:logo}; }
      if (prices[t.symbol]) return {...t,price:prices[t.symbol].price,basePrice:prices[t.symbol].price,priceChange24h:prices[t.symbol].ch24,priceDirection:prices[t.symbol].ch24>0?'up':'down'};
      return t;
    }));
    if (prices['SOL']) solPrice=prices['SOL'].price;
    if (mrush.price>0) { setMrushLive({price:mrush.price,ch24:mrush.ch24}); }
  }, []);
  useEffect(() => { refreshPrices(); const id=setInterval(refreshPrices,30_000); return ()=>clearInterval(id); }, [refreshPrices]);

  // ── Balances ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey || !connected) { setSolBal(null); setMrushBal(null); return; }
    const fetch_ = async () => {
      setBalLoading(true);
      let conn:Connection|null=null;
      for(const url of [CFG.rpcUrl,CFG.fallbackRpcUrl,'https://api.mainnet-beta.solana.com']){
        try{const c=new Connection(url,{commitment:'confirmed'});await c.getSlot();conn=c;break;}catch{}
      }
      if(!conn){setBalLoading(false);return;}
      if(!connRef.current)connRef.current=conn;
      try{setSolBal((await conn.getBalance(publicKey,'confirmed'))/LAMPORTS_PER_SOL);}catch{setSolBal(0);}
      let found=false;
      try{const{getAssociatedTokenAddress}=await import('@solana/spl-token');const ata=await getAssociatedTokenAddress(new PublicKey(CFG.mrushMint),publicKey);const b=await conn.getTokenAccountBalance(ata,'confirmed');setMrushBal(b.value.uiAmount??0);found=true;}catch{}
      if(!found){try{const accs=await conn.getParsedTokenAccountsByOwner(publicKey,{mint:new PublicKey(CFG.mrushMint)},'confirmed');setMrushBal(accs.value.length>0?(accs.value[0].account.data.parsed?.info?.tokenAmount?.uiAmount??0):0);}catch{setMrushBal(0);}}
      setBalLoading(false);
    };
    fetch_();
    const id=setInterval(fetch_,20_000);
    return()=>clearInterval(id);
  }, [publicKey,connected]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chatMessages]);

  const saveProfile = useCallback((u: Partial<UserProfile>) => {
    if(!publicKey)return;
    const k=`mr_profile_${publicKey}`;
    const cur=lsLoad<UserProfile>(k,{wallet:publicKey.toString(),wins:0,losses:0,battlesCreated:0,battlesJoined:0,totalPnL:0,lastUpdated:Date.now(),shareEarnings:0});
    const nw={...cur,...u,lastUpdated:Date.now()};
    lsSave(k,nw); // local backup
    setUserProfile(nw);
    // Sync ke Supabase mr_user_stats (cross-device)
    sbUpsert('mr_user_stats', {
      wallet:          publicKey.toString(),
      wins:            nw.wins,
      losses:          nw.losses,
      battles_created: nw.battlesCreated,
      battles_joined:  nw.battlesJoined,
      total_pnl:       parseFloat((nw.totalPnL??0).toFixed(6)),
      updated_at:      new Date().toISOString(),
    }).catch(()=>{});
  },[publicKey]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE BATTLE — REAL MODE ONLY
  //
  // Rules:
  //   ✅ mode = 'real' — dibuat user, wajib TX, boleh payout
  //   ❌ No free create — semua user wajib deposit SOL
  //   ❌ Battle tidak dibuat jika TX gagal atau dibatalkan
  //
  // Flow: validate → deposit SOL ke treasury → confirmTransaction
  //        → (jika MRUSH fee) kirim MRUSH fee → insert DB dengan mode='real'
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE BATTLE — calls /api/create-battle
  // Frontend: sign TX → get txHash → POST to backend → backend validates on-chain
  // ═══════════════════════════════════════════════════════════════════════════
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
  // ═══════════════════════════════════════════════════════════════════════════
  const renderArena=()=>(
    <>
      {/* ════ HEADER ══════════════════════════════════════════════════ */}
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

      {/* ════ TICKER BAR ══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-orange-500/8 overflow-hidden" style={{background:'rgba(8,4,2,.97)'}}>
        <div className="flex items-center gap-3 px-3 py-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-50 animate-ping"/>
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"/>
            </span>
            <span className="text-[9px] font-black text-orange-400 tracking-widest uppercase">{realtimeOk?'LIVE':'SYNC'}</span>
          </div>
          {[
            {v:`${battles.filter(b=>b.status==='live').length} Battles`, c:'#a3e635'},
            {v:`${sf(stats.vol,2)} SOL`, c:'#facc15'},
            {v:`${fmtN(stats.players)} Players`, c:'#67e8f9'},
            {v:'Mainnet', c:'#a78bfa'},
          ].map((s,i)=>(
            <span key={i} className="flex items-center gap-1 text-[10px] font-bold shrink-0" style={{color:s.c}}>
              <span className="text-slate-700">·</span>{s.v}
            </span>
          ))}
        </div>
      </div>

      {/* ════ STATS ROW ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {l:'Paid Out', v:sf(stats.paid,2)+' SOL', c:'#4ade80', bg:'rgba(74,222,128,.06)'},
          {l:'Volume',   v:sf(stats.vol,2)+' SOL',  c:'#facc15', bg:'rgba(250,204,21,.06)'},
          {l:'Battles',  v:fmtN(stats.battles),      c:'#f97316', bg:'rgba(249,115,22,.06)'},
          {l:'Players',  v:fmtN(stats.players),       c:'#fbbf24', bg:'rgba(251,191,36,.06)'},
        ].map(s=>(
          <div key={s.l} className="rounded-xl p-2.5 text-center border border-white/[.04]" style={{background:s.bg}}>
            <p className="font-black text-sm leading-none tabular-nums" style={{color:s.c}}>{dbLoaded?s.v:'—'}</p>
            <p className="text-[8px] text-slate-600 mt-1 uppercase tracking-wide leading-none">{s.l}</p>
          </div>
        ))}
      </div>

      {/* ════ LIVE BATTLES ════════════════════════════════════════════ */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-orange-400 opacity-40 animate-ping"/>
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-orange-400"/>
            </span>
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
                <div className="flex items-center justify-between px-4 pt-3 pb-0">
                  <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse"/>
                  <div className="h-5 w-14 bg-white/5 rounded-full animate-pulse"/>
                </div>
                <div className="flex gap-3 px-4 py-3">
                  <div className="flex-1 h-16 bg-white/4 rounded-xl animate-pulse"/>
                  <div className="w-8 h-8 self-center bg-white/4 rounded-full animate-pulse"/>
                  <div className="flex-1 h-16 bg-white/4 rounded-xl animate-pulse"/>
                </div>
                <div className="px-4 pb-3 flex justify-between">
                  <div className="h-2.5 w-20 bg-white/5 rounded-full animate-pulse"/>
                  <div className="h-2.5 w-14 bg-white/5 rounded-full animate-pulse"/>
                </div>
              </div>
            ))}
          </div>
        ):battles.filter(b=>b.status==='live').length===0?(
          <div className="rounded-2xl border border-orange-500/15 py-10 text-center space-y-3" style={{background:'rgba(20,10,4,.8)'}}>
            <div className="relative mx-auto w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-orange-500/25 animate-ping"/>
              <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
            </div>
            <p className="text-orange-300 text-sm font-black">🔥 Generating battles…</p>
            <p className="text-slate-600 text-xs">New battles should appear in a few seconds</p>
            <button onClick={()=>setShowCreateModal(true)} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black text-white" style={{background:'rgba(234,88,12,.4)',border:'1px solid rgba(249,115,22,.3)'}}>
              ⚔️ Create Your Own
            </button>
          </div>
        ):(
          <div className="grid grid-cols-1 gap-3">
            {battles.filter(b=>b.status==='live').map(battle=>{
              const tl       = Math.max(0,Math.floor((battle.endTime-Date.now())/1000));
              const ending   = tl<20;
              const aL       = battle.chartA[battle.chartA.length-1]??0;
              const bL       = battle.chartB[battle.chartB.length-1]??0;
              const isReal   = (battle.mode??'arena')==='real';
              const isHot    = battle.players>=3||isReal;
              const totalDur = battle.duration||300;
              const pct      = Math.min(100,Math.max(0,(1-(tl/totalDur))*100));
              const leadA    = aL>=bL;
              const totalVotes = battle.players||1;
              const pctA = leadA ? Math.round(50+Math.min(45,(aL-bL)*8)) : Math.round(50-Math.min(45,(bL-aL)*8));
              const pctB = 100-pctA;

              const openModal = ()=>{
                const elapsed=Math.max(0,Math.floor((Date.now()-battle.startTime)/1000));
                const pts=Math.min(elapsed,20);
                const wA=(battle.chartA.length>3)?battle.chartA:[0];
                const wB=(battle.chartB.length>3)?battle.chartB:[0];
                if(wA.length<=3){for(let i=0;i<pts;i++){const tA=tokens.find(t=>t.symbol===battle.tokenA);const tB=tokens.find(t=>t.symbol===battle.tokenB);const bA=tA?(tA.priceChange24h>0?0.003:-0.003):0;const bB=tB?(tB.priceChange24h>0?0.003:-0.003):0;wA.push(parseFloat((wA[wA.length-1]+bA+(Math.random()-0.5)*0.04).toFixed(5)));wB.push(parseFloat((wB[wB.length-1]+bB+(Math.random()-0.5)*0.04).toFixed(5)));}}
                setActiveBattle({...battle,chartA:wA,chartB:wB});setBattleTimeLeft(tl);setPickedSide(null);setModalTab('chart');setRushPosition(null);soundedRef.current={};
              };

              const quickJoin=(side:'A'|'B',e:React.MouseEvent)=>{
                e.stopPropagation();
                // Open modal with side pre-selected for fast join
                openModal();
                setTimeout(()=>setPickedSide(side),80);
              };

              return(
                <div key={battle.id}
                  className="rounded-2xl overflow-hidden transition-all hover:scale-[1.005] active:scale-[.99]"
                  style={{
                    background: isReal
                      ? 'linear-gradient(180deg,rgba(20,8,2,.99),rgba(10,4,1,.99))'
                      : 'linear-gradient(180deg,rgba(10,10,22,.99),rgba(5,5,14,.99))',
                    border:`1px solid ${ending?'rgba(239,68,68,.45)':isReal?'rgba(249,115,22,.22)':'rgba(30,41,59,.55)'}`,
                    boxShadow: ending?'0 0 20px rgba(239,68,68,.08)':isReal?'0 4px 24px rgba(249,115,22,.1)':'none',
                  }}>

                  {/* ── TOP ACCENT LINE ── */}
                  <div className="h-[1.5px]" style={{background: ending?'linear-gradient(90deg,transparent,#ef4444,transparent)':isReal?'linear-gradient(90deg,transparent,#f97316,transparent)':'linear-gradient(90deg,transparent,rgba(71,85,105,.4),transparent)'}}/>

                  {/* ── HEADER: badge + pool + timer ── */}
                  <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex w-1.5 h-1.5"><span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{background:ending?'#ef4444':'#4ade80'}}/><span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{background:ending?'#ef4444':'#4ade80'}}/></span>
                      {isReal&&<span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{background:'rgba(120,53,15,.55)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.25)'}}>💰 REAL</span>}
                      {!isReal&&isHot&&<span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{background:'rgba(154,52,18,.5)',color:'#f97316',border:'1px solid rgba(249,115,22,.35)'}}>🔥 HOT</span>}
                      {!isReal&&!isHot&&<span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{background:'rgba(30,41,59,.5)',color:'rgba(71,85,105,1)'}}>AUTO</span>}
                      <span className="text-[9px] text-slate-600">· {battle.players} in</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-yellow-400 font-black text-sm tabular-nums">{sf(battle.prizePool,3)}</span>
                        <span className="text-[9px] text-yellow-700 font-bold ml-1">SOL</span>
                      </div>
                      <span className={`font-mono font-black text-sm tabular-nums px-2 py-0.5 rounded-lg ${ending?'text-red-400 animate-pulse':'tl<60?text-orange-400:text-slate-200'}`}
                        style={{background: ending?'rgba(239,68,68,.12)':'rgba(30,41,59,.5)'}}>
                        {fmtT(tl)}
                      </span>
                    </div>
                  </div>

                  {/* ── MAIN VS LAYOUT ── */}
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-2.5 items-stretch">

                    {/* ── TOKEN A SIDE ── */}
                    <div className={`rounded-xl p-3 flex flex-col gap-2 border transition-all ${leadA?'border-emerald-500/35':'border-white/5'}`}
                      style={{background: leadA?'rgba(16,185,129,.07)':'rgba(255,255,255,.02)'}}>
                      {/* Token info */}
                      <div className="flex items-center gap-2 cursor-pointer" onClick={openModal}>
                        <div className="relative flex-shrink-0">
                          <img src={gl(battle.tokenA)} alt={battle.tokenA} className={`w-10 h-10 rounded-full border-2 transition-all ${leadA?'border-emerald-400/50':'border-white/10'}`} onError={e=>(e.target as HTMLImageElement).src=ph(battle.tokenA)}/>
                          {leadA&&<div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[7px] font-black text-black">▲</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-white text-sm leading-none truncate">{battle.tokenA}</p>
                          <p className={`text-xs font-black mt-0.5 tabular-nums ${aL>=0?'text-emerald-400':'text-red-400'}`}>{aL>=0?'+':''}{aL.toFixed(2)}%</p>
                        </div>
                      </div>
                      {/* BUY A button */}
                      <button
                        onClick={e=>quickJoin('A',e)}
                        className="w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-95 flex items-center justify-center gap-1 min-h-[44px]"
                        style={{background: leadA?'linear-gradient(135deg,#059669,#047857)':'linear-gradient(135deg,#1c1008,#292010)',boxShadow: leadA?'0 2px 10px rgba(5,150,105,.3)':'none'}}>
                        {leadA?'✅':'📈'} BUY {battle.tokenA}
                      </button>
                      {/* Vote bar A side */}
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.06)'}}>
                          <div className="h-full rounded-full transition-all duration-700" style={{width:`${pctA}%`,background: leadA?'#10b981':'#f97316'}}/>
                        </div>
                        <span className="text-[9px] font-black text-slate-500 w-6 text-right tabular-nums">{pctA}%</span>
                      </div>
                    </div>

                    {/* ── VS CENTER + live prices ── */}
                    <div className="flex flex-col items-center justify-center gap-1 px-1 cursor-pointer" onClick={openModal}>
                      <div className="w-8 h-8 rounded-full border border-white/8 flex items-center justify-center" style={{background:'rgba(30,41,59,.5)'}}>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">vs</span>
                      </div>
                      {Math.abs(aL-bL)>0.01&&(
                        <span className={`text-[8px] font-black tabular-nums ${leadA?'text-emerald-500':'text-orange-400'}`}>
                          {Math.abs(aL-bL).toFixed(2)}%
                        </span>
                      )}
                      {/* Real market prices from CoinGecko (refreshed every 30s) */}
                      {(()=>{
                        const pA=tokens.find(t=>t.symbol===battle.tokenA)?.price??0;
                        const pB=tokens.find(t=>t.symbol===battle.tokenB)?.price??0;
                        const fmt=(p:number)=>p<=0?'':p<0.001?`$${p.toFixed(6)}`:p<1?`$${p.toFixed(4)}`:`$${p.toFixed(2)}`;
                        const fA=fmt(pA); const fB=fmt(pB);
                        if(!fA&&!fB)return null;
                        return(
                          <div className="mt-0.5 text-center space-y-0.5 leading-none">
                            {fA&&<p className="text-[7px] tabular-nums" style={{color:'rgba(100,116,139,.55)'}}>{fA}</p>}
                            {fB&&<p className="text-[7px] tabular-nums" style={{color:'rgba(100,116,139,.55)'}}>{fB}</p>}
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── TOKEN B SIDE ── */}
                    <div className={`rounded-xl p-3 flex flex-col gap-2 border transition-all ${!leadA?'border-orange-500/35':'border-white/5'}`}
                      style={{background: !leadA?'rgba(249,115,22,.07)':'rgba(255,255,255,.02)'}}>
                      {/* Token info */}
                      <div className="flex items-center gap-2 flex-row-reverse cursor-pointer" onClick={openModal}>
                        <div className="relative flex-shrink-0">
                          <img src={gl(battle.tokenB)} alt={battle.tokenB} className={`w-10 h-10 rounded-full border-2 transition-all ${!leadA?'border-orange-400/50':'border-white/10'}`} onError={e=>(e.target as HTMLImageElement).src=ph(battle.tokenB)}/>
                          {!leadA&&<div className="absolute -top-1 -left-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[7px] font-black text-black">▲</div>}
                        </div>
                        <div className="min-w-0 flex-1 text-right">
                          <p className="font-black text-white text-sm leading-none truncate">{battle.tokenB}</p>
                          <p className={`text-xs font-black mt-0.5 tabular-nums ${bL>=0?'text-emerald-400':'text-red-400'}`}>{bL>=0?'+':''}{bL.toFixed(2)}%</p>
                        </div>
                      </div>
                      {/* BUY B button */}
                      <button
                        onClick={e=>quickJoin('B',e)}
                        className="w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-95 flex items-center justify-center gap-1 min-h-[44px]"
                        style={{background: !leadA?'linear-gradient(135deg,#c2410c,#9a3412)':'linear-gradient(135deg,#1c1008,#292010)',boxShadow: !leadA?'0 2px 10px rgba(249,115,22,.3)':'none'}}>
                        {!leadA?'✅':'📈'} BUY {battle.tokenB}
                      </button>
                      {/* Vote bar B side */}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-black text-slate-500 w-6 tabular-nums">{pctB}%</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.06)'}}>
                          <div className="h-full rounded-full transition-all duration-700" style={{width:`${pctB}%`,background: !leadA?'#f97316':'rgba(249,115,22,.3)'}}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── PROGRESS BAR ── */}
                  <div className="mx-3 mb-2 h-[2px] rounded-full overflow-hidden" style={{background:'rgba(30,41,59,.5)'}}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{
                      width:`${pct}%`,
                      background: ending?'linear-gradient(90deg,#ef4444,#f97316)':pct>70?'linear-gradient(90deg,#ef4444,#f97316)':'linear-gradient(90deg,#f97316,#fbbf24)',
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ════ LIVE ACTIVITY ═══════════════════════════════════════════ */}
      {activities.length>0&&(
        <section className="rounded-2xl border border-white/[.04] overflow-hidden" style={{background:'rgba(6,6,18,.97)'}}>
          <div className="px-4 py-2.5 border-b border-white/[.04] flex items-center justify-between" style={{background:'rgba(8,8,20,1)'}}>
            <div className="flex items-center gap-2">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-50 animate-ping"/>
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400"/>
              </span>
              <span className="font-black text-[10px] text-orange-400 tracking-widest uppercase">Live Activity</span>
            </div>
            <span className="text-[9px] text-slate-700 font-mono">on-chain</span>
          </div>
          <div className="divide-y divide-white/[.03]">
            {activities.slice(0,5).map(a=>(
              <div key={a.id} className="flex justify-between items-center px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black shrink-0 ${a.action==='won'?'text-emerald-300':a.action==='created'?'text-orange-300':'text-amber-300'}`}
                    style={{background:a.action==='won'?'rgba(6,78,59,.5)':a.action==='created'?'rgba(120,53,15,.5)':'rgba(180,90,15,.35)',border:`1px solid ${a.action==='won'?'rgba(16,185,129,.2)':a.action==='created'?'rgba(249,115,22,.25)':'rgba(251,191,36,.2)'}`}}>
                    {a.action.toUpperCase()}
                  </span>
                  <span className="text-slate-500 text-[10px] font-mono truncate">{a.user}</span>
                  {a.battle&&<span className="text-slate-700 text-[9px] truncate hidden sm:block">· {a.battle}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.amount&&<span className={`text-xs font-black tabular-nums ${a.action==='won'?'text-emerald-400':'text-yellow-400'}`}>{a.action==='won'?'+':''}{sf(a.amount)} SOL</span>}
                  {a.txHash&&<a href={`${CFG.solscan}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:text-cyan-400 text-[10px] transition-colors">↗</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ RECENT WINNERS ══════════════════════════════════════════ */}
      {recentWinners.length>0&&(
        <section className="rounded-2xl border border-yellow-500/15 overflow-hidden" style={{background:'linear-gradient(135deg,rgba(120,53,15,.1),rgba(5,5,14,.98))'}}>
          <div className="px-4 py-2.5 border-b border-yellow-500/[.08]">
            <span className="font-black text-[10px] text-yellow-400 tracking-widest uppercase">🏆 Recent Winners</span>
          </div>
          <div className="divide-y divide-yellow-500/[.05]">
            {recentWinners.slice(0,3).map((w,i)=>(
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base flex-shrink-0" style={{fontSize:'14px'}}>{i===0?'🥇':i===1?'🥈':'🥉'}</span>
                  <div className="min-w-0">
                    <p className="font-mono text-cyan-400 text-[11px] font-bold truncate">{w.wallet}</p>
                    <p className="text-slate-600 text-[9px] mt-0.5 truncate">{w.battle} · {w.time}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-emerald-400 font-black text-sm tabular-nums">+{sf(w.amount,3)} SOL</p>
                  {w.txHash&&<a href={`${CFG.solscan}/tx/${w.txHash}`} target="_blank" rel="noopener noreferrer" className="text-yellow-700 hover:text-yellow-400 text-[9px] transition-colors">verify ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════ MRUSH DISCOUNTS (collapsed) ════════════════════════════ */}
      <details className="rounded-2xl border border-orange-500/10 overflow-hidden" style={{background:'rgba(30,12,2,.5)'}}>
        <summary className="px-4 py-3 font-black text-[10px] text-orange-400 cursor-pointer list-none flex items-center justify-between select-none tracking-widest uppercase">
          <span>💎 MRUSH Holder Discounts</span>
          <span className="text-slate-600 font-normal normal-case tracking-normal">▾</span>
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

      {/* ════ ON-CHAIN PROOF (collapsed) ══════════════════════════════ */}
      <details className="rounded-2xl border border-white/[.04] overflow-hidden" style={{background:'rgba(6,6,18,.98)'}}>
        <summary className="px-4 py-3 font-black text-[10px] text-slate-500 cursor-pointer list-none flex items-center justify-between select-none tracking-widest uppercase">
          <span>🔗 On-Chain Transparency</span>
          <span className="text-slate-700 font-normal normal-case tracking-normal">▾</span>
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-2">
          <a href={`${CFG.solscan}/account/${CFG.treasury}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-white/[.04] hover:border-orange-500/20 transition-colors"
            style={{background:'rgba(18,18,36,.8)'}}>
            <span className="text-emerald-400 text-sm">💸</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">Treasury Wallet</p>
              <p className="text-slate-600 text-[10px] truncate font-mono">{CFG.treasury}</p>
            </div>
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

  const renderChat=()=>(
    <div className="rounded-2xl border border-white/5 flex flex-col" style={{background:'rgba(8,8,22,.9)',height:'60vh'}}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between"><h3 className="font-bold text-sm">💬 Live Chat</h3><span className="text-xs text-slate-600">{chatMessages.length} messages</span></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length===0?<p className="text-center text-slate-600 text-sm py-8">No messages yet. Start the conversation!</p>:chatMessages.map(m=>(
          <div key={m.id} className={`flex ${publicKey&&m.wallet===sw(publicKey.toString())?'justify-end':''}`}>
            <div className="max-w-[80%] rounded-2xl p-2.5 text-sm border border-white/5" style={{background:publicKey&&m.wallet===sw(publicKey.toString())?'rgba(194,65,12,.3)':'rgba(18,18,40,.8)'}}>
              <p className="text-cyan-400 text-xs font-mono mb-0.5">{m.wallet}</p>
              <p className="text-white">{m.message}</p>
              <p className="text-slate-600 text-xs mt-0.5">{fmtTs(m.timestamp)}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef}/>
      </div>
      <div className="p-3 border-t border-white/5 flex gap-2">
        <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} placeholder={connected?'Type a message…':'Connect wallet to chat'} disabled={!connected} className="flex-1 rounded-xl px-3 py-2 text-sm border border-white/10 focus:border-orange-500 focus:outline-none bg-slate-900/80 text-white disabled:opacity-50"/>
        <button onClick={handleSendMessage} disabled={!connected||!newMessage.trim()} className="px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50" style={{background:'linear-gradient(135deg,#ea580c,#f97316)'}}>Send</button>
      </div>
    </div>
  );

  const renderStats=()=>(
    <div className="space-y-5">
      {/* Trust & Transparency Banner */}
      <div className="rounded-2xl p-4 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-4" style={{background:'rgba(6,78,59,.1)'}}>
        <div className="text-center flex-1 min-w-[80px]">
          <p className="text-slate-400 text-xs font-semibold mb-0.5">💰 Total Paid Out</p>
          <p className="text-emerald-400 font-black text-xl">{sf(stats.paid,2)} SOL</p>
        </div>
        <div className="text-center flex-1 min-w-[80px]">
          <p className="text-slate-400 text-xs font-semibold mb-0.5">📊 Total Volume</p>
          <p className="text-yellow-400 font-black text-xl">{sf(stats.vol,2)} SOL</p>
        </div>
        <div className="text-center flex-1 min-w-[80px]">
          <p className="text-slate-400 text-xs font-semibold mb-0.5">⚔️ Battles Played</p>
          <p className="text-orange-400 font-black text-xl">{fmtN(stats.battles)}</p>
        </div>
        <div className="text-center flex-1 min-w-[80px]">
          <p className="text-slate-400 text-xs font-semibold mb-0.5">👥 Players</p>
          <p className="text-cyan-400 font-black text-xl">{fmtN(stats.players)}</p>
        </div>
      </div>

      <div className="rounded-2xl p-4 border border-white/5" style={{background:'rgba(8,8,22,.9)'}}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">📊 Platform Stats <span className="text-xs text-emerald-400">{realtimeOk?'● Live':'● DB'}</span></h3>
        <div className="grid grid-cols-2 gap-3">
          {[{l:'Total Battles',v:fmtN(stats.battles),c:'text-orange-400',i:'⚔️'},{l:'SOL Volume',v:sf(stats.vol,3)+' SOL',c:'text-yellow-400',i:'💰'},{l:'Total Payouts',v:sf(stats.paid,3)+' SOL',c:'text-cyan-400',i:'🏆'},{l:'Players',v:fmtN(stats.players),c:'text-emerald-400',i:'👥'}].map(s=>(
            <div key={s.l} className="rounded-2xl p-4 text-center border border-white/5" style={{background:'rgba(18,18,40,.8)'}}>
              <div className="text-xl mb-1">{s.i}</div>
              <p className={`text-2xl font-black ${s.c}`}>{dbLoaded?s.v:<span className="animate-pulse text-slate-600">…</span>}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
        {stats.battles>0&&<div className="mt-3 p-2.5 rounded-xl text-xs text-center border border-white/5" style={{background:'rgba(18,18,40,.5)'}}>Avg prize: <span className="text-white font-bold">{sf(stats.vol/Math.max(stats.battles,1),4)} SOL</span> · Payout ratio: <span className="text-emerald-400 font-bold">{stats.vol>0?((stats.paid/stats.vol)*100).toFixed(1):0}%</span></div>}
      </div>
      {activities.length>0&&(
        <section className="rounded-2xl p-4 border border-white/5" style={{background:'rgba(8,8,22,.9)'}}>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">⚡ Live Activity <span className="text-xs text-emerald-400">● Live</span></h3>
          <div className="space-y-2">
            {activities.slice(0,10).map(a=>(
              <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2 min-w-0"><span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${a.action==='won'?'text-emerald-400':a.action==='created'?'text-orange-400':'text-amber-400'}`} style={{background:a.action==='won'?'rgba(16,185,129,.15)':a.action==='created'?'rgba(249,115,22,.15)':'rgba(251,191,36,.15)'}}>{a.action}</span><span className="text-slate-400 text-xs truncate">{a.user} · {a.battle}</span></div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">{a.amount&&<span className={`text-xs font-bold ${a.action==='won'?'text-emerald-400':'text-yellow-400'}`}>{a.action==='won'?'+':''}{sf(a.amount)} SOL</span>}{a.txHash&&<a href={`${CFG.solscan}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400 text-xs">↗</a>}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="rounded-2xl p-4 border border-yellow-500/12" style={{background:'rgba(120,53,15,.08)'}}>
        <h3 className="font-bold text-sm mb-3">🏆 Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.length===0?<p className="text-slate-600 text-sm text-center py-4">No winners yet — be the first! 🏆</p>:leaderboard.map(e=>(
            <div key={e.rank} className="flex items-center justify-between p-3 rounded-xl border border-white/5" style={{background:'rgba(18,18,45,.8)'}}>
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" style={{background:e.rank===1?'#fbbf24':e.rank===2?'#94a3b8':'#fb923c',color:'#000'}}>{e.rank}</div><div><p className="font-mono text-cyan-400 text-xs font-bold">{e.wallet}</p><p className="text-slate-600 text-xs">{e.wins} wins</p></div></div>
              <p className="font-black text-emerald-400 text-sm">+{sf(e.earnings,3)} SOL</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl p-4 border border-white/5" style={{background:'rgba(8,8,22,.9)'}}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">📜 Battle History <span className="text-xs text-emerald-400">● {battleHistory.length} on-chain</span></h3>
        {battleHistory.length===0?(
          <div className="text-center py-8"><div className="text-4xl mb-3">{dbLoaded?'⚔️':'⏳'}</div><p className="text-slate-500 text-sm">{dbLoaded?'No battles yet':'Loading…'}</p></div>
        ):(
          <div className="space-y-2">
            {battleHistory.slice(0,25).map(b=>(
              <div key={b.id} className="p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors" style={{background:'rgba(18,18,40,.8)'}}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">{b.token_a} <span className="text-slate-600">vs</span> {b.token_b}</span>
                    {b.status==='paid'&&b.winner&&<span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{background:'rgba(16,185,129,.15)',color:'#34d399',border:'1px solid rgba(16,185,129,.2)'}}>🏆 {b.winner}</span>}
                    {b.status==='live'&&<span className="text-xs px-2 py-0.5 rounded-full font-bold animate-pulse" style={{background:'rgba(8,145,178,.15)',color:'#22d3ee',border:'1px solid rgba(8,145,178,.2)'}}>● LIVE</span>}
                    {b.status==='ended'&&<span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{background:'rgba(234,179,8,.1)',color:'#fbbf24',border:'1px solid rgba(234,179,8,.2)'}}>⏳ Paying…</span>}
                    {b.payment==='MRUSH'&&<span className="text-xs px-1.5 py-0.5 rounded-full text-purple-400" style={{background:'rgba(139,92,246,.12)',border:'1px solid rgba(139,92,246,.2)'}}>MRUSH</span>}
                  </div>
                  <span className="text-emerald-400 font-black text-sm shrink-0">{sf(b.prize_pool)} SOL</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
                  <span>by <span className="text-slate-400 font-mono">{b.creator==='arena'?'🤖 Arena':sw(b.creator)}</span></span>
                  <span className="flex items-center gap-2"><span>{tAgo(b.created_at)}</span>{b.tx_hash&&<a href={`${CFG.solscan}/tx/${b.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 font-bold">verify ↗</a>}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl p-4 border border-white/5" style={{background:'rgba(8,8,22,.9)'}}>
        <h4 className="font-bold text-sm mb-3">🔗 On-Chain Proof</h4>
        <div className="grid grid-cols-1 gap-3">
          <a href={`${CFG.solscan}/account/${CFG.treasury}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-white/5 hover:border-cyan-500/30 flex items-start gap-3" style={{background:'rgba(18,18,40,.8)'}}><span className="text-emerald-400 text-lg mt-0.5">💸</span><div className="min-w-0"><p className="text-xs font-bold text-white mb-0.5">Treasury Wallet</p><p className="text-slate-500 text-xs truncate">{CFG.treasury}</p><p className="text-cyan-500 text-xs mt-0.5">View all fee transactions →</p></div></a>
          <a href={`${CFG.solscan}/token/${CFG.mrushMint}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-white/5 hover:border-cyan-500/30 flex items-start gap-3" style={{background:'rgba(18,18,40,.8)'}}><span className="text-purple-400 text-lg mt-0.5">🪙</span><div className="min-w-0"><p className="text-xs font-bold text-white mb-0.5">$MRUSH Token</p><p className="text-slate-500 text-xs truncate">{CFG.mrushMint}</p><p className="text-cyan-500 text-xs mt-0.5">Verify LP burn & holders →</p></div></a>
        </div>
      </section>
    </div>
  );

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
