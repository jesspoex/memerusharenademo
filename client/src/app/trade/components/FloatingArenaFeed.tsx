"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Activity, Battle, RecentWinner, sf, sw } from "../constants";

type FeedItem = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  tone: "orange" | "green" | "cyan" | "yellow" | "purple";
  ts?: number;
};

interface Props {
  battles: Battle[];
  activities: Activity[];
  recentWinners: RecentWinner[];
}

const TONES: Record<FeedItem["tone"], { border: string; bg: string; text: string; glow: string; dot: string }> = {
  orange: { border: "rgba(249,115,22,.36)", bg: "rgba(28,12,2,.94)", text: "#fdba74", glow: "rgba(249,115,22,.24)", dot: "#f97316" },
  green:  { border: "rgba(34,197,94,.36)",  bg: "rgba(3,22,13,.94)",  text: "#86efac", glow: "rgba(34,197,94,.22)",  dot: "#22c55e" },
  cyan:   { border: "rgba(34,211,238,.32)", bg: "rgba(5,20,30,.94)",  text: "#67e8f9", glow: "rgba(34,211,238,.20)", dot: "#06b6d4" },
  yellow: { border: "rgba(250,204,21,.34)", bg: "rgba(25,20,3,.94)",  text: "#fde68a", glow: "rgba(250,204,21,.22)", dot: "#eab308" },
  purple: { border: "rgba(167,139,250,.30)",bg: "rgba(20,12,30,.94)", text: "#c4b5fd", glow: "rgba(167,139,250,.18)", dot: "#a78bfa" },
};

function hashNum(seed: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (h % Math.max(1, max - min + 1));
}

function relativeTime(ts?: number | string): string {
  if (!ts) return "just now";
  const num = typeof ts === "string" ? new Date(ts).getTime() : ts;
  if (isNaN(num) || num <= 0) return "just now";
  const delta = Math.floor((Date.now() - num) / 1000);
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

function shortBattleName(name: string) {
  return name.replace(/\s+/g, " ").replace(" vs ", " / ").slice(0, 28);
}

export function FloatingArenaFeed({ battles, activities, recentWinners }: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [timeNow, setTimeNow] = useState(Date.now());

  // Update relative timestamps every 5s
  useEffect(() => {
    const id = setInterval(() => setTimeNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const items = useMemo<FeedItem[]>(() => {
    const freshWinners = recentWinners.slice(0, 4).map((w, i) => ({
      id: `winner-${w.wallet}-${w.time}-${i}`,
      icon: "🏆",
      title: `${sw(w.wallet)} claimed ${sf(w.amount, 3)} SOL`,
      detail: shortBattleName(w.battle || "live battle"),
      tone: "green" as const,
      ts: typeof w.time === "number" ? w.time : Date.now() - i * 15000,
    }));

    const battleSignals = battles.slice(0, 5).map((b, i) => {
      const left = Math.max(0, Math.floor((b.endTime - Date.now()) / 1000));
      const leader = (b.tokenAChange ?? 0) >= (b.tokenBChange ?? 0) ? b.tokenA : b.tokenB;
      const watching = hashNum(`${b.id}-${b.players}`, 3, 17) + Math.max(0, (b.players ?? 1) - 1);
      const ending = left <= 30;
      return {
        id: `battle-${b.id}-${i}`,
        icon: ending ? "⏱️" : "👀",
        title: ending
          ? `${b.tokenA}/${b.tokenB} — final seconds!`
          : `${watching} watching ${b.tokenA}/${b.tokenB}`,
        detail: ending
          ? `${leader} leads · ${left}s left`
          : `${leader} leads · pool ${sf(b.totalPool || b.amount || 0, 3)} SOL`,
        tone: ending ? ("yellow" as const) : ("orange" as const),
        ts: Date.now() - i * 8000,
      };
    });

    const joins = activities.slice(0, 4).map((a, i) => ({
      id: `activity-${a.id}-${i}`,
      icon: a.action === "won" ? "💸" : a.action === "created" ? "⚔️" : "⚡",
      title: a.action === "won"
        ? `${sw(a.user)} won a pool`
        : a.action === "created"
          ? `${sw(a.user)} started battle`
          : `${sw(a.user)} joined battle`,
      detail: shortBattleName(a.battle || "arena is live"),
      tone: a.action === "won" ? ("green" as const) : a.action === "created" ? ("purple" as const) : ("cyan" as const),
      ts: Date.now() - i * 12000,
    }));

    const fallback: FeedItem[] = [
      { id: "fallback-1", icon: "⚔️", title: "Arena is live now", detail: "Pick a side and claim the pool", tone: "orange", ts: Date.now() },
      { id: "fallback-2", icon: "👀", title: "Realtime battles — 1s ticks", detail: "Chart synced · Solana mainnet", tone: "cyan", ts: Date.now() },
      { id: "fallback-3", icon: "💰", title: "Payouts verified on-chain", detail: "Treasury routed · Hybrid MVP", tone: "green", ts: Date.now() },
    ];

    return [...freshWinners, ...battleSignals, ...joins, ...fallback].slice(0, 14);
  }, [battles, activities, recentWinners]);

  useEffect(() => {
    if (!items.length) return;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => { setIndex((v) => (v + 1) % items.length); setVisible(true); }, 200);
    }, 4500);
    return () => window.clearInterval(id);
  }, [items.length]);

  const item = items[index % Math.max(1, items.length)];
  if (!item) return null;
  const tone = TONES[item.tone];

  return (
    <div className={`fixed left-3 right-3 bottom-[130px] sm:left-auto sm:right-5 sm:bottom-[104px] sm:w-[340px] z-[9998] pointer-events-none transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <div className="rounded-2xl border px-3.5 py-3 shadow-2xl backdrop-blur-xl overflow-hidden relative"
        style={{ background: tone.bg, borderColor: tone.border, boxShadow: `0 0 40px ${tone.glow}, 0 8px 32px rgba(0,0,0,.6)` }}>
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px]"
          style={{ background: `linear-gradient(90deg,transparent,${tone.text},transparent)` }} />

        <div className="flex items-center gap-3">
          {/* Icon with pulse ring */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: "rgba(255,255,255,.07)", border: `1px solid ${tone.border}` }}>
              {item.icon}
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black/50"
              style={{ background: tone.dot, animation: "ping 1.5s cubic-bezier(0,0,.2,1) infinite" }} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black truncate leading-tight" style={{ color: tone.text }}>
              {item.title}
            </p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight">
              {item.detail}
            </p>
          </div>

          {/* Live + timestamp */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-55 animate-ping" style={{ background: tone.dot }} />
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: tone.dot }} />
              </span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wide">live</span>
            </div>
            <span className="text-[8px] text-slate-600 tabular-nums">{relativeTime(item.ts)}</span>
          </div>
        </div>

        {/* Bottom indicator dots */}
        <div className="flex justify-center gap-1 mt-2">
          {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
            <div key={i} className="h-0.5 rounded-full transition-all duration-300"
              style={{
                width: i === index % Math.min(items.length, 8) ? 12 : 4,
                background: i === index % Math.min(items.length, 8) ? tone.text : "rgba(255,255,255,.12)",
              }} />
          ))}
        </div>
      </div>
    </div>
  );
}
