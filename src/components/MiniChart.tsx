'use client';
// src/components/MiniChart.tsx
import { useEffect, useRef } from 'react';

interface Props {
  dataA: number[];
  dataB: number[];
  colorA?: string;
  colorB?: string;
  height?: number;
  labelA?: string;
  labelB?: string;
}

export default function MiniChart({
  dataA, dataB,
  colorA = '#22d3ee', colorB = '#f472b6',
  height = 120, labelA = 'A', labelB = 'B',
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke();
    }

    const all = [...dataA, ...dataB];
    if (all.length < 2) return;
    let mn = Math.min(...all), mx = Math.max(...all);
    const pad = (mx - mn) * 0.15 || 0.005;
    mn -= pad; mx += pad;
    const rng = mx - mn || 1;

    const draw = (data: number[], col: string) => {
      if (data.length < 2) return;
      const step = W / (data.length - 1);
      ctx.beginPath();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      data.forEach((v, i) => {
        const x = i * step;
        const y = H - ((v - mn) / rng) * (H - 10) - 5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Fill
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, col + '33'); g.addColorStop(1, col + '00');
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * step, y = H - ((v - mn) / rng) * (H - 10) - 5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      // Dot at end
      const lx = W - 2, lv = data[data.length - 1];
      const ly = H - ((lv - mn) / rng) * (H - 10) - 5;
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fill();
      ctx.shadowBlur = 0;
    };

    draw(dataA, colorA);
    draw(dataB, colorB);
  }, [dataA, dataB, colorA, colorB, height]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs">
        <span className="flex items-center gap-1.5 font-bold" style={{ color: colorA }}>
          <span className="w-3 h-0.5 rounded inline-block" style={{ background: colorA }} />{labelA}
        </span>
        <span className="flex items-center gap-1.5 font-bold" style={{ color: colorB }}>
          <span className="w-3 h-0.5 rounded inline-block" style={{ background: colorB }} />{labelB}
        </span>
        <span className="ml-auto text-slate-600">simulated · 1s</span>
      </div>
      <canvas ref={ref} width={600} height={height} className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}
