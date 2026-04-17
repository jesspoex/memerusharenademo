/**
 * app/api/ensure-battles/route.ts
 *
 * Auth strategy:
 *   - GET  (Vercel Cron): verified by Authorization: Bearer CRON_SECRET
 *   - POST (admin/internal): verified by x-admin-secret header
 *   - If neither CRON_SECRET nor ADMIN_SECRET is set in env, 
 *     both methods return 500 to avoid silent open access.
 *
 * The actual battle creation logic is in lib/ensure-battles.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret, verifyCronSecret } from '@/lib/security';
import { ensureMinimumBattles } from '@/lib/ensure-battles';

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  // Admin/internal sends: x-admin-secret: <ADMIN_SECRET>
  return verifyCronSecret(req) || verifyAdminSecret(req);
}

// GET — called by Vercel Cron (vercel.json schedule: "* * * * *")
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await ensureMinimumBattles();
  return NextResponse.json({
    ok:        result.errors.length === 0,
    existing:  result.existing,
    created:   result.created,
    needed:    result.needed,
    errors:    result.errors,
    ts:        new Date().toISOString(),
  });
}

// POST — called by admin or internal services
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await ensureMinimumBattles();
  return NextResponse.json({
    ok:        result.errors.length === 0,
    existing:  result.existing,
    created:   result.created,
    needed:    result.needed,
    errors:    result.errors,
    ts:        new Date().toISOString(),
  });
    }
