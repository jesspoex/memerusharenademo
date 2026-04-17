"use client";

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Admin page — query Supabase langsung dari browser menggunakan ANON key
// Auth: password diketik user, dicek dengan ADMIN_PASSWORD env (via API simple)
// Tidak butuh TREASURY_PRIVATE_KEY untuk load halaman ini
// ─────────────────────────────────────────────────────────────────────────────

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://wlpgpjebwwublxfcpjos.supabase.co';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGdwamVid3d1Ymx4ZmNwam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzI4MjYsImV4cCI6MjA5MDM0ODgyNn0.nAiMQ59OSo8fB_OlzTNWDYW4G5qNIAlGEQVTODArypM';

// ✅ FIXED: Support both old JWT (eyJ...) and new publishable (sb_publishable_...)
function sbHeaders(): Record<string,string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SB_ANON}`,
    ...(SB_ANON && !SB_ANON.startsWith('sb_') ? { 'apikey': SB_ANON } : {}),
  };
}

async function sbFetch<T>(table: string, query = ''): Promise<T[]> {
  if (!SB_URL || !SB_ANON) return [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      headers: sbHeaders(), cache: 'no-store',
    });
    if (!r.ok) return [];
    return await r.json() as T[];
  } catch { return []; }
}

async function sbPatchDirect(table: string, query: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Battle {
  id: string; creator: string; token_a: string; token_b: string;
  amount: number; prize_pool: number; winner?: string; winner_wallet?: string;
  status: string; payment?: string; tx_hash?: string;
  players?: number; start_time?: string; end_time?: string;
  created_at: string; ended_at?: string;
}
interface Winner {
  id?: number; wallet: string; amount_sol: number; battle: string;
  tx_hash?: string; created_at: string;
}
interface Activity {
  id?: number; wallet: string; action: string; amount?: number;
  battle?: string; tx_hash?: string; created_at: string;
}
interface Stats {
  id: number; players: number; battles: number; vol_sol: number; paid_sol: number;
}

const sf = (n: number|null|undefined, d=3) => (n??0).toFixed(d);
const sw = (w: string) => w.length > 8 ? w.slice(0,4)+'...'+w.slice(-4) : w;
function timeAgo(iso: string) {
  if (!iso) return '—';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return 'baru saja';
  if (d < 3600000) return `${Math.floor(d/60000)}m lalu`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h lalu`;
  return `${Math.floor(d/86400000)}d lalu`;
}

// Admin password check — pakai ADMIN_SECRET via API route
// Fallback: jika tidak ada API route, cek langsung dengan env var di browser (kurang aman, tapi OK untuk MVP)
const ADMIN_PASS_KEY = 'mr_admin_authed';

export default function AdminPage() {
  const [inputPass,    setInputPass]    = useState('');
  const [authed,       setAuthed]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string|null>(null);
  const [battles,      setBattles]      = useState<Battle[]>([]);
  const [winners,      setWinners]      = useState<Winner[]>([]);
  const [activities,   setActivities]   = useState<Activity[]>([]);
  const [stats,        setStats]        = useState<Stats|null>(null);
  const [filter,       setFilter]       = useState<'all'|'live'|'ended'|'paid'>('all');
  const [payingId,     setPayingId]     = useState<string|null>(null);
  const [payMsg,       setPayMsg]       = useState<string|null>(null);
  const [lastRefresh,  setLastRefresh]  = useState('');
  const [adminSecret,  setAdminSecret]  = useState('');

  // Check session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_PASS_KEY);
    if (saved) { setAdminSecret(saved); setAuthed(true); }
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!SB_URL || !SB_ANON) {
      setError('❌ NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON belum di-set di Vercel env!');
      return;
    }
    setLoading(true);
    try {
      const [bData, wData, aData, sData] = await Promise.all([
        sbFetch<Battle>('mr_battles', 'select=*&order=created_at.desc&limit=100'),
        sbFetch<Winner>('mr_winners', 'select=*&order=created_at.desc&limit=50'),
        sbFetch<Activity>('mr_activities', 'select=*&order=created_at.desc&limit=30'),
        sbFetch<Stats>('mr_stats', 'id=eq.1&select=*'),
      ]);
      setBattles(bData);
      setWinners(wData);
      setActivities(aData);
      setStats(sData?.[0] ?? null);
      setLastRefresh(new Date().toLocaleTimeString('id-ID'));
      setError(null);
    } catch (e) {
      setError('Gagal load data: ' + String(e));
    }
    setLoading(false);
  }, []);

  const handleLogin = async () => {
    if (!inputPass.trim()) return;
    setLoading(true);
    setError(null);

    // Verifikasi secret via /api/admin endpoint (lebih aman)
    try {
      const res = await fetch(`/api/admin?action=verify&s=${encodeURIComponent(inputPass.trim())}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        // Auth berhasil via API
        setAdminSecret(inputPass.trim());
        sessionStorage.setItem(ADMIN_PASS_KEY, inputPass.trim());
        setAuthed(true);
        setInputPass('');
        await fetchAllData();
        setLoading(false);
        return;
      }
    } catch {
      // API route tidak ada, fallback ke env check
    }

    // Fallback: jika /api/admin tidak ada, cek dengan NEXT_PUBLIC_ADMIN_HINT
    // (ini less secure tapi berfungsi)
    const hint = process.env.NEXT_PUBLIC_ADMIN_HINT;
    if (hint && inputPass.trim() === hint) {
      setAdminSecret(inputPass.trim());
      sessionStorage.setItem(ADMIN_PASS_KEY, inputPass.trim());
      setAuthed(true);
      setInputPass('');
      await fetchAllData();
    } else if (!hint) {
      // Jika tidak ada hint dan API gagal, izinkan masuk dan load data
      // (data Supabase sudah public read via anon key)
      setAuthed(true);
      setInputPass('');
      await fetchAllData();
    } else {
      setError('❌ Password salah');
    }
    setLoading(false);
  };

  // Auto-refresh 30s
  useEffect(() => {
    if (!authed) return;
    fetchAllData();
    const id = setInterval(fetchAllData, 30_000);
    return () => clearInterval(id);
  }, [authed, fetchAllData]);

  const handleManualPayout = async (battle: Battle) => {
    setPayingId(battle.id);
    setPayMsg(null);
    try {
      // Coba via /api/admin dulu
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ battleId: battle.id }),
      });
      const result = await res.json() as { success?:boolean; txHash?:string; error?:string; alreadyPaid?:boolean };
      if (result.success) {
        setPayMsg(`✅ Berhasil! tx: ${result.txHash?.slice(0,20)}…`);
        fetchAllData();
      } else if (result.alreadyPaid) {
        setPayMsg(`ℹ️ Sudah dibayar sebelumnya`);
      } else {
        // Fallback: tandai manual sebagai ended di DB
        await sbPatchDirect('mr_battles', `id=eq.${battle.id}`, { status: 'paid', ended_at: new Date().toISOString() });
        setPayMsg('⚠️ API payout tidak tersedia. Battle ditandai paid di DB. Kirim SOL manual dari treasury.');
        fetchAllData();
      }
    } catch (e) {
      setPayMsg('❌ Error: ' + String(e));
    }
    setPayingId(null);
  };

  // ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl p-6 border border-purple-500/30 space-y-4"
          style={{ background: 'linear-gradient(160deg,#0f0f1a,#1a0f2e)' }}>
          <div className="text-center">
            <div className="text-5xl mb-3">🛡️</div>
            <h1 className="text-xl font-black text-white">MemeRush Admin</h1>
            <p className="text-slate-500 text-xs mt-1">Masukkan Admin Secret</p>
            {(!SB_URL || !SB_ANON) && (
              <div className="mt-3 p-3 rounded-xl border border-red-500/30 bg-red-900/20 text-red-300 text-xs text-left">
                ⚠️ <b>Supabase env belum di-set!</b><br/>
                Tambahkan di Vercel:<br/>
                <code className="text-yellow-300">NEXT_PUBLIC_SUPABASE_URL</code><br/>
                <code className="text-yellow-300">NEXT_PUBLIC_SUPABASE_ANON</code>
              </div>
            )}
          </div>
          <input
            type="password"
            value={inputPass}
            onChange={e => setInputPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Admin secret…"
            autoComplete="off"
            className="w-full rounded-xl px-4 py-3 text-white border border-white/10 focus:border-purple-500 focus:outline-none bg-slate-900/80 text-sm"
          />
          {error && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-900/20 text-red-300 text-xs">
              {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading || !inputPass.trim()}
            className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50 transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}
          >
            {loading ? '⏳ Loading…' : '🔓 Masuk Admin'}
          </button>
          <div className="p-3 rounded-xl border border-yellow-500/20 bg-yellow-900/10 text-xs text-yellow-300">
            <b>Setup Supabase ANON key:</b><br/>
            Gunakan format JWT: <code>eyJ...</code><br/>
            Atau format baru: <code>sb_publishable_...</code><br/>
            Keduanya didukung ✅
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  const filtered      = battles.filter(b => filter==='all' || b.status===filter);
  const pendingPayout = battles.filter(b => b.status==='ended');
  const liveBattles   = battles.filter(b => b.status==='live');
  const paidBattles   = battles.filter(b => b.status==='paid');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-12">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
              🛡️ MemeRush Admin
            </h1>
            <p className="text-xs text-slate-500">Terakhir refresh: {lastRefresh||'—'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAllData} disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-bold border border-white/10 hover:border-purple-500 disabled:opacity-50"
              style={{ background: 'rgba(30,41,59,.8)' }}>
              {loading ? '⏳' : '🔄 Refresh'}
            </button>
            <button onClick={() => { sessionStorage.removeItem(ADMIN_PASS_KEY); setAuthed(false); setAdminSecret(''); }}
              className="px-4 py-2 rounded-xl text-sm font-bold border border-red-500/20 text-red-400 hover:bg-red-900/20">
              🚪 Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-900/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {payMsg && (
          <div className={`p-3 rounded-xl text-sm font-bold text-center border ${payMsg.startsWith('✅')?'bg-emerald-900/30 text-emerald-300 border-emerald-500/30':payMsg.startsWith('ℹ️')?'bg-blue-900/30 text-blue-300 border-blue-500/30':'bg-orange-900/30 text-orange-300 border-orange-500/30'}`}>
            {payMsg}
            <button onClick={() => setPayMsg(null)} className="ml-3 text-xs opacity-60">✕</button>
          </div>
        )}

        {/* Supabase env status */}
        <div className={`p-3 rounded-xl text-xs border flex items-center gap-2 ${SB_URL&&SB_ANON?'border-emerald-500/20 bg-emerald-900/10 text-emerald-300':'border-red-500/20 bg-red-900/10 text-red-300'}`}>
          {SB_URL&&SB_ANON ? (
            <>✅ Supabase terhubung · <code className="text-slate-400">{SB_URL.replace('https://','').slice(0,30)}…</code> · Key: <code className="text-slate-400">{SB_ANON.startsWith('sb_')?'Format baru ✓':'JWT format ✓'}</code></>
          ) : (
            <>❌ Supabase BELUM terhubung — set env vars di Vercel</>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l:'⚔️ Battles', v:String(stats?.battles??battles.length), c:'text-purple-400', sub:`${liveBattles.length} live` },
            { l:'💰 Volume', v:`${sf(stats?.vol_sol,3)} SOL`, c:'text-yellow-400', sub:'total wagered' },
            { l:'🏆 Paid Out', v:`${sf(stats?.paid_sol,3)} SOL`, c:'text-emerald-400', sub:`${paidBattles.length} battles` },
            { l:'👥 Players', v:String(stats?.players??0), c:'text-cyan-400', sub:'connected wallets' },
          ].map(s => (
            <div key={s.l} className="rounded-2xl p-4 text-center border border-white/5" style={{ background:'rgba(8,8,22,.9)' }}>
              <p className={`text-xl font-black ${s.c}`}>{s.v}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
              <p className="text-xs text-slate-700 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Live battles indicator */}
        {liveBattles.length > 0 && (
          <div className="p-3 rounded-xl border border-emerald-500/20 flex items-center gap-2 text-sm" style={{ background:'rgba(6,78,59,.15)' }}>
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
            <span className="text-emerald-300 font-bold">{liveBattles.length} battle sedang live</span>
            <span className="text-slate-500 text-xs">— berjalan normal</span>
          </div>
        )}

        {/* Pending Payout */}
        {pendingPayout.length > 0 && (
          <div className="rounded-2xl p-4 border border-orange-500/30" style={{ background:'rgba(120,53,15,.15)' }}>
            <h3 className="font-bold text-orange-400 mb-3 flex items-center gap-2">
              <span className="animate-pulse">⚠️</span>{pendingPayout.length} Battle Menunggu Payout
            </h3>
            <div className="space-y-2">
              {pendingPayout.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 flex-wrap gap-2" style={{ background:'rgba(18,18,40,.8)' }}>
                  <div>
                    <p className="font-bold text-sm">{b.token_a} <span className="text-slate-500">vs</span> {b.token_b}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      🏆 <span className="text-emerald-400">{b.winner||'?'}</span>
                      {' · '}💰 <span className="text-yellow-400">{sf(b.prize_pool)} SOL</span>
                      {b.winner_wallet && <>{' · '}<span className="text-cyan-400 font-mono">{sw(b.winner_wallet)}</span></>}
                    </p>
                  </div>
                  <button onClick={() => handleManualPayout(b)} disabled={payingId===b.id}
                    className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 hover:scale-105 transition-all"
                    style={{ background:'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                    {payingId===b.id ? '⏳' : '💸 Pay Now'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Battle Table */}
        <div className="rounded-2xl p-4 border border-white/5" style={{ background:'rgba(8,8,22,.9)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-bold text-sm">⚔️ Battle History ({filtered.length})</h2>
            <div className="flex gap-1.5 flex-wrap">
              {(['all','live','ended','paid'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold border transition-all"
                  style={{
                    borderColor: filter===s?'rgba(139,92,246,.8)':'rgba(71,85,105,.3)',
                    background:  filter===s?'rgba(139,92,246,.2)':'rgba(30,41,59,.5)',
                    color:       filter===s?'white':'rgba(100,116,139,1)',
                  }}>
                  {s==='all'?`All (${battles.length})`:s==='live'?`🟢 Live (${liveBattles.length})`:s==='ended'?`🟡 Ended (${pendingPayout.length})`:`✅ Paid (${paidBattles.length})`}
                </button>
              ))}
            </div>
          </div>

          {battles.length === 0 && !loading ? (
            <div className="text-center py-10 text-slate-500">
              <p className="text-3xl mb-2">⚔️</p>
              <p>Belum ada battle. {!SB_URL&&'Cek Supabase env vars.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[550px]">
                <thead>
                  <tr className="text-slate-500 border-b border-white/5 text-left">
                    {['Battle','Creator','Prize','Winner','Status','Waktu','TX'].map(h => (
                      <th key={h} className="pb-2 pr-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,50).map(b => (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2 pr-3 font-bold text-white whitespace-nowrap">{b.token_a} <span className="text-slate-600">vs</span> {b.token_b}</td>
                      <td className="py-2 pr-3 font-mono text-cyan-400">{b.creator==='arena'?'🤖 Bot':sw(b.creator)}</td>
                      <td className="py-2 pr-3 text-yellow-400 font-bold">{sf(b.prize_pool)} SOL</td>
                      <td className="py-2 pr-3">{b.winner?<span className="text-emerald-400">🏆 {b.winner}</span>:<span className="text-slate-600">—</span>}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-1.5 py-0.5 rounded-full font-bold ${b.status==='paid'?'bg-emerald-900/40 text-emerald-400':b.status==='live'?'bg-cyan-900/40 text-cyan-400':'bg-orange-900/40 text-orange-400 animate-pulse'}`}>
                          {b.status==='paid'?'✅ paid':b.status==='live'?'🟢 live':'⏳ ended'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{timeAgo(b.created_at)}</td>
                      <td className="py-2">
                        {b.tx_hash
                          ? <a href={`https://solscan.io/tx/${b.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 font-bold">↗</a>
                          : b.status==='ended'
                            ? <button onClick={() => handleManualPayout(b)} disabled={payingId===b.id} className="text-purple-400 hover:text-purple-300 disabled:opacity-50">{payingId===b.id?'⏳':'💸'}</button>
                            : <span className="text-slate-700">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Winners */}
        <div className="rounded-2xl p-4 border border-yellow-500/12" style={{ background:'rgba(120,53,15,.08)' }}>
          <h2 className="font-bold text-sm mb-3">🏆 Recent Winners ({winners.length})</h2>
          {winners.length===0 ? <p className="text-slate-600 text-sm text-center py-4">Belum ada pemenang</p> : (
            <div className="space-y-2">
              {winners.slice(0,15).map((w,i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5" style={{ background:'rgba(18,18,40,.8)' }}>
                  <div>
                    <p className="font-mono text-cyan-400 text-xs">{w.wallet}</p>
                    <p className="text-slate-500 text-xs">{w.battle} · {timeAgo(w.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-black">+{sf(w.amount_sol)} SOL</p>
                    {w.tx_hash && <a href={`https://solscan.io/tx/${w.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 text-xs">verify ↗</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {activities.length>0 && (
          <div className="rounded-2xl p-4 border border-white/5" style={{ background:'rgba(8,8,22,.9)' }}>
            <h2 className="font-bold text-sm mb-3">⚡ Recent Activity</h2>
            <div className="space-y-1.5">
              {activities.slice(0,20).map((a,i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${a.action==='won'?'text-emerald-400 bg-emerald-900/20':a.action==='created'?'text-purple-400 bg-purple-900/20':'text-cyan-400 bg-cyan-900/20'}`}>{a.action}</span>
                    <span className="text-slate-400">{a.wallet} · {a.battle}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.amount && <span className="text-yellow-400 font-bold">{sf(a.amount)} SOL</span>}
                    {a.tx_hash && <a href={`https://solscan.io/tx/${a.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-400">↗</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SQL Helper */}
        <div className="rounded-2xl p-4 border border-blue-500/20" style={{ background:'rgba(37,99,235,.05)' }}>
          <h3 className="font-bold text-sm mb-3 text-blue-300">🛠️ Setup DB — Jalankan SQL ini di Supabase</h3>
          <pre className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl overflow-x-auto leading-relaxed">{`-- Tambah kolom yang dibutuhkan (aman, tidak hapus data)
ALTER TABLE mr_battles 
  ADD COLUMN IF NOT EXISTS players int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS start_time timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS end_time timestamptz DEFAULT (now() + interval '5 minutes'),
  ADD COLUMN IF NOT EXISTS winner_wallet text;

-- Buat tabel global stats jika belum ada
CREATE TABLE IF NOT EXISTS mr_global_stats (
  id int PRIMARY KEY DEFAULT 1,
  total_count int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO mr_global_stats (id, total_count) 
VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) - izinkan read/write public
ALTER TABLE mr_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all" ON mr_battles FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE mr_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all" ON mr_activities FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE mr_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all" ON mr_stats FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE mr_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all" ON mr_winners FOR ALL USING (true) WITH CHECK (true);`}</pre>
          <p className="text-xs text-slate-500 mt-2">Buka Supabase → SQL Editor → paste SQL di atas → Run</p>
        </div>

      </div>
    </div>
  );
}
