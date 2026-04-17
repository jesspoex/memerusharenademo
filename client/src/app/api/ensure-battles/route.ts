/**
 * app/api/ensure-battles/route.ts
 *
 * ARSITEKTUR BARU: Endpoint ini sekarang bersifat OPSIONAL.
 * Scheduler utama sudah dipindahkan ke Supabase pg_cron.
 *
 * Endpoint ini berguna untuk:
 *   - Debug / monitoring via admin call
 *   - Trigger manual jika diperlukan
 *   - Status check dari dashboard
 *
 * TIDAK LAGI dipanggil oleh Vercel Cron.
 * TIDAK PERLU lagi CRON_SECRET di environment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/security';
import { ensureMinimumBattles } from '@/lib/ensure-battles';
import { dbSelect } from '@/lib/supabase';

// GET — status check + trigger manual (admin only)
export async function GET(req: NextRequest) {
  if (!verifyAdminSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized — x-admin-secret required' }, { status: 401 });
  }

  // Cek status dari Supabase pg_cron
  const now  = new Date().toISOString();
  const live = await dbSelect<{ id: string; token_a: string; token_b: string; end_time: string }>(
    'mr_battles',
    `status=eq.live&end_time=gt.${now}&select=id,token_a,token_b,end_time&order=end_time.asc`,
  );

  // Cek log pg_cron terbaru (jika tabel mr_scheduler_log ada)
  let lastCronRun: unknown = null;
  try {
    const logs = await dbSelect<{ ran_at: string; result: unknown; duration_ms: number }>(
      'mr_scheduler_log',
      `job_name=eq.ensure_battles&order=ran_at.desc&limit=1&select=ran_at,result,duration_ms`,
    );
    lastCronRun = logs?.[0] ?? null;
  } catch { /* tabel mungkin belum ada */ }

  return NextResponse.json({
    status:        'ok',
    scheduler:     'supabase_pg_cron',
    live_battles:  live.length,
    battles:       live.map(b => ({ id: b.id.slice(0, 12), pair: `${b.token_a}/${b.token_b}`, ends: b.end_time })),
    last_cron_run: lastCronRun,
    note:          'Primary scheduler is Supabase pg_cron (mr_scheduler_tick every minute)',
    ts:            now,
  });
}

// POST — trigger manual ensure (admin only)
export async function POST(req: NextRequest) {
  if (!verifyAdminSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized — x-admin-secret required' }, { status: 401 });
  }

  const result = await ensureMinimumBattles();
  return NextResponse.json({
    ok:        result.errors.length === 0,
    existing:  result.existing,
    created:   result.created,
    needed:    result.needed,
    errors:    result.errors,
    source:    result.source,
    note:      'Manual trigger — normally handled by Supabase pg_cron',
    ts:        new Date().toISOString(),
  });
                               }
