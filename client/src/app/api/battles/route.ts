/**
 * app/api/battles/route.ts
 *
 * Returns active battles to the frontend.
 * ALSO runs ensureMinimumBattles() on every GET request so battles
 * are always created before returning the list.
 *
 * Flow:
 *   1. Run ensureMinimumBattles()  ← creates battles if < 3 exist
 *   2. Query DB for live battles
 *   3. Return to frontend
 *
 * No caching (no-store) so every page load gets fresh data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbSelect, DbBattle } from '@/lib/supabase';
import { ensureMinimumBattles } from '@/lib/ensure-battles';

// ── No caching — always run ensure before returning ───────────────────────────
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') ?? 'live';
    const limit       = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100);

    // ── STEP 1: Ensure minimum battles exist BEFORE querying ──────────────────
    // This is the key fix — battles are created inline, not by a separate cron
    const ensureResult = await ensureMinimumBattles();

    if (ensureResult.errors.length > 0) {
      console.warn('[/api/battles] ensureMinimumBattles errors:', ensureResult.errors);
    }

    // ── STEP 2: Fetch battles from DB ─────────────────────────────────────────
    // Build status filter
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
    const statusFilter = statuses.length === 1
      ? `status=eq.${statuses[0]}`
      : `status=in.(${statuses.join(',')})`;

    const battles = await dbSelect<DbBattle>(
      'mr_battles',
      `${statusFilter}&order=created_at.desc&limit=${limit}&select=*`,
    );

    // ── STEP 3: Return with debug info in dev ─────────────────────────────────
    const response: {
      battles: DbBattle[];
      _ensure?: typeof ensureResult;
    } = { battles };

    // Include debug info only in development
    if (process.env.NODE_ENV === 'development') {
      response._ensure = ensureResult;
    }

    return NextResponse.json(response, {
      headers: {
        // Tell frontend: don't cache this
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[/api/battles] Error:', msg);
    return NextResponse.json(
      { error: 'Failed to load battles', battles: [] },
      { status: 500 }
    );
  }
}
