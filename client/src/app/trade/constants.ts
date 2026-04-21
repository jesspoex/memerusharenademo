/**
 * trade/constants.ts
 * All shared config, types, static data, and pure utilities for the trade page.
 * No React — safe to import from hooks and components alike.
 */

// ── ENV ───────────────────────────────────────────────────────────────────────
export const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://wlpgpjebwwublxfcpjos.supabase.co';
export const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGdwamVid3d1Ymx4ZmNwam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzI4MjYsImV4cCI6MjA5MDM0ODgyNn0.nAiMQ59OSo8fB_OlzTNWDYW4G5qNIAlGEQVTODArypM';

// ── Config ────────────────────────────────────────────────────────────────────
export const CFG = {
  rpcUrl:          process.env.NEXT_PUBLIC_RPC_URL          || 'https://api.mainnet-beta.solana.com',
  fallbackRpcUrl:  process.env.NEXT_PUBLIC_FALLBACK_RPC_URL || 'https://rpc.ankr.com/solana',
  mrushMint:       process.env.NEXT_PUBLIC_MRUSH_MINT       || 'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  treasury:        process.env.NEXT_PUBLIC_TREASURY_WALLET  || 'Fwsyjj7sf64MxCNfkysQ4UoJbE1MYXBe7dp35Czd5Vew',
  feeBase:         2,
  solscan:         'https://solscan.io',
  site:            process.env.NEXT_PUBLIC_SITE_URL         || 'https://www.meemerush.xyz',
  pumpfun:         'https://pump.fun/coin/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  dexscreener:     'https://dexscreener.com/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump',
  twitter:         'https://x.com/memerusharena',
  telegram:        'https://t.me/memerusharena',
  shareRewardPct:  0.001,
  KEEP_LIVE_MIN:   5,
  RESPAWN_INTERVAL:60_000,
  MIN_BET_SOL:     0.001,
  MAX_BET_SOL:     10,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export type BattleMode   = 'arena' | 'real';
export type BattleStatus = 'live' | 'ended' | 'paid';
export type BetSide      = 'A' | 'B';
export type ModalTab     = 'chart' | 'info' | 'rushtrade';
export type PaymentToken = 'SOL' | 'MRUSH';

export interface DbBattle {
  id: string; creator: string; token_a: string; token_b: string;
  amount: number; prize_pool: number; winner?: string; winner_wallet?: string;
  status: BattleStatus; payment?: string; tx_hash?: string;
  players: number; end_time?: string; start_time?: string;
  created_at: string; ended_at?: string;
  mode: BattleMode; type?: 'system' | 'user';
  fee_collected?: number; total_deposited?: number;
}
export interface DbBet {
  id?: number; battle_id: string; wallet: string;
  side: BetSide; amount: number; fee_total: number;
  net_amount: number; payment: PaymentToken;
  tx_hashes: string[]; created_at: string; updated_at: string;
}
export interface DbActivity {
  id?: number; wallet: string; action: string;
  amount?: number; battle?: string; tx_hash?: string; created_at: string;
}
export interface DbWinner {
  id?: number; wallet: string; amount_sol: number;
  battle: string; tx_hash?: string; created_at: string;
}
export interface DbStats {
  id: number; players: number; battles: number;
  vol_sol: number; paid_sol: number; updated_at?: string;
}

export interface Token {
  symbol: string; name: string; logoUrl: string;
  basePrice: number; price: number; priceChange24h: number;
  volume24h: number; color: string;
  priceDirection: 'up' | 'down' | 'neutral';
  trending?: boolean; coingeckoId?: string | null;
  isCustom?: boolean; mintAddress?: string; lpBurned?: boolean;
}
export interface Battle {
  id: string; tokenA: string; tokenB: string;
  amount: number; duration: number;
  startTime: number; endTime: number;
  status: BattleStatus;
  winner?: string; winnerWallet?: string;
  tokenAChange: number; tokenBChange: number;
  chartA: number[]; chartB: number[];
  players: number; creator: string;
  totalPool: number; platformFee: number; prizePool: number;
  payoutSignature?: string;
  mode: BattleMode; battleType?: 'system' | 'user';
}
export interface Activity {
  id: string; user: string; action: 'joined' | 'won' | 'created';
  amount?: number; battle?: string; time: string;
  isReal?: boolean; txHash?: string;
}
export interface ChatMessage {
  id: string; wallet: string; message: string; timestamp: number;
}
export interface UserProfile {
  wallet: string; wins: number; losses: number;
  battlesCreated: number; battlesJoined: number;
  totalPnL: number; lastUpdated: number; shareEarnings: number;
}
export interface LeaderboardEntry {
  rank: number; wallet: string; earnings: number; wins: number;
}
export interface RecentWinner {
  wallet: string; amount: number; time: string;
  battle: string; txHash?: string;
}
export interface RushPosition {
  dir: 'long' | 'short'; token: string; entryChange: number;
}

// ── Tiers ─────────────────────────────────────────────────────────────────────
export const TIERS = [
  { min: 10_000_000, disc: 75, name: 'Diamond 💎',  hex: '#a855f7' },
  { min:  5_000_000, disc: 50, name: 'Platinum 🪙', hex: '#67e8f9' },
  { min:  2_000_000, disc: 35, name: 'Gold 🥇',     hex: '#fbbf24' },
  { min:  1_000_000, disc: 20, name: 'Silver 🥈',   hex: '#94a3b8' },
  { min:    500_000, disc: 10, name: 'Bronze 🥉',   hex: '#fb923c' },
  { min:          0, disc:  0, name: 'Standard ⚡', hex: '#64748b' },
];
export const getTier = (b: number) => TIERS.find(t => b >= t.min) ?? TIERS[5];
export const calcFee = (amt: number, mrush: number) => {
  const t   = getTier(mrush);
  const pct = CFG.feeBase * (1 - t.disc / 100);
  return { fee: amt * (pct / 100), pct, prize: amt - amt * (pct / 100), tier: t };
};

// ── Tokens ────────────────────────────────────────────────────────────────────
export const TOKENS: Token[] = [
  { symbol:'BONK',   name:'Bonk',         logoUrl:'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',        basePrice:0.00001,  price:0.00001,  priceChange24h:0, volume24h:1250000, color:'from-orange-400 to-orange-600', priceDirection:'up',      trending:true,  coingeckoId:'bonk' },
  { symbol:'WIF',    name:'dogwifhat',     logoUrl:'https://assets.coingecko.com/coins/images/33567/large/dogwifhat.jpg',   basePrice:2.5,      price:2.5,      priceChange24h:0, volume24h:890000,  color:'from-pink-400 to-pink-600',     priceDirection:'down',    trending:true,  coingeckoId:'dogwifcoin' },
  { symbol:'POPCAT', name:'Popcat',        logoUrl:'https://assets.coingecko.com/coins/images/33908/large/popcat.png',      basePrice:0.45,     price:0.45,     priceChange24h:0, volume24h:450000,  color:'from-yellow-400 to-orange-500', priceDirection:'up',      trending:true,  coingeckoId:'popcat' },
  { symbol:'BOME',   name:'Book of Meme',  logoUrl:'https://assets.coingecko.com/coins/images/35215/large/bome.png',        basePrice:0.008,    price:0.008,    priceChange24h:0, volume24h:680000,  color:'from-orange-500 to-amber-500',  priceDirection:'up',      trending:true,  coingeckoId:'book-of-meme' },
  { symbol:'MYRO',   name:'Myro',          logoUrl:'https://assets.coingecko.com/coins/images/33427/large/myro.png',        basePrice:0.12,     price:0.12,     priceChange24h:0, volume24h:320000,  color:'from-blue-400 to-cyan-500',     priceDirection:'up',      trending:true,  coingeckoId:'myro' },
  { symbol:'MRUSH',  name:'MemeRush',      logoUrl:`https://dd.dexscreener.com/ds-data/tokens/solana/E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump.png?size=lg&key=2f8e8c`, basePrice:0.000001, price:0.000001, priceChange24h:0, volume24h:0, color:'from-cyan-400 to-blue-600', priceDirection:'neutral', trending:true,  coingeckoId:null, mintAddress:'E5U8dLjntnAJtM9gvFRSZTYvx8BJhvWSXQwKaWcrpump', lpBurned:true },
  { symbol:'SOL',    name:'Solana',        logoUrl:'https://assets.coingecko.com/coins/images/4128/large/solana.png',       basePrice:130,      price:130,      priceChange24h:0, volume24h:2500000, color:'from-green-400 to-emerald-600', priceDirection:'up',      trending:false, coingeckoId:'solana' },
  { symbol:'PEPE',   name:'Pepe',          logoUrl:'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg', basePrice:0.000001, price:0.000001, priceChange24h:0, volume24h:670000,  color:'from-green-400 to-green-600',   priceDirection:'down',    trending:false, coingeckoId:'pepe' },
];

export const DURS = [
  { v: 60,  l: '1 min'  },
  { v: 180, l: '3 min'  },
  { v: 300, l: '5 min'  },
  { v: 600, l: '10 min' },
];

export const ARENA_PAIRS = [
  ['BONK','WIF'],['SOL','BONK'],['WIF','POPCAT'],['MYRO','SOL'],
  ['BOME','WIF'],['BONK','POPCAT'],['SOL','MRUSH'],['PEPE','BONK'],
  ['WIF','BOME'],['BONK','MYRO'],['SOL','PEPE'],['MRUSH','WIF'],
];

// ── Pure utilities ────────────────────────────────────────────────────────────
export const sf    = (n: number | null | undefined, d = 2) => (n ?? 0).toFixed(d);
export const fmtT  = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const fmtN  = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
export const fmtP  = (p: number) => { if (!p) return '0'; if (p < 0.0001) return p.toFixed(8); if (p < 1) return p.toFixed(4); return p.toFixed(2); };
export const sw    = (w: string) => w.length > 8 ? `${w.slice(0, 4)}...${w.slice(-4)}` : w;
export const rid   = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export const ph    = (s: string) => `https://ui-avatars.com/api/?name=${s}&background=ea580c&color=fff&size=40`;
export const fmtTs = (ts: number) => { const d = Date.now() - ts; if (d < 60000) return 'Just now'; if (d < 3600000) return `${Math.floor(d / 60000)}m ago`; return `${Math.floor(d / 3600000)}h ago`; };
export const tAgo  = (iso: string) => { const d = Date.now() - new Date(iso).getTime(); if (d < 60000) return 'Just now'; if (d < 3600000) return `${Math.floor(d / 60000)}m ago`; if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`; return `${Math.floor(d / 86400000)}d ago`; };
export const lsSave = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const lsLoad = <T,>(k: string, fb: T): T => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as T : fb; } catch { return fb; } };

// ── Convert DB battle → local Battle ─────────────────────────────────────────
export function toLocalBattle(db: DbBattle, prev?: Battle): Battle {
  const now   = Date.now();
  const end   = db.end_time   ? new Date(db.end_time).getTime()   : now + 300_000;
  const start = db.start_time ? new Date(db.start_time).getTime() : now;
  const dur   = Math.max(60, Math.round((end - start) / 1000));
  const mode: BattleMode = (db.mode as BattleMode) ?? (db.creator === 'arena' ? 'arena' : 'real');
  return {
    id: db.id, tokenA: db.token_a, tokenB: db.token_b,
    amount: db.amount, duration: dur, startTime: start, endTime: end,
    status: db.status, winner: db.winner, winnerWallet: db.winner_wallet,
    tokenAChange: prev?.chartA[prev.chartA.length - 1] ?? 0,
    tokenBChange: prev?.chartB[prev.chartB.length - 1] ?? 0,
    chartA: prev?.chartA ?? [0],
    chartB: prev?.chartB ?? [0],
    players: db.players ?? 1, creator: db.creator,
    totalPool: db.amount, platformFee: db.amount * (CFG.feeBase / 100),
    prizePool: db.prize_pool, payoutSignature: db.tx_hash,
    mode,
    battleType: (db as DbBattle & { type?: string }).type === 'system'
      ? 'system'
      : (db.creator === 'arena' || db.creator === 'system' ? 'system' : 'user'),
  };
}

// ── Sound ─────────────────────────────────────────────────────────────────────
function playBeep(f: number, d: number, v = 0.2) {
  if (typeof window === 'undefined') return;
  try {
    const AC  = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o   = ctx.createOscillator();
    const g   = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(v, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
    o.start(); o.stop(ctx.currentTime + d);
    setTimeout(() => ctx.close(), d * 1000 + 200);
  } catch {}
}
export const playTick   = () => playBeep(880, 0.1, 0.18);
export const playWinner = () => {
  playBeep(523, 0.15, 0.4);
  setTimeout(() => playBeep(659, 0.15, 0.4), 150);
  setTimeout(() => playBeep(784, 0.15, 0.4), 300);
  setTimeout(() => playBeep(1047, 0.25, 0.5), 450);
};
