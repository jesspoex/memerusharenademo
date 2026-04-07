// src/lib/mock.ts
import type { LeaderboardEntry, Battle, TokenData } from '@/types';

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, wallet: '8Px...3F2', wins: 24, totalEarned: 12.45, winStreak: 5 },
  { rank: 2, wallet: 'Gy7...9K1', wins: 19, totalEarned:  9.20, winStreak: 3 },
  { rank: 3, wallet: 'Ab3...7Hj', wins: 15, totalEarned:  7.80, winStreak: 2 },
  { rank: 4, wallet: 'Zx9...2Nm', wins: 12, totalEarned:  5.50, winStreak: 1 },
  { rank: 5, wallet: 'Qq1...5Lp', wins:  9, totalEarned:  3.10, winStreak: 0 },
  { rank: 6, wallet: 'Wr4...8Bt', wins:  7, totalEarned:  2.40, winStreak: 0 },
  { rank: 7, wallet: 'Ks6...1Cv', wins:  5, totalEarned:  1.75, winStreak: 0 },
  { rank: 8, wallet: 'Tn2...4Dw', wins:  3, totalEarned:  0.90, winStreak: 0 },
];

// Simulate winner based on 24h price change + small random factor
// Higher priceChange = more likely to win
export function simulateWinner(tokenA: TokenData, tokenB: TokenData): 'A' | 'B' {
  const scoreA = tokenA.priceChange24h + (Math.random() * 10 - 5);
  const scoreB = tokenB.priceChange24h + (Math.random() * 10 - 5);
  return scoreA >= scoreB ? 'A' : 'B';
}

export function makeBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Mock battle history
export const MOCK_PAST_BATTLES: Array<{
  tokenA: string; tokenB: string; winner: string;
  prizePool: number; endedAt: string;
}> = [
  { tokenA: 'BONK',   tokenB: 'WIF',    winner: 'BONK',   prizePool: 1.20, endedAt: '5m ago' },
  { tokenA: 'PEPE',   tokenB: 'SHIB',   winner: 'PEPE',   prizePool: 0.85, endedAt: '18m ago' },
  { tokenA: 'MYRO',   tokenB: 'POPCAT', winner: 'POPCAT', prizePool: 2.10, endedAt: '32m ago' },
  { tokenA: 'BOME',   tokenB: 'WIF',    winner: 'WIF',    prizePool: 0.60, endedAt: '1h ago' },
  { tokenA: 'BONK',   tokenB: 'BOME',   winner: 'BONK',   prizePool: 3.40, endedAt: '2h ago' },
];

// Preset token CAs for quick-fill
export const PRESET_TOKENS: Array<{ symbol: string; ca: string; chain: string }> = [
  { symbol: 'BONK',   ca: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', chain: 'solana' },
  { symbol: 'WIF',    ca: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', chain: 'solana' },
  { symbol: 'POPCAT', ca: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', chain: 'solana' },
  { symbol: 'BOME',   ca: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  chain: 'solana' },
  { symbol: 'MYRO',   ca: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4', chain: 'solana' },
];
