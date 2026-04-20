'use client';
import React, { useRef, useEffect } from 'react';

interface Props {
  dA: number[]; dB: number[];
  cA?: string; cB?: string;
  h?: number; labelA?: string; labelB?: string; showLabels?: boolean;
}

export function MiniChart({ dA, dB, cA = '#f97316', cB = '#fbbf24', h = 120, labelA = '', labelB = '', showLabels = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke(); }
    const all = [...dA, ...dB]; if (all.length < 2) return;
    let mn = Math.min(...all), mx = Math.max(...all);
    const pad = (mx - mn) * 0.15 || 0.005; mn -= pad; mx += pad;
    const rng = mx - mn || 1;
    const draw = (data: number[], col: string) => {
      if (data.length < 2) return;
      const step = W / (data.length - 1);
      ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = 7;
      data.forEach((v, i) => { const x = i * step, y = H - ((v - mn) / rng) * (H - 10) - 5; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke(); ctx.shadowBlur = 0;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col + '33'); g.addColorStop(1, col + '00');
      ctx.beginPath();
      data.forEach((v, i) => { const x = i * step, y = H - ((v - mn) / rng) * (H - 10) - 5; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      if (data.length) { const lx = W - 2, ly = H - ((data[data.length - 1] - mn) / rng) * (H - 10) - 5; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0; }
    };
    if (mn < 0 && mx > 0) { const zy = H - ((0 - mn) / rng) * (H - 10) - 5; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, zy); ctx.lineTo(W, zy); ctx.stroke(); ctx.setLineDash([]); }
    draw(dA, cA); draw(dB, cB);
  }, [dA, dB, cA, cB, h]);
  return (
    <div>
      {showLabels && (
        <div className="flex items-center gap-4 mb-2 text-xs">
          <span className="flex items-center gap-1.5 font-bold" style={{ color: cA }}><span className="w-3 h-0.5 rounded inline-block" style={{ background: cA }} />{labelA}</span>
          <span className="flex items-center gap-1.5 font-bold" style={{ color: cB }}><span className="w-3 h-0.5 rounded inline-block" style={{ background: cB }} />{labelB}</span>
          <span className="ml-auto text-slate-600 text-xs">live·1s</span>
        </div>
      )}
      <canvas ref={ref} width={600} height={h} className="w-full rounded-xl" style={{ height: h }} />
    </div>
  );
}
