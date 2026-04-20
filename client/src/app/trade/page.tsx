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
  mrushMint:        process.env.NEXT_PUBLIC_MRUSH_MINT       || '',
  treasury:         process.env.NEXT_PUBLIC_TREASURY_WALLET  || 'Fwsyjj7sf64MxCNfkysQ4UoJbE1MYXBe7dp35Czd5Vew',
  feeBase:          2,           // 2% fee dari per bet
  solscan:          'https://solscan.io',
  site:             process.env.NEXT_PUBLIC_SITE_URL         || 'https://www.meemerush.xyz',
  pumpfun:          'https://pump.fun/coin',
  dexscreener:      'https://dexscreener.com/solana',
  twitter:          'https://x.com/memerusharena',
  telegram:         'https://t.me/memerusharena',
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
const fmtTs = (ts: number) => { const d=Date.now()-ts; if(d<60000) return 'Just now'; if(d<3
