// src/app/api/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenByCA } from '@/lib/dexscreener';

export async function GET(req: NextRequest) {
  const ca = req.nextUrl.searchParams.get('ca');
  if (!ca) {
    return NextResponse.json({ error: 'Missing ca param' }, { status: 400 });
  }

  const token = await fetchTokenByCA(ca.trim());
  if (!token) {
    return NextResponse.json({ error: 'Token not found on DexScreener' }, { status: 404 });
  }

  return NextResponse.json(token);
}
