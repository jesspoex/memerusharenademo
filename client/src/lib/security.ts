/**
 * lib/security.ts
 * Rate limiting, request validation, and anti-spam protection.
 * Server-side only — never import from client components.
 */

import { NextRequest } from 'next/server';

// ── In-memory store (resets on cold start — acceptable for MVP) ───────────────
interface RateLimitEntry { count: number; resetAt: number; }
const store = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  store.forEach((v, k) => {
    if (now > v.resetAt) store.delete(k);
  });
}, 5 * 60_000);

// ── Rate Limiter ──────────────────────────────────────────────────────────────
export interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
  resetAt:   number;
}

export function rateLimit(
  key:           string,
  maxRequests:   number,
  windowMs:      number,
): RateLimitResult {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// ── IP Extraction ─────────────────────────────────────────────────────────────
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ── Per-endpoint rate limits ──────────────────────────────────────────────────
export function checkCreateBattleLimit(ip: string, wallet: string): RateLimitResult {
  // Per IP: 5 creates per minute
  const ipCheck = rateLimit(`create:ip:${ip}`, 5, 60_000);
  if (!ipCheck.allowed) return ipCheck;
  // Per wallet: 3 creates per minute
  return rateLimit(`create:wallet:${wallet}`, 3, 60_000);
}

export function checkJoinBattleLimit(ip: string, wallet: string): RateLimitResult {
  // Per IP: 15 joins per minute
  const ipCheck = rateLimit(`join:ip:${ip}`, 15, 60_000);
  if (!ipCheck.allowed) return ipCheck;
  // Per wallet: 10 joins per minute
  return rateLimit(`join:wallet:${wallet}`, 10, 60_000);
}

export function checkPayoutLimit(battleId: string): RateLimitResult {
  // Per battle: 1 payout attempt per 30 seconds (extra protection)
  return rateLimit(`payout:${battleId}`, 1, 30_000);
}

// ── Concurrent payout lock ────────────────────────────────────────────────────
// Prevents two simultaneous payout calls for the same battle
const payoutLocks = new Set<string>();

export function acquirePayoutLock(battleId: string): boolean {
  if (payoutLocks.has(battleId)) return false;
  payoutLocks.add(battleId);
  // Auto-release after 60s as safety net
  setTimeout(() => payoutLocks.delete(battleId), 60_000);
  return true;
}

export function releasePayoutLock(battleId: string): void {
  payoutLocks.delete(battleId);
}

// ── Admin secret verification (server-side only) ──────────────────────────────
export function verifyAdminSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  if (!secret) return false;
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  // Constant-time comparison to prevent timing attacks
  if (secret.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= secret.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── Cron secret verification ──────────────────────────────────────────────────
export function verifyCronSecret(req: NextRequest): boolean {
  // Vercel sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET ?? '';
  if (!cronSecret) return false;
  return auth === `Bearer ${cronSecret}`;
}
