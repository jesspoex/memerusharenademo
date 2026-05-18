"use client";
import React, { useState, useEffect } from "react";
import {
  Activity, RecentWinner, LeaderboardEntry, DbBattle,
  sf, fmtN, CFG,
} from "../constants";

interface Props {
  stats: { players: number; battles: number; vol: number; paid: number };
  activities: Activity[];
  recentWinners: RecentWinner[];
  leaderboard: LeaderboardEntry[];
  battleHistory: DbBattle[];
  dbLoaded: boolean;
  realtimeOk: boolean;
}

function RelTime({ raw }: { raw?: string | number }) {
  const calc = () => {
    if (!raw) return "—";
    const ts = typeof raw === "number" ? raw : new Date(raw).getTime();
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 5) return "just now";
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    return `${Math.floor(d / 3600)}h ago`;
  };
  const [label, setLabel] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setLabel(calc()), 5000);
    return () => clearInterval(id);
  });
  return <span className="tabular-nums">{label}</span>;
}

function TxLink({ hash }: { hash?: string }) {
  if (!hash || hash.startsWith("NO") || hash.startsWith("ARENA") || hash.startsWith("PENDING") || hash.startsWith("TOO_SMALL")) return null;
  return (
    <a href={`${CFG.solscan}/tx/${hash}`} target="_blank" rel="noopener noreferrer"
      className="ml-1 text-emerald-400 hover:text-emerald-300 font-black transition-colors" title="Verify on Solscan">
      ↗
    </a>
  );
}

function BattleStatusPill({ status, mode }: { status: string; mode?: string }) {
  if (status === "paid") return (
    <span className="rounded-full px-2 py-0.5 text-[8px] font-black" style={{ background: "rgba(34,197,94,.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,.2)" }}>
      ✅ PAID
    </span>
  );
  if (status === "live") return (
    <span className="rounded-full px-2 py-0.5 text-[8px] font-black flex items-center gap-1" style={{ background: "rgba(249,115,22,.10)", color: "#fb923c", border: "1px solid rgba(249,115,22,.2)" }}>
      <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse inline-block" />LIVE
    </span>
  );
  if (status === "ended") return (
    <span className="rounded-full px-2 py-0.5 text-[8px] font-black" style={{ background: "rgba(100,116,139,.12)", color: "#94a3b8", border: "1px solid rgba(100,116,139,.2)" }}>
      ENDED
    </span>
  );
  return <span className="text-[8px] text-slate-600">{status}</span>;
}

const medal = (r: number) => r === 1 ? "👑" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`;

export function TradeStats({ stats, activities, recentWinners, leaderboard, battleHistory, dbLoaded, realtimeOk }: Props) {
  const [activeSection, setActiveSection] = useState<"feed" | "ledger" | "winners" | "leaderboard">("feed");

  const realBattles   = battleHistory.filter(b => b.mode === "real");
  const arenaBattles  = battleHistory.filter(b => b.mode !== "real");
  const paidReal      = realBattles.filter(b => b.status === "paid").length;
  const verifiedTx    = recentWinners.filter(w => w.txHash && !w.txHash.startsWith("NO")).length;
  const latestProof   = recentWinners.find(w => w.txHash && !w.txHash.startsWith("NO") && !w.txHash.startsWith("ARENA"));
  const payoutRatio   = stats.vol > 0 ? (stats.paid / stats.vol) * 100 : 0;

  return (
    <div className="space-y-4">

      {/* ── Platform Stats ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(8,6,2,.98)", border: "1px solid rgba(249,115,22,.12)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(249,115,22,.08)", background: "rgba(15,8,2,.5)" }}>
          <div>
            <p className="text-[10px] font-black text-orange-400 tracking-widest uppercase">⚡ Arena Pulse</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-slate-600">Realtime public stats</p>
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,.10)", color: "#a78bfa", border: "1px solid rgba(167,139,250,.2)" }}>
                ⚡ MagicBlock
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black"
            style={{ background: realtimeOk ? "rgba(16,185,129,.10)" : "rgba(249,115,22,.10)", color: realtimeOk ? "#34d399" : "#fb923c", border: `1px solid ${realtimeOk ? "rgba(16,185,129,.22)" : "rgba(249,115,22,.22)"}` }}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${realtimeOk ? "bg-emerald-400 animate-ping" : "bg-orange-400"}`} />
            {realtimeOk ? "LIVE" : "SYNCING"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-px" style={{ background: "rgba(255,255,255,.04)" }}>
          {[
            { i: "💰", l: "Paid Out", v: sf(stats.paid, 2) + " SOL", c: "#4ade80" },
            { i: "📊", l: "Volume", v: sf(stats.vol, 2) + " SOL", c: "#facc15" },
            { i: "⚔️", l: "Battles", v: fmtN(stats.battles), c: "#fb923c" },
            { i: "👥", l: "Players", v: fmtN(stats.players), c: "#38bdf8" },
          ].map(s => (
            <div key={s.l} className="py-3 px-1 text-center" style={{ background: "rgba(8,6,2,.98)" }}>
              <div className="text-base leading-none mb-1">{s.i}</div>
              <p className="font-black text-sm tabular-nums" style={{ color: s.c }}>
                {dbLoaded ? s.v : <span className="text-slate-700 animate-pulse">—</span>}
              </p>
              <p className="text-[8px] text-slate-600 mt-0.5 uppercase tracking-wide">{s.l}</p>
            </div>
          ))}
        </div>
        {/* Payout ratio bar */}
        <div className="px-4 py-2 border-t" style={{ borderColor: "rgba(255,255,255,.04)" }}>
          <div className="flex items-center justify-between text-[9px] mb-1">
            <span className="text-slate-600 font-bold">Payout ratio</span>
            <span className="font-black text-emerald-400">{payoutRatio.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, payoutRatio)}%`, background: "linear-gradient(90deg,#f97316,#22c55e)" }} />
          </div>
        </div>
      </div>

      {/* ── Battle Trust Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border p-3 text-center" style={{ background: "rgba(2,8,6,.96)", border: "1px solid rgba(34,197,94,.15)", boxShadow: "0 0 12px rgba(34,197,94,.05)" }}>
          <p className="text-xl font-black text-emerald-400 tabular-nums">{dbLoaded ? realBattles.length : "—"}</p>
          <p className="text-[8px] text-slate-500 mt-1 uppercase tracking-wide">Real Battles</p>
          <p className="text-[8px] text-emerald-600 mt-0.5">{paidReal} paid</p>
        </div>
        <div className="rounded-2xl border p-3 text-center" style={{ background: "rgba(8,47,73,.5)", border: "1px solid rgba(56,189,248,.12)" }}>
          <p className="text-xl font-black text-cyan-400 tabular-nums">{dbLoaded ? verifiedTx : "—"}</p>
          <p className="text-[8px] text-slate-500 mt-1 uppercase tracking-wide">Verified TX</p>
          <p className="text-[8px] text-cyan-700 mt-0.5">on-chain</p>
        </div>
        <div className="rounded-2xl border p-3 text-center" style={{ background: "rgba(120,53,15,.15)", border: "1px solid rgba(249,115,22,.12)" }}>
          <p className="text-xl font-black text-orange-400 tabular-nums">{dbLoaded ? fmtN(stats.players) : "—"}</p>
          <p className="text-[8px] text-slate-500 mt-1 uppercase tracking-wide">Players</p>
          <p className="text-[8px] text-orange-700 mt-0.5">all time</p>
        </div>
      </div>

      {/* ── Section Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(15,10,2,.8)", border: "1px solid rgba(255,255,255,.05)" }}>
        {([
          { id: "feed", label: "🔴 Live Feed" },
          { id: "ledger", label: "📋 Ledger" },
          { id: "winners", label: "🏆 Winners" },
          { id: "leaderboard", label: "👑 Ranks" },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)}
            className="flex-1 py-2 rounded-xl text-[10px] font-black transition-all"
            style={{
              background: activeSection === tab.id ? "rgba(249,115,22,.18)" : "transparent",
              color: activeSection === tab.id ? "#f97316" : "#475569",
              border: activeSection === tab.id ? "1px solid rgba(249,115,22,.25)" : "1px solid transparent",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Live Feed ──────────────────────────────────────────────────────── */}
      {activeSection === "feed" && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(8,6,2,.98)", border: "1px solid rgba(249,115,22,.10)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,.05)" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping inline-block" />
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Live Arena Feed</p>
            </div>
            <span className="text-[9px] text-slate-600 font-mono">{activities.length} events</span>
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-4xl mb-3">⚔️</p>
              <p className="text-white text-sm font-black">Arena is live — be the first to battle</p>
              <p className="text-[11px] text-slate-500">Connect wallet · Create battle · Claim the pool</p>
              <div className="flex justify-center gap-2 mt-3">
                {["SOL", "BONK", "WIF", "PEPE"].map(t => (
                  <span key={t} className="text-[9px] font-black px-2 py-1 rounded-full" style={{ background: "rgba(249,115,22,.10)", color: "#fb923c", border: "1px solid rgba(249,115,22,.18)" }}>{t}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,.04)" }}>
              {activities.slice(0, 15).map((a, i) => {
                const won = a.action === "won";
                const joined = a.action === "joined";
                const created = a.action === "created";
                const color = won ? "#4ade80" : joined ? "#38bdf8" : created ? "#a78bfa" : "#fb923c";
                const bg = won ? "rgba(34,197,94,.06)" : joined ? "rgba(56,189,248,.04)" : created ? "rgba(167,139,250,.04)" : "rgba(249,115,22,.03)";
                return (
                  <div key={a.id || i} className="flex items-center gap-3 px-4 py-3" style={{ background: i === 0 ? bg : "transparent" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: bg, border: `1px solid ${color}22` }}>
                      {won ? "🏆" : joined ? "⚡" : created ? "⚔️" : "🔥"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wide rounded-full px-1.5 py-0.5"
                          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                          {a.action.toUpperCase()}
                        </span>
                        {i === 0 && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black animate-pulse" style={{ background: "rgba(34,197,94,.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,.22)" }}>NEW</span>}
                      </div>
                      <p className="text-[11px] font-black text-white mt-0.5 truncate">{a.user}</p>
                      <p className="text-[10px] text-slate-600 truncate">{a.battle}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {(a.amount ?? 0) > 0 && (
                        <p className="text-sm font-black tabular-nums" style={{ color }}>
                          {won ? "+" : ""}{sf(a.amount ?? 0, 3)} SOL
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-1">
                        <p className="text-[9px] text-slate-600"><RelTime raw={a.time} /></p>
                        {a.txHash && <TxLink hash={a.txHash} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Battle Ledger ──────────────────────────────────────────────────── */}
      {activeSection === "ledger" && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(8,6,2,.98)", border: "1px solid rgba(255,255,255,.06)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,.05)" }}>
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">📋 Battle Status Ledger</p>
              <p className="text-[9px] text-slate-600 mt-0.5">Latest {Math.min(battleHistory.length, 10)} of {battleHistory.length} battles</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[9px] text-orange-400 font-bold">realtime</span>
            </div>
          </div>
          {battleHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 text-sm">No battle history yet</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,.04)" }}>
              {battleHistory.slice(0, 10).map((b, i) => {
                const isReal = b.mode === "real";
                const pool = Number(b.total_deposited ?? b.prize_pool ?? 0);
                const hasTx = b.payout_tx_hash && !b.payout_tx_hash.startsWith("NO") && !b.payout_tx_hash.startsWith("ARENA");
                return (
                  <div key={b.id || i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 ${isReal ? "text-yellow-300" : "text-purple-400"}`}
                          style={{ background: isReal ? "rgba(250,204,21,.10)" : "rgba(167,139,250,.10)", border: `1px solid ${isReal ? "rgba(250,204,21,.2)" : "rgba(167,139,250,.2)"}` }}>
                          {isReal ? "💰 REAL" : "🔓 OPEN"}
                        </span>
                        <BattleStatusPill status={b.status} mode={b.mode} />
                      </div>
                      <p className="text-sm font-black text-white mt-1">
                        {b.token_a} <span className="text-slate-600 text-xs font-normal">vs</span> {b.token_b}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        by {b.creator === "system" ? "🤖 Auto" : `👤 ${b.creator?.slice(0, 8)}…`}
                        {b.winner && b.winner !== "NO_BETS" && b.winner !== "REFUND" && (
                          <span className="ml-1 text-emerald-500">· {b.winner} won</span>
                        )}
                        {b.winner === "REFUND" && <span className="ml-1 text-yellow-500">· refunded</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black tabular-nums ${pool > 0 ? "text-orange-400" : "text-slate-600"}`}>
                        {pool > 0 ? sf(pool, 3) + " SOL" : "0.00 SOL"}
                      </p>
                      {hasTx && (
                        <a href={`${CFG.solscan}/tx/${b.payout_tx_hash}`} target="_blank" rel="noopener noreferrer"
                          className="text-[9px] text-emerald-400 font-black flex items-center justify-end gap-0.5 mt-0.5">
                          ✅ verified ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 py-2 border-t text-center" style={{ borderColor: "rgba(255,255,255,.04)" }}>
            <p className="text-[9px] text-slate-700">Showing latest 10 · older records stay in database.</p>
          </div>
        </div>
      )}

      {/* ── Recent Winners ─────────────────────────────────────────────────── */}
      {activeSection === "winners" && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(2,8,6,.98)", border: "1px solid rgba(34,197,94,.14)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(34,197,94,.08)" }}>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              🏆 Recent Winners · Payout Proof
            </p>
            <p className="text-[9px] text-slate-600 mt-0.5">{verifiedTx} verified on-chain</p>
          </div>

          {/* Latest verified TX proof */}
          {latestProof && (
            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(34,197,94,.08)", background: "rgba(6,78,59,.06)" }}>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mb-2">Latest verified payout</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-white font-black truncate">{latestProof.wallet}</p>
                  <p className="text-[10px] text-slate-500">{latestProof.battle}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-emerald-400 tabular-nums">+{sf(latestProof.amount, 4)} SOL</p>
                  {latestProof.txHash && (
                    <a href={`${CFG.solscan}/tx/${latestProof.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] font-black text-emerald-500 flex items-center justify-end gap-0.5">
                      ✅ Solscan ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {recentWinners.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">🏆</p>
              <p className="text-slate-500 text-sm font-bold">First winner coming soon</p>
              <p className="text-[11px] text-slate-700 mt-1">Create a real battle to start</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,.04)" }}>
              {recentWinners.slice(0, 8).map((w, i) => (
                <div key={`${w.wallet}-${i}`} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{i === 0 ? "👑" : i === 1 ? "🥈" : "🥉"}</span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-black text-white truncate">{w.wallet}</p>
                      <p className="text-[10px] text-slate-600 truncate">{w.battle}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-emerald-400 tabular-nums">+{sf(w.amount, 4)} SOL</p>
                    <div className="flex items-center justify-end gap-1">
                      <p className="text-[9px] text-slate-600"><RelTime raw={w.time} /></p>
                      {w.txHash && <TxLink hash={w.txHash} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard ────────────────────────────────────────────────────── */}
      {activeSection === "leaderboard" && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(8,6,2,.98)", border: "1px solid rgba(250,204,21,.12)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(250,204,21,.08)" }}>
            <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">👑 Arena Leaderboard · Season 01</p>
            <p className="text-[9px] text-slate-600 mt-0.5">Top wallets by earnings · Season status, payout flex</p>
          </div>
          {leaderboard.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">👑</p>
              <p className="text-slate-500 text-sm font-bold">Arena Legend unlocks after first verified claim</p>
              <p className="text-[11px] text-slate-700 mt-1">Be the first to claim the top spot 🏆</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,.04)" }}>
              {leaderboard.map((l, i) => {
                const crown = i === 0;
                return (
                  <div key={l.wallet || i} className="px-4 py-3 flex items-center gap-3"
                    style={{ background: crown ? "linear-gradient(90deg,rgba(250,204,21,.06),transparent)" : "transparent" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                      style={{ background: crown ? "linear-gradient(135deg,#facc15,#fb923c)" : "rgba(30,41,59,.6)", color: crown ? "#000" : "#94a3b8" }}>
                      {medal(i + 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-black text-white truncate">{l.wallet}</p>
                      <p className="text-[9px] text-slate-600">{l.wins} win{l.wins !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-yellow-400 tabular-nums text-sm">+{sf(l.earnings, 3)} SOL</p>
                      {crown && <p className="text-[8px] text-yellow-600 font-bold">👑 KING</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Public Treasury Link ───────────────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(2,8,6,.98)", border: "1px solid rgba(34,197,94,.12)" }}>
        <div className="px-4 py-3">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">🔗 Public Treasury</p>
          <a href={`${CFG.solscan}/account/${CFG.treasury}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border active:scale-[.98] transition-all"
            style={{ background: "rgba(6,78,59,.10)", border: "1px solid rgba(34,197,94,.18)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.2)" }}>
              💸
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white">Treasury Wallet</p>
              <p className="text-[10px] text-slate-600 font-mono truncate">{CFG.treasury}</p>
            </div>
            <span className="text-[10px] font-black text-emerald-400 flex-shrink-0">VERIFY ↗</span>
          </a>
          <p className="text-[9px] text-slate-700 text-center mt-2">Every real battle entry routes through this wallet · Payouts verified on-chain</p>
        </div>
      </div>

    </div>
  );
}
