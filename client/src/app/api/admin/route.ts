import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

// ── ENV (semua server-side, tidak ada NEXT_PUBLIC_) ───────────────────────────
// ADMIN_SECRET=   ← kamu set di Vercel, tidak pernah sampai ke browser
// NEXT_PUBLIC_SUPABASE_URL=
// NEXT_PUBLIC_SUPABASE_ANON=

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://wlpgpjebwwublxfcpjos.supabase.co';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGdwamVid3d1Ymx4ZmNwam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzI4MjYsImV4cCI6MjA5MDM0ODgyNn0.nAiMQ59OSo8fB_OlzTNWDYW4G5qNIAlGEQVTODArypM';

function sbH() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_ANON,
    'Authorization': `Bearer ${SB_ANON}`,
  };
}

function verifySecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  try {
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
  } catch { return false; }
}

// ── GET /api/admin?action=stats — ambil semua data ────────────────────────────
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('s');
  if (!verifySecret(secret, process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get('action') || 'all';

  try {
    if (action === 'treasury') {
      // Hanya return treasury address — balance dari RPC
      const { Connection, LAMPORTS_PER_SOL, Keypair } = await import('@solana/web3.js');
      const raw = process.env.TREASURY_PRIVATE_KEY;
      if (!raw) return NextResponse.json({ error: 'TREASURY_PRIVATE_KEY not set' }, { status: 500 });
      const arr = JSON.parse(raw) as number[];
      const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
      const rpcUrls = [
        process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
      ];
      let bal = 0;
      for (const url of rpcUrls) {
        try {
          const conn = new Connection(url, { commitment: 'confirmed' });
          bal = await conn.getBalance(kp.publicKey, 'confirmed');
          break;
        } catch { /* try next */ }
      }
      return NextResponse.json({
        address: kp.publicKey.toString(),
        balance: bal / LAMPORTS_PER_SOL,
        solscan: `https://solscan.io/account/${kp.publicKey.toString()}`,
      });
    }

    // Default: ambil semua data dari Supabase
    const [bRes, wRes, sRes, aRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/mr_battles?select=*&order=created_at.desc&limit=100`, { headers: sbH(), cache: 'no-store' }),
      fetch(`${SB_URL}/rest/v1/mr_winners?select=*&order=created_at.desc&limit=50`,  { headers: sbH(), cache: 'no-store' }),
      fetch(`${SB_URL}/rest/v1/mr_stats?id=eq.1&select=*`,                           { headers: sbH(), cache: 'no-store' }),
      fetch(`${SB_URL}/rest/v1/mr_activities?select=*&order=created_at.desc&limit=30`, { headers: sbH(), cache: 'no-store' }),
    ]);

    const [battles, winners, statsArr, activities] = await Promise.all([
      bRes.json(), wRes.json(), sRes.json(), aRes.json(),
    ]);

    return NextResponse.json({
      battles:    battles    || [],
      winners:    winners    || [],
      stats:      statsArr?.[0] || null,
      activities: activities || [],
      timestamp:  new Date().toISOString(),
    });

  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST /api/admin — manual payout trigger ───────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!verifySecret(secret, process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { battleId } = await req.json() as { battleId: string };
  if (!battleId) return NextResponse.json({ error: 'battleId required' }, { status: 400 });

  // Delegate ke /api/payout dengan admin privileges
  const origin = req.nextUrl.origin;
  const res = await fetch(`${origin}/api/payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payout-secret': process.env.ADMIN_SECRET || '',
    },
    body: JSON.stringify({ battleId }),
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
