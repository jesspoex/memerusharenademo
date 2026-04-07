// src/types/index.ts

export interface TokenData {
  symbol: string;
  name: string;
  address: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  logoUrl: string;
  pairAddress: string;
  dexId: string;
}

export interface Battle {
  id: string;
  tokenA: TokenData;
  tokenB: TokenData;
  status: 'live' | 'ended';
  winner?: 'A' | 'B';
  winnerToken?: TokenData;
  startedAt: number;
  endedAt?: number;
  votes: { A: number; B: number };
  prizePool: number; // mock SOL
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string; // mock wallet
  wins: number;
  totalEarned: number;
  winStreak: number;
}
