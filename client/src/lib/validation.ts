/**
 * lib/validation.ts
 * Input validation for all API routes. Server-side only.
 */

import { PublicKey } from '@solana/web3.js';

export function isValidSolanaAddress(addr: string): boolean {
  try { new PublicKey(addr); return true; } catch { return false; }
}

export function isValidTxHash(hash: string): boolean {
  return typeof hash === 'string' && /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(hash);
}

export function shortWallet(wallet: string): string {
  if (wallet.length < 8) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export interface CreateBattleRequest {
  wallet: string; txHash: string;
  tokenA: string; tokenB: string;
  amount: number; duration: number;
}

export interface JoinBattleRequest {
  battleId: string; wallet: string;
  txHash: string; side: 'A' | 'B'; amount: number;
}

export function validateCreateBattleRequest(body: unknown): { data?: CreateBattleRequest; error?: string } {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== 'object') return { error: 'Invalid request body' };
  if (!isValidSolanaAddress(String(b.wallet ?? ''))) return { error: 'Invalid wallet address' };
  if (!isValidTxHash(String(b.txHash ?? ''))) return { error: 'Invalid transaction hash' };
  if (!b.tokenA || typeof b.tokenA !== 'string') return { error: 'tokenA required' };
  if (!b.tokenB || typeof b.tokenB !== 'string') return { error: 'tokenB required' };
  if (b.tokenA === b.tokenB) return { error: 'tokenA and tokenB must be different' };
  const amount = Number(b.amount);
  if (isNaN(amount) || amount < 0.02 || amount > 10) return { error: 'Amount must be 0.02–10 SOL' };
  const duration = Number(b.duration);
  if (![60, 180, 300, 600].includes(duration)) return { error: 'Duration must be 60, 180, 300, or 600 seconds' };
  return {
    data: {
      wallet: String(b.wallet), txHash: String(b.txHash),
      tokenA: String(b.tokenA).toUpperCase().slice(0, 20),
      tokenB: String(b.tokenB).toUpperCase().slice(0, 20),
      amount, duration,
    },
  };
}

export function validateJoinBattleRequest(body: unknown): { data?: JoinBattleRequest; error?: string } {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== 'object') return { error: 'Invalid request body' };
  if (!b.battleId || typeof b.battleId !== 'string') return { error: 'battleId required' };
  if (!isValidSolanaAddress(String(b.wallet ?? ''))) return { error: 'Invalid wallet address' };
  if (!isValidTxHash(String(b.txHash ?? ''))) return { error: 'Invalid transaction hash' };
  if (b.side !== 'A' && b.side !== 'B') return { error: 'side must be A or B' };
  const amount = Number(b.amount);
  if (isNaN(amount) || amount < 0.02 || amount > 10) return { error: 'Amount must be 0.02–10 SOL' };
  return {
    data: {
      battleId: String(b.battleId), wallet: String(b.wallet),
      txHash: String(b.txHash), side: b.side as 'A' | 'B', amount,
    },
  };
}
