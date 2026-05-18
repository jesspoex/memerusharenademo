"use client";
import React, { useEffect, useRef } from "react";

interface Props {
  dA: number[]; dB: number[];
  cA?: string; cB?: string;
  h?: number; labelA?: string; labelB?: string; showLabels?: boolean;
}

const cleanSeries = (data: number[]) => {
  const s = (data || []).filter((n) => Number.isFinite(n)).slice(-90);
  if (s.length === 0) return [0, 0];
  if (s.length === 1) return [s[0], s[0]];
  return s;
};

const rgba = (hex: string, a: number) => {
  if (!hex?.startsWith("#")) return hex;
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((x) => x + x).join("") : raw;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function injectVolatility(data: number[], vol = 0.07): number[] {
  if (data.length < 4) return data;
  const out: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    const prev = out[i - 1];
    const target = data[i];
    const spike = (Math.random() > 0.84) ? (Math.random() - 0.5) * vol * 2.8 : 0;
    out.push(parseFloat((prev * 0.6 + target * 0.4 + spike).toFixed(5)));
  }
  return out;
}

export function MiniChart({ dA, dB, cA = "#f97316", cB = "#38bdf8", h = 120, labelA = "", labelB = "", showLabels = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const volatileA = useRef<number[]>([]);
  const volatileB = useRef<number[]>([]);
  const lastHashA = useRef("");
  const lastHashB = useRef("");

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const rawA = cleanSeries(dA);
    const rawB = cleanSeries(dB);
    const hashA = rawA.slice(-5).join(",");
    const hashB = rawB.slice(-5).join(",");

    if (hashA !== lastHashA.current) { volatileA.current = injectVolatility(rawA, 0.06); lastHashA.current = hashA; }
    if (hashB !== lastHashB.current) { volatileB.current = injectVolatility(rawB, 0.072); lastHashB.current = hashB; }

    const draw = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = (now - startRef.current) / 1000;
      const pulse = (Math.sin(t * 2.5) + 1) / 2;
      const breathe = (Math.sin(t * 0.7) + 1) / 2;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = cv.clientWidth || 620;
      const H = h;
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const a = volatileA.current.length > 1 ? volatileA.current : rawA;
      const b = volatileB.current.length > 1 ? volatileB.current : rawB;

      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "rgba(12,8,2,.93)");
      bg.addColorStop(0.45, "rgba(7,4,1,.97)");
      bg.addColorStop(1, "rgba(2,6,23,.96)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const movingGrad = ctx.createLinearGradient(W * breathe * 0.35, 0, W, H);
      movingGrad.addColorStop(0, "rgba(249,115,22,.022)");
      movingGrad.addColorStop(0.5, "rgba(56,189,248,.016)");
      movingGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = movingGrad;
      ctx.fillRect(0, 0, W, H);

      const all = [...a, ...b, 0];
      let mn = Math.min(...all), mx = Math.max(...all);
      const range0 = Math.max(mx - mn, 0.022);
      const pad = Math.max(range0 * 0.54, 0.07);
      mn -= pad; mx += pad;
      const range = mx - mn || 1;

      const left = 10, right = 36, top = 16, bottom = 20;
      const PW = Math.max(1, W - left - right);
      const PH = Math.max(1, H - top - bottom);
      const xAt = (i: number, len: number) => left + (i / Math.max(1, len - 1)) * PW;
      const yAt = (v: number) => top + (1 - (v - mn) / range) * PH;
      const zeroY = yAt(0);

      const aLast = a[a.length - 1] || 0, bLast = b[b.length - 1] || 0;
      const aLead = aLast >= bLast;
      const leaderColor = aLead ? cA : cB;
      const leaderY = yAt(aLead ? aLast : bLast);
      const rg = ctx.createRadialGradient(W - right, leaderY, 0, W - right, leaderY, Math.max(W, H) * 0.52);
      rg.addColorStop(0, rgba(leaderColor, 0.13 + pulse * 0.07));
      rg.addColorStop(0.4, rgba(leaderColor, 0.04));
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);

      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(148,163,184,${0.052 + breathe * 0.016})`;
      for (let i = 0; i <= 3; i++) {
        const y = top + (PH / 3) * i;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W - right, y); ctx.stroke();
      }
      for (let i = 1; i <= 4; i++) {
        const x = left + (PW / 4) * i;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, H - bottom); ctx.stroke();
      }

      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + breathe * 0.04})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, zeroY); ctx.lineTo(W - right, zeroY); ctx.stroke();
      ctx.setLineDash([]);

      const smoothPath = (data: number[]) => {
        ctx.beginPath();
        data.forEach((v, i) => {
          const x = xAt(i, data.length), y = yAt(v);
          if (i === 0) { ctx.moveTo(x, y); return; }
          const px = xAt(i - 1, data.length), py = yAt(data[i - 1]);
          const t2 = 0.38;
          ctx.bezierCurveTo(px + (x - px) * t2, py, x - (x - px) * t2, y, x, y);
        });
      };

      const point = (data: number[], i: number) => ({ x: xAt(i, data.length), y: yAt(data[i]) });

      const drawLine = (data: number[], color: string, active: boolean, label: string) => {
        if (data.length < 2) return;
        const last = point(data, data.length - 1);
        const first = point(data, 0);
        const lastVal = data[data.length - 1] || 0;

        smoothPath(data);
        ctx.lineTo(last.x, zeroY); ctx.lineTo(first.x, zeroY); ctx.closePath();
        const fill = ctx.createLinearGradient(0, Math.min(last.y, zeroY), 0, Math.max(last.y, zeroY) + 12);
        fill.addColorStop(0, rgba(color, active ? 0.30 : 0.09));
        fill.addColorStop(0.55, rgba(color, active ? 0.12 : 0.03));
        fill.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = fill; ctx.fill();

        smoothPath(data);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = color; ctx.shadowBlur = active ? 20 + pulse * 9 : 6;
        ctx.strokeStyle = rgba(color, active ? 0.48 : 0.16);
        ctx.lineWidth = active ? 9 : 4.5;
        ctx.stroke();

        smoothPath(data);
        ctx.strokeStyle = active ? color : rgba(color, 0.76);
        ctx.lineWidth = active ? 2.8 : 1.5;
        ctx.shadowBlur = active ? 9 + pulse * 5 : 2;
        ctx.stroke();

        if (active) {
          smoothPath(data);
          ctx.strokeStyle = "rgba(255,255,255,.20)";
          ctx.lineWidth = 0.85;
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        const dotR = active ? 4.8 + pulse * 2.8 : 3.2;
        ctx.beginPath(); ctx.arc(last.x, last.y, dotR + 7, 0, Math.PI * 2);
        ctx.fillStyle = rgba(color, active ? 0.16 + pulse * 0.08 : 0.05); ctx.fill();
        ctx.beginPath(); ctx.arc(last.x, last.y, dotR + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(color, active ? 0.32 : 0.12); ctx.fill();
        ctx.beginPath(); ctx.arc(last.x, last.y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = active ? 20 : 8;
        ctx.fill(); ctx.shadowBlur = 0;

        if (label) {
          const sign = lastVal >= 0 ? "+" : "";
          const text = `${label} ${sign}${lastVal.toFixed(2)}%`;
          ctx.font = "800 10px system-ui,-apple-system,sans-serif";
          const tw = ctx.measureText(text).width;
          const bw = Math.min(tw + 14, 112), bh = 19;
          const bx = Math.max(left + 3, Math.min(W - right - bw - 4, last.x - bw - 6));
          const by = Math.max(top + 2, Math.min(H - bottom - bh, last.y - 24));
          roundedRect(ctx, bx, by, bw, bh, 10);
          ctx.fillStyle = "rgba(2,6,23,.84)"; ctx.fill();
          ctx.strokeStyle = rgba(color, active ? 0.68 : 0.32); ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = active ? color : "rgba(226,232,240,.78)";
          ctx.fillText(text, bx + 7, by + 13.5);
        }
      };

      if (aLead) { drawLine(b, cB, false, labelB); drawLine(a, cA, true, labelA); }
      else { drawLine(a, cA, false, labelA); drawLine(b, cB, true, labelB); }

      ctx.font = "800 10px system-ui,-apple-system,sans-serif";
      ctx.fillStyle = "rgba(148,163,184,.55)";
      const scale = Math.max(Math.abs(mx), Math.abs(mn)).toFixed(1);
      ctx.fillText(`+${scale}%`, W - right + 4, top + 8);
      ctx.fillText("0%", W - right + 4, zeroY + 3);
      ctx.fillText(`-${scale}%`, W - right + 4, H - bottom);

      const ldx = left + 6, ldy = top + 6;
      ctx.beginPath(); ctx.arc(ldx, ldy, 3.5 + pulse * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(leaderColor, 0.22 + pulse * 0.14); ctx.fill();
      ctx.beginPath(); ctx.arc(ldx, ldy, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = leaderColor; ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; startRef.current = 0;
    };
  }, [dA, dB, cA, cB, h, labelA, labelB]);

  const aLast = dA?.[dA.length - 1] ?? 0;
  const bLast = dB?.[dB.length - 1] ?? 0;
  const leader = aLast >= bLast ? labelA || "A" : labelB || "B";

  return (
    <div className="relative overflow-hidden rounded-xl" style={{
      border: "1px solid rgba(255,255,255,.06)",
      background: "rgba(5,3,1,.96)",
      boxShadow: "0 0 30px rgba(249,115,22,.09), inset 0 0 0 1px rgba(255,255,255,.025)",
    }}>
      {showLabels && (
        <div className="absolute left-3 right-3 top-2 z-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
          <span className="flex items-center gap-1.5" style={{ color: cA }}>
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: cA }} />{labelA}
          </span>
          <span className="flex items-center gap-1.5" style={{ color: cB }}>
            <span className="h-2 w-2 rounded-full" style={{ background: cB }} />{labelB}
          </span>
          <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/8 px-2 py-0.5 text-[9px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            LIVE · synced
          </span>
        </div>
      )}
      <canvas ref={ref} className="block w-full rounded-xl" style={{ height: h }} />
      <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide"
        style={{ background: "rgba(0,0,0,.55)", border: "1px solid rgba(249,115,22,.25)", color: "#fdba74" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />{leader} leads
      </div>
    </div>
  );
}
